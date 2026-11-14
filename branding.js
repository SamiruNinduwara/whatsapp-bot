import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "assets", "logo.png");
let logo; // undefined = not loaded yet, null = file is missing

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

// Sends the logo with a caption, or plain text if the logo is missing
export function sendWithLogo(sock, jid, text, options = {}) {
  const image = getLogo();
  if (image) {
    return sock.sendMessage(jid, { image, caption: text }, options);
  }
  return sock.sendMessage(jid, { text }, options);
}