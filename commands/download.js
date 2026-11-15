import fs from "fs/promises";
import path from "path";
import { config } from "../config.js";
import {
  MAX_MB,
  MAX_BYTES,
  NON_OWNER_MB,
  MAX_MINUTES,
  DAILY_LIMIT,
  YOUTUBE_HOSTS,
  TIKTOK_HOSTS,
  FACEBOOK_HOSTS,
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
import { cacheGet, cacheAdd } from "../downloadCache.js";

const BIG_MEDIA_BYTES = 64 * 1024 * 1024; // above this, send as a document
const FAST_AUDIO = config.fastAudio !== false; // send M4A without converting to MP3

// Errors that will not go away by trying another format
const isFinalError = (err) =>
  err.code === "ENOENT" ||
  /Video unavailable|Private video|Sign in to confirm|not a bot|not available/i.test(
    `${err.message} ${err.stderr || ""}`
  );

// ---------- Cache keys: the same video must always give the same key ----------
function youtubeId(url) {
  let id = null;
  if (url.hostname.toLowerCase() === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (url.searchParams.get("v")) {
    id = url.searchParams.get("v");
  } else {
    const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,20})/);
    if (m) id = m[1];
  }
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

// A link without tracking parameters (only the "v" parameter is kept)
function cleanUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const v = url.searchParams.get("v");
  return `${host}${url.pathname.replace(/\/$/, "")}${v ? `?v=${v}` : ""}`;
}

// Sends a file from disk. Small audio/video goes as normal media; big files go as documents
// (streamed from disk, so a 2 GB file does not fill the phone's RAM).
async function sendFromDisk(sock, jid, msg, filePath, { type, mimetype, fileName, caption }) {
  const { size } = await fs.stat(filePath);

  if (type !== "document" && size <= BIG_MEDIA_BYTES) {
    const data = await fs.readFile(filePath);
    const content =
      type === "audio" ? { audio: data, mimetype } : { video: data, mimetype, caption };
    return sock.sendMessage(jid, content, { quoted: msg });
  }

  return sock.sendMessage(
    jid,
    { document: { url: filePath }, mimetype, fileName, caption },
    { quoted: msg }
  );
}

// Sends the file, then saves a copy in the cache for the next person who asks for it
async function deliver(ctx, filePath, meta, cacheKey) {
  const { sock, jid, msg } = ctx;
  await sendFromDisk(sock, jid, msg, filePath, meta);
  if (cacheKey) await cacheAdd(cacheKey, filePath, meta);
}

