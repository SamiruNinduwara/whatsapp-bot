<p align="center">
  <img src="assets/logo.jpg" width="220" alt="ASURA BOT">
</p>

<h1 align="center">ASURA BOT V 1.0</h1>

<p align="center">A multi-feature WhatsApp bot made with Node.js and Baileys.<br>
Developer: <b>Samiru Ninduwara</b></p>

## Features

- 🤖 **AI:** chat, voice note to text, photo to text (OCR), translate
- 🎵 **Downloads:** YouTube MP3 / MP4, TikTok, Facebook, direct links (with a cache)
- 🛠️ **Tools:** stickers, reminders, weather, LKR exchange rates, fuel prices, logo maker, photo search
- 👥 **Group tools:** anti-link, welcome messages, tag all, kick, promote, mute
- ⚙️ **Owner tools:** `.update` (pull from GitHub and restart), `.restart`, `.status`, `.cache`

Type `.menu` in WhatsApp to see every command.

## Folder structure

| Path | What it is |
|---|---|
| `index.js` | The bot starts here |
| `src/` | The bot's code |
| `src/commands/` | One file per command (or group of commands) |
| `assets/` | Images (the logo) |
| `tools/` | Small helper scripts |

## Setup

1. Install Node.js 20 or newer (in Termux: `pkg install nodejs git ffmpeg python imagemagick`).
2. Run `npm install`.
3. Create a `.env` file with your keys (see below). Never upload this file.
4. Edit `src/config.js` (owner number, limits).
5. First run: `node index.js 94XXXXXXXXX` and enter the pairing code in WhatsApp (Linked devices).
6. Keep it running with pm2: `pm2 start index.js --name whatsapp-bot`.

Keys used in `.env`: `GEMINI_API_KEY`, `PIXABAY_API_KEY` (optional), `GEMINI_MODEL` (optional).

## Notes

- This bot uses an unofficial WhatsApp library. Use a spare number, because accounts can be banned.
- Downloads are for personal use. Respect copyright and the terms of each website.
