import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The logo lives in the project's assets folder (src/ is one level below the project folder).
// Several places are tried, so a moved folder cannot silently break the logo.
const CANDIDATES = [
  path.join(__dirname, "..", "assets", "logo.jpg"),
  path.join(__dirname, "assets", "logo.jpg"),
  path.resolve("assets", "logo.jpg"),
];

let logo; // undefined = not loaded yet, null = file is missing
let skipLogoUntil = 0; // after a failed upload, skip the logo for a short time

// Returns the logo as a Buffer (read once and cached), or null if it can't be found
export function getLogo() {
  if (logo === undefined) {
    logo = null;
    for (const file of CANDIDATES) {
      try {
        logo = fs.readFileSync(file);
        console.log(`[branding] logo loaded from ${file} (${Math.round(logo.length / 1024)} KB)`);
        break;
      } catch {
        // try the next place
      }
    }
    if (!logo) {
      console.warn(`[branding] logo.jpg was NOT found. Looked in:\n  ${CANDIDATES.join("\n  ")}`);
    }
  }
  return logo;
}

// Sends the logo with a caption. If the logo is off, missing, or the upload fails
// (bad network), it sends plain text instead, so commands never break.
export async function sendWithLogo(sock, jid, text, options = {}) {
  const image = config.useLogo === false ? null : getLogo();

  if (image && Date.now() > skipLogoUntil) {
    try {
      return await sock.sendMessage(jid, { image, caption: text }, options);
    } catch (err) {
      console.error("[branding] logo upload failed, sending text only:", err.message);
      skipLogoUntil = Date.now() + 2 * 60 * 1000; // try the logo again after 2 minutes
    }
  }

  return sock.sendMessage(jid, { text }, options);
}

getLogo(); // load it when the bot starts, so the log shows right away if something is wrong