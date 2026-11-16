import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";

const exec = promisify(execFile);
const SIZE = 800;

// ---------- Styles ----------
// kind "glow": solid text with a coloured glow. kind "gradient": gradient-filled text with a glow.
export const STYLES = {
  1: { name: "Neon Purple", kind: "glow", bg: ["#3b0a6e", "#07010f"], glow: "#b44dff", text: "#ffffff", line: "#b44dff", sub: "#e9d5ff" },
  2: { name: "Gold", kind: "gradient", bg: ["#2e2e2e", "#050505"], grad: ["#fff3b0", "#c9860b"], glow: "#d4a017", line: "#d4a017", sub: "#f3e2a0" },
  3: { name: "Fire", kind: "gradient", bg: ["#3d0600", "#0a0000"], grad: ["#fff176", "#ff3d00"], glow: "#ff5722", line: "#ff5722", sub: "#ffd0b0" },
  4: { name: "Ice", kind: "glow", bg: ["#0b3a5c", "#020a14"], glow: "#38bdf8", text: "#ffffff", line: "#38bdf8", sub: "#bae6fd" },
  5: { name: "Emblem", kind: "emblem", bg: ["#1e1b4b", "#050510"], ring: "#ffffff", fill: ["#a855f7", "#2563eb"], text: "#ffffff", sub: "#c7d2fe" },
  6: { name: "Minimal", kind: "minimal", bg: ["#ffffff", "#ffffff"], text: "#111111", line: "#7c3aed", sub: "#555555" },
};

// ---------- ImageMagick ----------
let magickCmd;
async function findMagick() {
  if (magickCmd) return magickCmd;
  for (const cmd of ["magick", "convert"]) {
    try {
      await exec(cmd, ["-version"], { timeout: 5000 });
      magickCmd = cmd;
      return cmd;
    } catch {
      // try the next name
    }
  }
  throw Object.assign(new Error("NO_MAGICK"), { code: "NO_MAGICK" });
}

const run = async (args) => exec(await findMagick(), args, { timeout: 60000 });

// ---------- Fonts ----------
// Looks for a bold font on the phone (Android keeps its fonts in /system/fonts)
const FONT_PREFERENCE = [
  /^Roboto-Black\.ttf$/i,
  /^Roboto-Bold\.ttf$/i,
  /^RobotoStatic-Bold\.ttf$/i,
  /^Roboto-Medium\.ttf$/i,
  /^Roboto-Regular\.ttf$/i,
  /^Roboto\[.*\]\.ttf$/i,
  /^DroidSans-Bold\.ttf$/i,
  /^NotoSans-Bold\.ttf$/i,
  /^NotoSans-Regular\.ttf$/i,
  /^Poppins-Bold\.ttf$/i,
  /^DejaVuSans-Bold\.ttf$/i,
  /^DejaVuSans\.ttf$/i,
  /bold.*\.ttf$/i,
];

let fontCache;
export function findFont(configured) {
  if (configured && fs.existsSync(configured)) return configured;
  if (fontCache) return fontCache;

  const dirs = [
    "/system/fonts",
    "/system/font",
    "/data/fonts",
    path.join(process.env.PREFIX || "/usr", "share", "fonts"),
    "/usr/share/fonts/truetype/google-fonts",
    "/usr/share/fonts/truetype/dejavu",
  ];

  for (const pattern of FONT_PREFERENCE) {
    for (const dir of dirs) {
      try {
        const hit = fs.readdirSync(dir).find((f) => pattern.test(f));
        if (hit) return (fontCache = path.join(dir, hit));
      } catch {
        // folder does not exist
      }
    }
  }
  throw Object.assign(new Error("NO_FONT"), { code: "NO_FONT" });
}

