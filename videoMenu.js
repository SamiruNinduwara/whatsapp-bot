import { cached } from "./apiUtils.js";
import { ytDlp } from "./downloadUtils.js";
import { config } from "./config.js";

export const QUALITIES = [240, 360, 480, 720]; // maximum video height
const ICONS = { 240: "📱", 360: "📺", 480: "💻", 720: "🖥️" };
const iconFor = (q) => ICONS[q] || "🎞️";

// ---------- Video details (cached for 30 minutes) ----------
export function getVideoInfo(url) {
  return cached(`vinfo:${url}`, 30 * 60 * 1000, async () => {
    const { stdout } = await ytDlp(["--dump-single-json", url]);
    const j = JSON.parse(stdout);
    return {
      title: j.title || "Video",
      duration: j.duration || 0,
      uploader: j.uploader || j.channel || "",
      thumbnail: j.thumbnail || "",
      formats: (j.formats || []).map((f) => ({
        ext: f.ext || "",
        height: f.height || 0,
        vcodec: f.vcodec || "none",
        acodec: f.acodec || "none",
        size: f.filesize || f.filesize_approx || 0,
        abr: f.abr || 0,
      })),
    };
  });
}

// Which qualities this video really has (up to 720p)
export function pickOptions(info) {
  const heights = info.formats.filter((f) => f.vcodec !== "none" && f.height).map((f) => f.height);
  const maxH = heights.length ? Math.max(...heights) : 0;
  if (!maxH) return [...QUALITIES]; // unknown: offer all of them

  const options = QUALITIES.filter((q) => q <= maxH);
  const top = options[options.length - 1] || 0;
  if (maxH > top && maxH >= 240 && maxH <= 720) options.push(maxH); // e.g. a 576p video
  return options;
}

// Rough file size for a quality (0 = unknown)
export function estimateSize(info, q) {
  const f = info.formats;
  const byHeight = (a, b) => b.height - a.height;

  const audio =
    f
      .filter((x) => x.vcodec === "none" && x.acodec.startsWith("mp4a"))
      .sort((a, b) => b.abr - a.abr)[0] ||
    f.filter((x) => x.vcodec === "none" && x.acodec !== "none").sort((a, b) => b.abr - a.abr)[0];

  // a ready-made mp4 with video and audio together
  const combined = f
    .filter((x) => x.vcodec !== "none" && x.acodec !== "none" && x.ext === "mp4" && x.height && x.height <= q)
    .sort(byHeight)[0];
  if (combined?.size) return combined.size;

  // separate H.264 video + audio that get merged
  const video = f
    .filter((x) => x.vcodec.startsWith("avc1") && x.acodec === "none" && x.height && x.height <= q)
    .sort(byHeight)[0];
  if (video?.size) return video.size + (audio?.size || 0);

  return 0;
}

// ---------- Text helpers ----------
export function fmtSize(bytes) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

function fmtDuration(sec) {
  if (!sec) return "live / unknown";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Text of one poll option, e.g. "📺 360p · ~15 MB"
export const optionLabel = (o) =>
  `${iconFor(o.q)} ${o.q}p${o.size ? ` · ~${fmtSize(o.size)}` : ""}`;

// The card shown above the poll. The qualities are laid out two per line.
export function buildCard(info, platformName, options) {
  const cells = options.map(
    (o) => `${iconFor(o.q)} ${String(o.q).padStart(3)}p ${o.size ? `~${fmtSize(o.size)}` : "—"}`
  );
  const width = Math.max(...cells.map((c) => c.length));

  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    const left = cells[i].padEnd(width);
    rows.push(cells[i + 1] ? `${left} │ ${cells[i + 1]}` : left);
  }

  const title = info.title.replace(/[*_~`]/g, "").slice(0, 80);
  const uploader = info.uploader.replace(/[*_~`]/g, "").slice(0, 30);

  return [
    `🎬 *${title}*`,
    `⏱️ ${fmtDuration(info.duration)}${uploader ? `  •  👤 ${uploader}` : ""}  •  ${platformName}`,
    "",
    "```" + rows.join("\n") + "```",
    "",
    "👇 *Tap a quality in the poll below*",
    "_The menu expires in 10 minutes._",
  ].join("\n");
}

// Sends the card with the thumbnail. If the image upload fails (bad network), sends text only.
let skipThumbUntil = 0;

export async function sendCard(sock, jid, msg, text, thumbnail) {
  const canTry =
    config.showThumbnails !== false &&
    /^https:\/\//i.test(thumbnail || "") &&
    Date.now() > skipThumbUntil;

  if (canTry) {
    try {
      return await sock.sendMessage(jid, { image: { url: thumbnail }, caption: text }, { quoted: msg });
    } catch (err) {
      console.error("Thumbnail send failed, sending text only:", err.message);
      skipThumbUntil = Date.now() + 10 * 60 * 1000; // don't retry for 10 minutes
    }
  }
  return sock.sendMessage(jid, { text }, { quoted: msg });
}