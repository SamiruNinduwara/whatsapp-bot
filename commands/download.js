import fs from "fs/promises";
import path from "path";
import {
  MAX_MB,
  MAX_BYTES,
  NON_OWNER_MB,
  DAILY_LIMIT,
  YOUTUBE_HOSTS,
  TIKTOK_HOSTS,
  parseUrl,
  hostMatches,
  cooldownLeft,
  markUsed,
  enqueue,
  queueLength,
  ytDlp,
  downloadFile,
  dailyLeft,
  useDaily,
  makeTmpDir,
  removeDir,
  explainError,
} from "../downloadUtils.js";

// Shared flow: cooldown -> queue -> temp folder -> job -> cleanup
async function runDownload(ctx, job) {
  const { sock, msg, jid, sender } = ctx;
  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

  const wait = cooldownLeft(sender);
  if (wait) return reply(`⏳ Please wait ${wait}s before your next download.`);
  markUsed(sender);

  const ahead = queueLength();
  await reply(ahead > 0 ? `⏳ Queued. ${ahead} download(s) ahead of you.` : "⏳ Downloading...");

  await enqueue(async () => {
    const dir = await makeTmpDir();
    try {
      await job(dir);
    } catch (err) {
      console.error("Download error:", err.message);
      await reply(explainError(err));
    } finally {
      await removeDir(dir);
    }
  });
}

// ---------- .mp3 ----------
const mp3 = {
  name: "mp3",
  aliases: ["song"],
  description: "Download a YouTube video as MP3 (.mp3 link or song name)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const query = args.join(" ").trim().slice(0, 100);
    if (!query) return reply("Use: .mp3 <YouTube link or song name>");

    let target;
    const url = parseUrl(query);
    if (url) {
      if (!hostMatches(url, YOUTUBE_HOSTS)) {
        return reply("❌ Only YouTube links are supported for .mp3");
      }
      target = url.toString();
    } else {
      target = `ytsearch1:${query}`;
    }

    await runDownload(ctx, async (dir) => {
      await ytDlp([
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "--max-filesize", `${MAX_MB}M`,
        "--match-filter", "duration<=600",
        "-o", path.join(dir, "audio.%(ext)s"),
        target,
      ]);

      const file = (await fs.readdir(dir)).find((f) => f.endsWith(".mp3"));
      if (!file) throw new Error("NO_OUTPUT");

      const audio = await fs.readFile(path.join(dir, file));
      await sock.sendMessage(jid, { audio, mimetype: "audio/mpeg" }, { quoted: msg });
    });
  },
};

// ---------- .tiktok ----------
const tiktok = {
  name: "tiktok",
  aliases: ["tt"],
  description: "Download a TikTok video (.tiktok link)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const url = parseUrl(args[0] || "");
    if (!url || !hostMatches(url, TIKTOK_HOSTS)) {
      return reply("Use: .tiktok <TikTok link>");
    }

    await runDownload(ctx, async (dir) => {
      await ytDlp([
        "-f", "best[ext=mp4]/best",
        "--max-filesize", `${MAX_MB}M`,
        "-o", path.join(dir, "video.%(ext)s"),
        url.toString(),
      ]);

      const file = (await fs.readdir(dir)).find((f) => f.startsWith("video."));
      if (!file) throw new Error("NO_OUTPUT");

      const video = await fs.readFile(path.join(dir, file));
      await sock.sendMessage(
        jid,
        { video, mimetype: "video/mp4", caption: "✅ Here is your video" },
        { quoted: msg }
      );
    });
  },
};

// ---------- .dl (direct link) ----------
const dl = {
  name: "dl",
  aliases: ["download"],
  description: "Download a direct file link (.dl link)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args, sender, isOwner } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const url = parseUrl(args[0] || "");
    if (!url) return reply("Use: .dl <direct file link>");

    if (!isOwner && dailyLeft(sender) <= 0) {
      return reply(
        `⛔ Daily limit reached (${DAILY_LIMIT} downloads per day). Try again tomorrow.`
      );
    }

    await runDownload(ctx, async (dir) => {
      if (!isOwner) useDaily(sender);
      const limit = isOwner ? MAX_BYTES : NON_OWNER_MB * 1024 * 1024;

      const dest = path.join(dir, "file");
      const info = await downloadFile(url.toString(), dest, limit);

      let name = "file";
      try {
        name = decodeURIComponent(path.basename(new URL(info.finalUrl).pathname)) || "file";
      } catch {}

      name = name.replace(/[^\w.\- ]/g, "_").slice(0, 80);
      const document = await fs.readFile(dest);
      await sock.sendMessage(
        jid,
        {
          document,
          mimetype: info.type || "application/octet-stream",
          fileName: name,
        },
        { quoted: msg }
      );

      if (!isOwner) await reply(`ℹ️ Downloads left today: ${dailyLeft(sender)}`);
    });
  },
};

export default [mp3, tiktok, dl];