// ---------- Text ----------
// Only plain characters are allowed: ImageMagick treats "@", "%" and "\" in text as special.
export function cleanText(text, max) {
  return String(text || "")
    .replace(/[^A-Za-z0-9 &.\-_'!+]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const hasNonLatin = (text) => /[^\x00-\x7F]/.test(String(text || ""));

// A text image: transparent background, fixed size, text centred
const label = (font, color, w, h, text) => [
  "-size", `${w}x${h}`, "-background", "none", "-font", font, "-fill", color,
  "-gravity", "center", `label:${text}`, "-extent", `${w}x${h}`, "+repage",
];

// Adds a coloured glow around everything on the (single) image in the list
const glow = (color, strong = true) => [
  "(", "+clone", "-background", color, "-shadow", "100x26+0+0", ")", "+swap",
  "-background", "none", "-layers", "merge", "+repage",
  ...(strong
    ? ["(", "+clone", "-background", color, "-shadow", "80x8+0+0", ")", "+swap",
       "-background", "none", "-layers", "merge", "+repage"]
    : []),
];

// ---------- Building blocks ----------
async function makeBackground(file, style) {
  const [inner, outer] = style.bg;
  if (inner === outer) {
    await run(["-size", `${SIZE}x${SIZE}`, `xc:${inner}`, "-type", "TrueColor", file]);
  } else {
    await run(["-size", `${SIZE}x${SIZE}`, `radial-gradient:${inner}-${outer}`, "-type", "TrueColor", file]);
  }
}

// The big name, either solid with a glow or filled with a gradient
async function makeTitle(file, style, font, text, W = 720, H = 260) {
  if (style.kind === "gradient") {
    const maskFile = file + ".mask.png";
    await run([...label(font, "white", W, H, text), maskFile]);
    await run([
      "-size", `${W}x${H}`, `gradient:${style.grad[0]}-${style.grad[1]}`, "-alpha", "set",
      maskFile, "-compose", "DstIn", "-composite", "-compose", "Over",
      ...glow(style.glow, false),
      file,
    ]);
    await fsp.rm(maskFile, { force: true });
    return;
  }

  await run([...label(font, style.text, W, H, text), ...glow(style.glow), file]);
}

async function makeSubtitle(file, style, font, text) {
  await run([...label(font, style.sub, 640, 60, text), file]);
}

// ---------- Text logos ----------
async function textLogo({ text, tagline, style, font, dir, out }) {
  const bg = path.join(dir, "bg.png");
  const title = path.join(dir, "title.png");
  await makeBackground(bg, style);
  await makeTitle(title, style, font, text);

  const args = [bg];
  const hasTag = !!tagline;

  // frame and two thin lines
  args.push(
    "-fill", "none", "-stroke", style.line, "-strokewidth", "4",
    "-draw", "roundrectangle 34,34 766,766 36,36",
    "-strokewidth", "3",
    "-draw", `line 200,${hasTag ? 215 : 235} 600,${hasTag ? 215 : 235}`,
    "-draw", `line 200,${hasTag ? 625 : 565} 600,${hasTag ? 625 : 565}`,
    "-stroke", "none"
  );

  args.push(title, "-gravity", "center", "-geometry", `+0${hasTag ? "-30" : "+0"}`, "-composite");

  if (hasTag) {
    const sub = path.join(dir, "sub.png");
    await makeSubtitle(sub, style, font, tagline);
    args.push(sub, "-gravity", "center", "-geometry", "+0+175", "-composite");
  }

  await run([...args, "-type", "TrueColor", "-quality", "90", out]);
}

// ---------- Emblem (circle with the initials) ----------
async function emblemLogo({ text, tagline, style, font, dir, out }) {
  const bg = path.join(dir, "bg.png");
  const disc = path.join(dir, "disc.png");
  const initials = path.join(dir, "initials.png");
  const title = path.join(dir, "title.png");
  await makeBackground(bg, style);

  // gradient disc
  const D = 400;
  await run([
    "-size", `${D}x${D}`, `gradient:${style.fill[0]}-${style.fill[1]}`, "-alpha", "set",
    "(", "-size", `${D}x${D}`, "xc:none", "-fill", "white", "-draw", `circle ${D / 2},${D / 2} ${D / 2},2`, ")",
    "-compose", "DstIn", "-composite", "-compose", "Over",
    disc,
  ]);

  // up to two initials
  const letters =
    text
      .split(" ")
      .map((w) => (w.match(/[A-Za-z0-9]/) || [""])[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";

  await run([
    ...label(font, style.text, 300, 200, letters),
    "(", "+clone", "-background", "#00000088", "-shadow", "60x6+3+3", ")", "+swap",
    "-background", "none", "-layers", "merge", "+repage",
    initials,
  ]);

  await run([...label(font, style.text, 700, 120, text), title]);

  const args = [
    bg,
    disc, "-gravity", "center", "-geometry", "+0-110", "-composite",
    "-fill", "none", "-stroke", style.ring, "-strokewidth", "10",
    "-draw", `circle 400,290 400,${290 - D / 2 - 8}`,
    "-stroke", "none",
    initials, "-gravity", "center", "-geometry", "+0-110", "-composite",
    title, "-gravity", "center", "-geometry", "+0+190", "-composite",
  ];

  if (tagline) {
    const sub = path.join(dir, "sub.png");
    await makeSubtitle(sub, style, font, tagline);
    args.push(sub, "-gravity", "center", "-geometry", "+0+275", "-composite");
  }
  await run([...args, "-type", "TrueColor", "-quality", "90", out]);
}

// ---------- Minimal (white) ----------
async function minimalLogo({ text, tagline, style, font, dir, out }) {
  const bg = path.join(dir, "bg.png");
  const title = path.join(dir, "title.png");
  await makeBackground(bg, style);
  await run([...label(font, style.text, 720, 260, text), title]);

  const args = [
    bg,
    title, "-gravity", "center", "-geometry", `+0${tagline ? "-40" : "+0"}`, "-composite",
    "-fill", style.line, "-draw", `roundrectangle 330,${tagline ? 460 : 500} 470,${tagline ? 470 : 510} 5,5`,
  ];
  if (tagline) {
    const sub = path.join(dir, "sub.png");
    await makeSubtitle(sub, style, font, tagline);
    args.push(sub, "-gravity", "center", "-geometry", "+0+130", "-composite");
  }
  await run([...args, "-type", "TrueColor", "-quality", "90", out]);
}

// ---------- Photo logo (circle photo with a glowing ring) ----------
async function photoLogo({ text, tagline, style, font, dir, out, photo }) {
  const palette = style.kind === "glow" || style.kind === "gradient" ? style : STYLES[1];
  const ringColor = palette.glow;
  const bg = path.join(dir, "bg.png");
  const ring = path.join(dir, "ring.png");
  const circle = path.join(dir, "circle.png");
  await makeBackground(bg, palette);

  // the photo as a circle
  const D = 460;
  await run([
    photo, "-auto-orient", "-thumbnail", `${D}x${D}^`, "-gravity", "center", "-extent", `${D}x${D}`, "+repage", "-alpha", "set",
    "(", "-size", `${D}x${D}`, "xc:none", "-fill", "white", "-draw", `circle ${D / 2},${D / 2} ${D / 2},1`, ")",
    "-compose", "DstIn", "-composite", "-compose", "Over",
    circle,
  ]);

  // glowing ring
  const cy = tagline ? 290 : text ? 320 : 400;
  await run([
    "-size", `${SIZE}x${SIZE}`, "xc:none", "-fill", "none", "-stroke", ringColor, "-strokewidth", "12",
    "-draw", `circle 400,${cy} 400,${cy - D / 2 - 14}`,
    ...glow(ringColor, true),
    ring,
  ]);

  const args = [bg, ring, "-gravity", "center", "-composite", circle, "-gravity", "center", "-geometry", `+0${cy - 400}`, "-composite"];

  if (text) {
    const title = path.join(dir, "title.png");
    await makeTitle(title, palette, font, text, 700, 140);
    args.push(title, "-gravity", "center", "-geometry", `+0+${tagline ? 240 : 255}`, "-composite");
  }
  if (tagline) {
    const sub = path.join(dir, "sub.png");
    await makeSubtitle(sub, palette, font, tagline);
    args.push(sub, "-gravity", "center", "-geometry", "+0+338", "-composite");
  }
  await run([...args, "-type", "TrueColor", "-quality", "90", out]);
}

// ---------- Main ----------
// Returns the finished picture (a JPEG Buffer). All the temporary files are deleted.
export async function makeLogo({ text, tagline = "", style = 1, photoBuffer = null, fontPath }) {
  const font = findFont(fontPath);
  const st = STYLES[style] || STYLES[1];
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "logo_"));
  const out = path.join(dir, "logo.jpg");

  try {
    const base = { text, tagline, style: st, font, dir, out };

    if (photoBuffer) {
      const photo = path.join(dir, "photo.img");
      await fsp.writeFile(photo, photoBuffer);
      await photoLogo({ ...base, photo });
    } else if (st.kind === "emblem") {
      await emblemLogo(base);
    } else if (st.kind === "minimal") {
      await minimalLogo(base);
    } else {
      await textLogo(base);
    }

    return await fsp.readFile(out);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}