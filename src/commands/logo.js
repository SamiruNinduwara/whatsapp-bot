import { downloadMediaMessage, normalizeMessageContent } from "@whiskeysockets/baileys";
import pino from "pino";
import { config } from "../config.js";
import { takeCooldown } from "../apiUtils.js";
import { makeLogo, STYLES, cleanText, hasNonLatin } from "../logoMaker.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];

const USAGE =
  "🎨 *Logo maker*\n\n" +
  ".logo ASURA BOT  ➜ a logo from a name\n" +
  ".logo ASURA BOT | Gaming Community  ➜ with a tagline\n" +
  ".logo ASURA BOT #2  ➜ choose a style (1-6, or #r for random)\n\n" +
  "↩️ Reply to a photo with .logo (add a name if you like: .logo SAMIRU | Developer)\n" +
  "📋 Styles: .logo list";

const STYLE_LIST =
  "🎨 *Logo styles*\n\n" +
  Object.entries(STYLES)
    .map(([n, s]) => `${n} — ${s.name}`)
    .join("\n") +
  "\n\nExample: .logo ASURA BOT #3\nFor photo logos only styles 1-4 change the colours.";

// One logo at a time (it uses the phone's CPU)
let chain = Promise.resolve();
let waiting = 0;
function oneAtATime(task) {
  waiting++;
  const run = chain.then(task);
  chain = run.catch(() => {}).finally(() => {
    waiting--;
  });
  return run;
}

// "ASURA BOT | Gaming #2" -> { name, tagline, style }
function parseArgs(args) {
  let raw = args.join(" ");
  let style = null;

  const m = raw.match(/(?:^|\s)#(\d|r)\b/i);
  if (m) {
    style = m[1].toLowerCase() === "r" ? "random" : Number(m[1]);
    raw = raw.replace(m[0], " ");
  }

  const [name, ...rest] = raw.split("|");
  return { name: name || "", tagline: rest.join(" "), style };
}

// Is this message content an image? (a normal photo, or an image sent as a file)
function imageInfo(content) {
  if (content?.imageMessage) return { mimetype: content.imageMessage.mimetype };
  const doc = content?.documentMessage;
  if (doc?.mimetype?.startsWith("image/")) return { mimetype: doc.mimetype };
  return null;
}

// The photo can be in the message itself (caption .logo) or in the message that was replied to
function findImage(msg) {
  const content = normalizeMessageContent(msg.message) || {};

  const own = imageInfo(content);
  if (own) return { target: msg, ...own };

  const ctx = content.extendedTextMessage?.contextInfo;
  const replied = imageInfo(normalizeMessageContent(ctx?.quotedMessage));
  if (replied) {
    return {
      target: {
        key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, participant: ctx.participant },
        message: ctx.quotedMessage,
      },
      ...replied,
    };
  }
  return null;
}

export default {
  name: "logo",
  aliases: ["logomaker"],
  description: "Make a logo from a name or a photo (.logo ASURA BOT, or reply to a photo)",
  ownerOnly: false,
  async run({ sock, msg, jid, args, sender }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if ((args[0] || "").toLowerCase() === "list") return reply(STYLE_LIST);

    const parsed = parseArgs(args);

    if (hasNonLatin(parsed.name) || hasNonLatin(parsed.tagline)) {
      return reply(
        "❌ Please write the name with English letters.\n" +
          "Tip: .tr singlish <your name> gives the Sinhala name in English letters."
      );
    }

    const text = cleanText(parsed.name, 24);
    const tagline = cleanText(parsed.tagline, 40);

    // The photo (own or replied to), if there is one
    const image = findImage(msg);

    if (!image && !text) return reply(USAGE);

    // Style: a number, #r for random, or style 1 by default
    let style = parsed.style ?? 1;
    if (style === "random") {
      style = image ? 1 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 6);
    }
    if (!STYLES[style]) return reply("❌ Styles are #1 to #6. Type .logo list");

    const wait = takeCooldown("logo", sender, 15000);
    if (wait) return reply(`⏳ Please wait ${wait}s before the next logo.`);

    await reply(waiting > 0 ? "⏳ Queued. I'm making another logo first..." : "🎨 Making your logo...");

    await oneAtATime(async () => {
      try {
        let photoBuffer = null;

        if (image) {
          const mimeType = (image.mimetype || "image/jpeg").split(";")[0].trim().toLowerCase();
          if (!SUPPORTED_IMAGES.includes(mimeType)) {
            return reply("❌ I can use JPG, PNG and WEBP photos.");
          }

          photoBuffer = await downloadMediaMessage(
            image.target,
            "buffer",
            {},
            { logger: pino({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
          );
          if (photoBuffer.length > MAX_IMAGE_BYTES) {
            return reply("❌ That photo is too large (max 10 MB).");
          }
        }

        const data = await makeLogo({
          text,
          tagline,
          style,
          photoBuffer,
          fontPath: config.logoFont,
        });

        const styleName = STYLES[style].name;
        const caption = image
          ? `🎨 Your logo  •  ${styleName}\n\nTry another style: .logo ${text || "NAME"} #${style === 1 ? 2 : 1}`
          : `🎨 *${text}*  •  ${styleName}\n\nTry another style: .logo ${text} #${style === 6 ? 1 : style + 1}`;

        await sock.sendMessage(jid, { image: data, caption }, { quoted: msg });
      } catch (err) {
        console.error("Logo error:", err.message);
        if (err.code === "NO_MAGICK") {
          await reply("❌ ImageMagick is not installed. In Termux run: pkg install imagemagick -y");
        } else if (err.code === "NO_FONT") {
          await reply("❌ I couldn't find a font. The bot owner needs to set logoFont in config.js.");
        } else {
          await reply("❌ Couldn't make the logo. Please try again later.");
        }
      }
    });
  },
};