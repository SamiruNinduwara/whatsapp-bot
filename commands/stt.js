import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";

const exec = promisify(execFile);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const MAX_SECONDS = 120;
const COOLDOWN_MS = 10000;
const lastUse = new Map();

// reply karapu voice note eka hoyaganna
function getQuotedAudio(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted?.audioMessage) return null;
  return {
    audio: quoted.audioMessage,
    target: {
      key: {
        remoteJid: msg.key.remoteJid,
        id: ctx.stanzaId,
        participant: ctx.participant,
      },
      message: quoted,
    },
  };
}

async function askGemini(wavBase64, wantSummary) {
  const prompt = wantSummary
    ? "Transcribe this voice message exactly as spoken (write Sinhala speech in Sinhala script, English in English). Then add a blank line and a short summary (1-2 sentences) in the same language as the speaker, starting with 'Summary:'. If there is no speech, reply: (no speech)"
    : "Transcribe this voice message exactly as spoken. Write Sinhala speech in Sinhala script and English in English. Output only the transcript, nothing else. If there is no speech, reply: (no speech)";

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
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "audio/wav", data: wavBase64 } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 1500 },
    }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("\n").trim();
}

export default {
  name: "stt",
  aliases: ["transcribe"],
  description: "Reply to a voice note .stt (If you also want the summary .stt sum)",
  ownerOnly: false,
  async run({ sock, msg, jid, args, sender }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if (!process.env.GEMINI_API_KEY) {
      return reply("❌ The API key is not set. (Check .env file).");
    }

    const found = getQuotedAudio(msg);
    if (!found) {
      return reply(
        "🎤 Reply to a voice note say .stt.\n(If you also want the summary: .stt sum)"
      );
    }

    const seconds = Number(found.audio.seconds || 0);
    if (seconds > MAX_SECONDS) {
      return reply(`⏱️ The voice note is long (max ${MAX_SECONDS} seconds).`);
    }

    const now = Date.now();
    if (now - (lastUse.get(sender) || 0) < COOLDOWN_MS) {
      return reply("⏳ Wait a moment, one by one.");
    }
    lastUse.set(sender, now);

    await sock.sendPresenceUpdate("composing", jid);

    const id = Date.now();
    const input = path.join(os.tmpdir(), `vn_${id}`);
    const output = path.join(os.tmpdir(), `vn_${id}.wav`);

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
      await fs.writeFile(input, buffer);

      // WhatsApp voice note (opus) eka wav ekakata harawanawa
      await exec("ffmpeg", ["-y", "-i", input, "-ar", "16000", "-ac", "1", output]);
      const wav = await fs.readFile(output);

      const text = await askGemini(
        wav.toString("base64"),
        args[0]?.toLowerCase() === "sum"
      );
      await reply(`📝 *Transcript*\n\n${text || "(There is no response)"}`);
    } catch (err) {
      if (err.code === "ENOENT") {
        await reply("❌ ffmpeg is not installed. In Termux run: pkg install ffmpeg -y");
      } else {
        console.error("STT error:", err.message);
        await reply("❌ Could not transcribe. Try again later.");
      }
    } finally {
      await fs.rm(input, { force: true });
      await fs.rm(output, { force: true });
    }
  },
};