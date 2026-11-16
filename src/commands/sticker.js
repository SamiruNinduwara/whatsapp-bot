import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";

const exec = promisify(execFile);

// photo/video eka message ekema thiyenawada, nattam reply karapu ekakada balanawa
function getMedia(msg) {
  const m = msg.message;
  if (m?.imageMessage || m?.videoMessage) {
    return { target: msg, isVideo: !!m.videoMessage };
  }
  const ctx = m?.extendedTextMessage?.contextInfo;
  const q = ctx?.quotedMessage;
  if (q?.imageMessage || q?.videoMessage) {
    return {
      target: {
        key: {
          remoteJid: msg.key.remoteJid,
          id: ctx.stanzaId,
          participant: ctx.participant,
        },
        message: q,
      },
      isVideo: !!q.videoMessage,
    };
  }
  return null;
}

export default {
  name: "sticker",
  aliases: ["s"],
  description: "It converts the photo/video into a sticker.",
  ownerOnly: false,
  async run({ sock, msg, jid }) {
    const media = getMedia(msg);
    if (!media) {
      return sock.sendMessage(
        jid,
        {
          text: "📷 Send a photo/video with .sticker in the caption, or reply to a photo/video with sticker and say .sticker.",
        },
        { quoted: msg }
      );
    }

    const buffer = await downloadMediaMessage(
      media.target,
      "buffer",
      {},
      {
        logger: pino({ level: "silent" }),
        reuploadRequest: sock.updateMediaMessage,
      }
    );

    const id = Date.now();
    const input = path.join(os.tmpdir(), `in_${id}`);
    const output = path.join(os.tmpdir(), `out_${id}.webp`);
    await fs.writeFile(input, buffer);

    const scale =
      "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0";

    const args = media.isVideo
      ? ["-y", "-i", input, "-t", "6", "-vf", `fps=12,${scale}`, "-an", "-loop", "0", "-vcodec", "libwebp", "-q:v", "40", output]
      : ["-y", "-i", input, "-vf", scale, "-vcodec", "libwebp", "-q:v", "70", output];

    try {
      await exec("ffmpeg", args);
      const sticker = await fs.readFile(output);
      await sock.sendMessage(jid, { sticker }, { quoted: msg });
    } catch (err) {
      if (err.code === "ENOENT") {
        await sock.sendMessage(
          jid,
          { text: "❌ ffmpeg is Not installed. In the Termux: pkg install ffmpeg -y" },
          { quoted: msg }
        );
      } else {
        throw err;
      }
    } finally {
      await fs.rm(input, { force: true });
      await fs.rm(output, { force: true });
    }
  },
};