// Shared flow: cooldown -> cache -> queue -> temp folder -> job -> cleanup
async function runDownload(ctx, job, cacheKey = null) {
  const { sock, msg, jid, sender } = ctx;
  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

  const wait = cooldownLeft(sender);
  if (wait) return reply(`⏳ Please wait ${wait}s before your next download.`);
  markUsed(sender);

  // Already downloaded before? Send it straight away (no queue, no download)
  if (cacheKey) {
    const hit = await cacheGet(cacheKey);
    if (hit) {
      await reply("⚡ Found it in my cache. Sending...");
      try {
        await sendFromDisk(sock, jid, msg, hit.path, hit.meta);
        console.log(`[download] sent from cache (${cacheKey})`);
      } catch (err) {
        console.error("Cache send failed:", err.message);
        await reply(explainError(err));
      }
      return;
    }
  }

  const ahead = queueLength();
  await reply(ahead > 0 ? `⏳ Queued. ${ahead} download(s) ahead of you.` : "⏳ Downloading...");

  await enqueue(async () => {
    const started = Date.now();
    const dir = await makeTmpDir();
    try {
      await job(dir);
      console.log(`[download] finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
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
  description: "Download a YouTube video as audio (.mp3 link or song name)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const query = args.join(" ").trim().slice(0, 100);
    if (!query) return reply("Use: .mp3 <YouTube link or song name>");

    const mode = FAST_AUDIO ? "m4a" : "mp3";
    let target;
    let cacheKey;
    const url = parseUrl(query);
    if (url) {
      if (!hostMatches(url, YOUTUBE_HOSTS)) {
        return reply("❌ Only YouTube links are supported for .mp3");
      }
      target = url.toString();
      cacheKey = `mp3:${mode}:${youtubeId(url) || cleanUrl(url)}`;
    } else {
      target = `ytsearch1:${query}`; // search and take the first result
      cacheKey = `mp3:${mode}:q:${query.toLowerCase().replace(/\s+/g, " ")}`;
    }

    const limits = [
      "--max-filesize", `${MAX_MB}M`,
      "--match-filter", `duration<=?${MAX_MINUTES * 60}`,
    ];

    await runDownload(
      ctx,
      async (dir) => {
        let file = null;
        let meta = null;

        // 1) Fast path: download the M4A audio as it is (no converting)
        if (FAST_AUDIO) {
          try {
            await ytDlp(["-f", "ba[ext=m4a]", ...limits, "-o", path.join(dir, "audio.%(ext)s"), target]);

            const m4a = (await fs.readdir(dir)).find((f) => f.endsWith(".m4a"));
            if (!m4a) throw new Error("NO_OUTPUT"); // filtered out: too long or too big

            file = path.join(dir, m4a);
            meta = { type: "audio", mimetype: "audio/mp4", fileName: "audio.m4a" };
          } catch (err) {
            if (err.message === "NO_OUTPUT" || isFinalError(err)) throw err;
            console.error("Fast audio failed, converting to MP3 instead:", err.message);
          }
        }

        // 2) Slower path: convert to MP3 (works for every video)
        if (!file) {
          await ytDlp([
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "5",
            ...limits,
            "-o", path.join(dir, "audio.%(ext)s"),
            target,
          ]);

          const mp3File = (await fs.readdir(dir)).find((f) => f.endsWith(".mp3"));
          if (!mp3File) throw new Error("NO_OUTPUT");

          file = path.join(dir, mp3File);
          meta = { type: "audio", mimetype: "audio/mpeg", fileName: "audio.mp3" };
        }

        await deliver(ctx, file, meta, cacheKey);
      },
      cacheKey
    );
  },
};

// ---------- .mp4 (YouTube / TikTok / Facebook video) ----------
const PLATFORMS = [
  { name: "YouTube", hosts: YOUTUBE_HOSTS },
  { name: "TikTok", hosts: TIKTOK_HOSTS },
  { name: "Facebook", hosts: FACEBOOK_HOSTS },
];
const QUALITIES = [240, 360, 480, 720]; // maximum video height

const mp4 = {
  name: "mp4",
  aliases: ["video", "ytv", "fb", "facebook"],
  description: "Download a YouTube / TikTok / Facebook video (.mp4 link 360)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const url = parseUrl(args[0] || "");
    const platform = url && PLATFORMS.find((p) => hostMatches(url, p.hosts));
    if (!platform) {
      return reply(
        "Use: .mp4 <YouTube / TikTok / Facebook link> [quality]\n" +
          "Example: .mp4 https://youtu.be/xxxx 480\n" +
          "Qualities: 240, 360 (default), 480, 720"
      );
    }

    const quality = args[1] ? Number(args[1]) : 360;
    if (!QUALITIES.includes(quality)) {
      return reply("Quality must be one of: 240, 360, 480, 720");
    }

    const id = platform.name === "YouTube" ? youtubeId(url) : null;
    const cacheKey = `mp4:${platform.name}:${id || cleanUrl(url)}:${quality}`;

    // 1st choice: a ready-made H.264 mp4 (no merging needed, fastest).
    // 2nd choice: separate video + audio merged together. Then anything that fits.
    const format =
      `b[height<=${quality}][ext=mp4][vcodec^=avc1]/` +
      `bv*[height<=${quality}][vcodec^=avc1]+ba[acodec^=mp4a]/` +
      `b[height<=${quality}][ext=mp4]/b[height<=${quality}]/b`;

    await runDownload(
      ctx,
      async (dir) => {
        await ytDlp([
          "-f", format,
          "--merge-output-format", "mp4",
          "--max-filesize", `${MAX_MB}M`,
          "--match-filter", `duration<=?${MAX_MINUTES * 60}`,
          "-o", path.join(dir, "video.%(ext)s"),
          url.toString(),
        ]);

        const file = (await fs.readdir(dir)).find((f) => f.endsWith(".mp4"));
        if (!file) throw new Error("NO_OUTPUT");

        const filePath = path.join(dir, file);
        const { size } = await fs.stat(filePath);
        if (size > MAX_BYTES) throw new Error("TOO_BIG");

        await deliver(
          ctx,
          filePath,
          {
            type: "video",
            mimetype: "video/mp4",
            fileName: "video.mp4",
            caption: `✅ ${platform.name} video (up to ${quality}p)`,
          },
          cacheKey
        );
      },
      cacheKey
    );
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

    const cacheKey = `tiktok:${cleanUrl(url)}`;

    await runDownload(
      ctx,
      async (dir) => {
        await ytDlp([
          "-f", "best[ext=mp4]/best",
          "--max-filesize", `${MAX_MB}M`,
          "-o", path.join(dir, "video.%(ext)s"),
          url.toString(),
        ]);

        const file = (await fs.readdir(dir)).find((f) => f.startsWith("video."));
        if (!file) throw new Error("NO_OUTPUT");

        await deliver(
          ctx,
          path.join(dir, file),
          {
            type: "video",
            mimetype: "video/mp4",
            fileName: "video.mp4",
            caption: "✅ Here is your video",
          },
          cacheKey
        );
      },
      cacheKey
    );
  },
};

// ---------- .dl (direct link, never cached) ----------
const dl = {
  name: "dl",
  aliases: ["download"],
  description: "Download a direct file link (.dl link)",
  ownerOnly: false, // everyone can use it; non-owners have limits
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

      // Build a safe file name from the final URL
      let name = "file";
      try {
        name = decodeURIComponent(path.basename(new URL(info.finalUrl).pathname)) || "file";
      } catch {
        // keep the default name
      }
      name = name.replace(/[^\w.\- ]/g, "_").slice(0, 80);

      await sendFromDisk(sock, jid, msg, dest, {
        type: "document",
        mimetype: info.type || "application/octet-stream",
        fileName: name,
      });

      if (!isOwner) await reply(`ℹ️ Downloads left today: ${dailyLeft(sender)}`);
    });
  },
};

export default [mp3, mp4, tiktok, dl];