import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import dns from "dns/promises";
import net from "net";
import { config } from "./config.js";

const exec = promisify(execFile);

// ---------- Limits (change them in config.js) ----------
// WhatsApp cannot send a file bigger than 2 GB, so that is the highest limit allowed here.
const WHATSAPP_MAX_MB = 1024;

function limitMB(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(n, WHATSAPP_MAX_MB) : fallback;
}

export const MAX_MB = limitMB(config.maxDownloadMB, 50); // owner, and .mp3 / .mp4 / .tiktok for everyone
export const NON_OWNER_MB = limitMB(config.userMaxDownloadMB, MAX_MB); // .dl for everyone else
export const MAX_BYTES = MAX_MB * 1024 * 1024;
export const MAX_MINUTES =
  Number(config.maxMediaMinutes) > 0 ? Number(config.maxMediaMinutes) : 120;
export const DAILY_LIMIT =
  Number(config.userDailyDownloads) > 0 ? Number(config.userDailyDownloads) : 10;

const COOLDOWN_MS = 20000; // 20 seconds per user
const LONG_TIMEOUT_MS = 2 * 60 * 60 * 1000; // up to 2 hours for very large files

export const formatMB = (mb) =>
  mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

// ---------- Cooldown ----------
const lastUse = new Map();

export function cooldownLeft(user) {
  const left = COOLDOWN_MS - (Date.now() - (lastUse.get(user) || 0));
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export function markUsed(user) {
  lastUse.set(user, Date.now());
}

// ---------- Queue (one download at a time) ----------
let chain = Promise.resolve();
let pending = 0;

export const queueLength = () => pending;

export function enqueue(task) {
  pending++;
  const run = chain.then(task);
  chain = run.catch(() => {}).finally(() => {
    pending--;
  });
  return run;
}

// ---------- URL helpers ----------
export const YOUTUBE_HOSTS = ["youtube.com", "youtu.be"];
export const TIKTOK_HOSTS = ["tiktok.com"];
export const FACEBOOK_HOSTS = ["facebook.com", "fb.watch", "fb.com"];

export function parseUrl(text) {
  try {
    const u = new URL(text);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

export function hostMatches(url, domains) {
  const h = url.hostname.toLowerCase();
  return domains.some((d) => h === d || h.endsWith("." + d));
}

// ---------- Block private / local addresses ----------
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return (
    v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")
  );
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("PRIVATE_HOST");
    return;
  }
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("PRIVATE_HOST");
  }
}

// ---------- Free storage check ----------
// A big file needs space for the download plus a temporary encrypted copy while uploading.
async function assertFreeSpace(neededBytes) {
  let free;
  try {
    const s = await fs.statfs(os.tmpdir());
    free = Number(s.bavail) * Number(s.bsize);
  } catch {
    return; // statfs is not available, skip the check
  }
  if (free < neededBytes * 2.2 + 200 * 1024 * 1024) throw new Error("NO_SPACE");
}

// ---------- Direct file download (size limit, safe redirects, streamed to disk) ----------
export async function downloadFile(startUrl, destPath, maxBytes = MAX_BYTES) {
  let url = startUrl;

  for (let i = 0; i <= 3; i++) {
    const u = parseUrl(url);
    if (!u) throw new Error("BAD_URL");
    await assertPublicHost(u.hostname.replace(/^\[|\]$/g, ""));

    const res = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(LONG_TIMEOUT_MS),
    });

    // Follow redirects manually so every hop is checked
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, u).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP_${res.status}`);

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error("TOO_BIG");
    await assertFreeSpace(declared || 200 * 1024 * 1024);

    let size = 0;
    let checkedBig = false;
    const file = await fs.open(destPath, "w");
    try {
      for await (const chunk of res.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error("TOO_BIG");
        // Size was not announced: check the storage once the file gets big
        if (!declared && !checkedBig && size > 512 * 1024 * 1024) {
          checkedBig = true;
          await assertFreeSpace(size);
        }
        await file.write(chunk);
      }
    } finally {
      await file.close();
    }

    return {
      size,
      type: (res.headers.get("content-type") || "").split(";")[0].trim(),
      finalUrl: url,
    };
  }

  throw new Error("TOO_MANY_REDIRECTS");
}

// ---------- yt-dlp ----------
export function ytDlp(args) {
  return exec(
    "yt-dlp",
    ["--no-playlist", "--no-warnings", "--js-runtimes", "node", ...args],
    { timeout: LONG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
  );
}

// ---------- Temp folders ----------
export const makeTmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), "dl_"));
export const removeDir = (dir) => fs.rm(dir, { recursive: true, force: true });

// ---------- Daily limit for non-owners (.dl) ----------
const daily = new Map(); // user -> { day, count }
const today = () => new Date().toISOString().slice(0, 10);

export function dailyLeft(user) {
  const rec = daily.get(user);
  if (!rec || rec.day !== today()) return DAILY_LIMIT;
  return Math.max(DAILY_LIMIT - rec.count, 0);
}

export function useDaily(user) {
  const rec = daily.get(user);
  if (!rec || rec.day !== today()) {
    daily.set(user, { day: today(), count: 1 });
  } else {
    rec.count++;
  }
}

// ---------- Friendly error messages ----------
export function explainError(err) {
  const text = `${err.message || ""} ${err.stderr || ""}`;

  if (err.code === "ENOENT") {
    return "❌ yt-dlp is not installed. In Termux run: pip install -U yt-dlp yt-dlp-ejs";
  }
  if (/PRIVATE_HOST/.test(text)) return "❌ That address is not allowed.";
  if (/NO_SPACE/.test(text)) {
    return "❌ The bot's phone doesn't have enough free storage for that file.";
  }
  if (/TOO_BIG|max-filesize|larger than/i.test(text)) {
    return `❌ That file is too large (limit: ${formatMB(MAX_MB)} for the owner, ${formatMB(NON_OWNER_MB)} for others).`;
  }
  if (/NO_OUTPUT/.test(text)) {
    return "❌ Couldn't download that. It may be too long, too large or unavailable.";
  }
  if (/HTTP_\d+/.test(text)) {
    return `❌ The server replied with an error (${text.match(/HTTP_\d+/)[0]}).`;
  }
  if (/Sign in to confirm|not a bot/i.test(text)) {
    return "❌ YouTube is asking for verification right now. Please try again later.";
  }
  if (/Video unavailable|Private video|not available/i.test(text)) {
    return "❌ That video is unavailable.";
  }
  if (/login required|log in|cookies/i.test(text)) {
    return "❌ That video is private or requires a login.";
  }
  if (err.killed || /timeout|TimeoutError/i.test(text)) {
    return "❌ The download took too long and was cancelled.";
  }
  return "❌ Download failed. Please try again later.";
}