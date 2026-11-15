import { downloadMediaMessage, normalizeMessageContent } from "@whiskeysockets/baileys";
import pino from "pino";
import { takeCooldown } from "../apiUtils.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT = 4000; // longest text we send back
const SUPPORTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const PROMPT =
  "Extract all the text from this image exactly as it is written. " +
  "Keep the original language (it can be Sinhala, Tamil or English) and keep the line breaks. " +
  "Write Sinhala and Tamil text in their own scripts. " +
  "Output only the extracted text, nothing else. " +
  "If there is no readable text, reply exactly: (no text found)";

// Is this message content an image? (a normal photo, or an image sent as a file)
function imageInfo(content) {
  if (content?.imageMessage) return { mimetype: content.imageMessage.mimetype };
  const doc = content?.documentMessage;
  if (doc?.mimetype?.startsWith("image/")) return { mimetype: doc.mimetype };
  return null;
}

// The photo can be in the message itself (caption .ocr) or in the message that was replied to
function findImage(msg) {
  const content = normalizeMessageContent(msg.message) || {};

  const own = imageInfo(content);
  if (own) return { target: msg, ...own };

  const ctx = content.extendedTextMessage?.contextInfo;
  const quoted = normalizeMessageContent(ctx?.quotedMessage);
  const replied = imageInfo(quoted);
  if (replied) {
    return {
      target: {
        key: {
          remoteJid: msg.key.remoteJid,
          id: ctx.stanzaId,
          participant: ctx.participant,
        },
        message: ctx.quotedMessage,
      },
      ...replied,
    };
  }
  return null;
}

async function readText(base64, mimeType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType, data: base64 } }, { text: PROMPT }],
        },
      ],
      generationConfig: { maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

export default {
  name: "ocr",
  aliases: ["readtext", "totext"],
  description: "Read the text in a photo (send a photo with .ocr, or reply to one)",
  ownerOnly: false,
  async run({ sock, msg, jid, sender }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if (!process.env.GEMINI_API_KEY) {
      return reply("❌ API key is not set (check your .env file).");
    }

    const found = findImage(msg);
    if (!found) {
      return reply("📷 Send a photo with the caption .ocr, or reply to a photo with .ocr");
    }

    const mimeType = (found.mimetype || "image/jpeg").split(";")[0].trim().toLowerCase();
    if (!SUPPORTED.includes(mimeType)) {
      return reply("❌ I can read JPG, PNG and WEBP images.");
    }

    const wait = takeCooldown("ocr", sender, 10000);
    if (wait) return reply(`⏳ Please wait ${wait}s before the next photo.`);

    await sock.sendPresenceUpdate("composing", jid);

    try {
      const buffer = await downloadMediaMessage(
        found.target,
        "buffer",
        {},
        {
          logger: pino({ level: "silent" }),
          reuploadRequest: sock.updateMediaMessage,
        }
      );

      if (buffer.length > MAX_IMAGE_BYTES) {
        return reply("❌ That photo is too large (max 10 MB).");
      }

      let text = await readText(buffer.toString("base64"), mimeType);

      if (!text || /^\(?\s*no text found\s*\)?\.?$/i.test(text)) {
        return reply("😕 I couldn't find any text in that photo.");
      }

      let note = "";
      if (text.length > MAX_TEXT) {
        text = text.slice(0, MAX_TEXT);
        note = "\n\n_(The text was cut because it is very long.)_";
      }

      await reply(`📝 *Text from the photo*\n\n${text}${note}`);
    } catch (err) {
      console.error("OCR error:", err.message);
      await reply("❌ Couldn't read that photo. Please try again later.");
    }
  },
};