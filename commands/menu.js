import { config } from "../config.js";
import { sendWithLogo } from "../branding.js";

// Which commands appear under which heading (anything not listed goes under "Other")
const CATEGORIES = {
  "🤖 AI": ["ai", "stt"],
  "🎵 Downloaders": ["mp3", "tiktok", "dl"],
  "🛠️ Tools": ["sticker", "remind"],
  "👥 Group": ["antilink", "welcome", "tagall", "kick", "promote", "demote", "mute", "unmute"],
  "⚙️ General": ["menu", "ping", "owner", "status", "say"],
};

function formatLine(cmd) {
  return `• ${config.prefix}${cmd.name}${cmd.ownerOnly ? " 🔒" : ""}\n   _${cmd.description}_\n`;
}

export default {
  name: "menu",
  aliases: ["help"],
  description: "Show the list of commands",
  ownerOnly: false,
  async run({ sock, msg, jid, commands }) {
    const unique = [...new Set(commands.values())];
    const shown = new Set();

    const header =
      `╭━━〔 👑 *${config.botName} V ${config.version}* 〕━━╮\n` +
      `┃ 👨‍💻 Developer: ${config.developer}\n` +
      `┃ 🔰 Prefix: ${config.prefix}\n` +
      `┃ 📦 Commands: ${unique.length}\n` +
      `╰━━━━━━━━━━━━━━━━━━╯`;

    // Logo + header first (captions have a length limit, so the list is a separate message)
    await sendWithLogo(sock, jid, header, { quoted: msg });

    let body = "";
    for (const [title, names] of Object.entries(CATEGORIES)) {
      const cmds = names.map((n) => commands.get(n)).filter(Boolean);
      if (!cmds.length) continue;
      body += `\n*${title}*\n`;
      for (const cmd of cmds) {
        shown.add(cmd.name);
        body += formatLine(cmd);
      }
    }

    const others = unique.filter((c) => !shown.has(c.name));
    if (others.length) {
      body += `\n*📌 Other*\n`;
      for (const cmd of others) body += formatLine(cmd);
    }

    body += `\n🔒 = owner only`;
    await sock.sendMessage(jid, { text: body.trim() }, { quoted: msg });
  },
};