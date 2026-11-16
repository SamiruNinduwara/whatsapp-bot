import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "assets", "logo.jpg");
let logo; // undefined = not loaded yet, null = file is missing
let skipLogoUntil = 0; // after a failed upload, skip the logo for a while

// Returns the logo as a Buffer (read once and cached), or null if missing
export function getLogo() {
  if (logo === undefined) {
    try {
      logo = fs.readFileSync(LOGO_PATH);
    } catch {
      logo = null;
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
      console.error("Logo upload failed, sending text only:", err.message);
      skipLogoUntil = Date.now() + 10 * 60 * 1000; // don't retry for 10 minutes
    }
  }

  return sock.sendMessage(jid, { text }, options);
}