import { config } from "../config.js";
import { sendWithLogo } from "../branding.js";

// Each tab is one "page" of the menu.
// Commands that are not listed here appear under an automatic "Other" tab.
const TABS = [
  { key: "ai", emoji: "🤖", title: "AI", commands: ["ai", "stt"] },
  { key: "dl", emoji: "🎵", title: "Downloaders", commands: ["mp3", "mp4", "tiktok", "dl"] },
  { key: "tools", emoji: "🛠️", title: "Tools", commands: ["sticker", "remind", "weather", "rates"] },
  {
    key: "group",
    emoji: "👥",
    title: "Group",
    commands: ["antilink", "welcome", "tagall", "kick", "promote", "demote", "mute", "unmute"],
  },
  {
    key: "general",
    emoji: "⚙️",
    title: "General",
    commands: ["menu", "cmd", "ping", "owner", "status", "say"],
  },
];

const NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const num = (i) => NUMBERS[i] || `${i + 1}.`;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

// Builds the tab list from the loaded commands
export function buildTabs(commands) {
  const unique = [...new Set(commands.values())];
  const used = new Set();

  const tabs = TABS.map((tab) => {
    const cmds = tab.commands.map((name) => commands.get(name)).filter(Boolean);
    cmds.forEach((c) => used.add(c.name));
    return { ...tab, cmds };
  }).filter((tab) => tab.cmds.length);

  const others = unique.filter((c) => !used.has(c.name));
  if (others.length) {
    tabs.push({ key: "other", emoji: "📌", title: "Other", cmds: others });
  }

  return { tabs, total: unique.length };
}

function renderTabList(tabs) {
  let text = `╭━━❮ 📂 *MENU TABS* ❯━━╮\n┃\n`;
  tabs.forEach((tab, i) => {
    text += `┃ ${num(i)} ${tab.emoji} *${tab.title}* (${tab.cmds.length})\n`;
    text += `┃      ➜ ${config.prefix}menu ${tab.key}\n`;
  });
  text += `┃ ${num(tabs.length)} 📜 *All commands*\n`;
  text += `┃      ➜ ${config.prefix}cmd\n┃\n`;
  text += `╰━━━━━━━━━━━━━━━━╯\n\n`;
  text += `💡 _Tip: you can use a number too, e.g._ *${config.prefix}menu 2*`;
  return text;
}

export function renderTab(tab) {
  let text = `╭━━━❮ ${tab.emoji} *${tab.title.toUpperCase()}* ❯━━━╮\n┃\n`;
  for (const cmd of tab.cmds) {
    text += `┃ ✦ *${config.prefix}${cmd.name}*${cmd.ownerOnly ? " 🔒" : ""}\n`;
    text += `┃    ╰ _${cmd.description}_\n`;
  }
  text += `┃\n╰━━━━━━━━━━━━━━━━━━━━╯`;
  return text;
}

// "◀️ previous   🏠 home   next ▶️" shortcuts
function renderNavigation(index, tabs) {
  const prev = tabs[index - 1];
  const next = tabs[index + 1];
  const parts = [];
  if (prev) parts.push(`◀️ ${config.prefix}menu ${prev.key}`);
  parts.push(`🏠 ${config.prefix}menu`);
  if (next) parts.push(`${config.prefix}menu ${next.key} ▶️`);
  return parts.join("   ");
}

// Finds a tab by number, key or title
function findTab(tabs, arg) {
  const n = Number(arg);
  if (Number.isInteger(n) && n >= 1 && n <= tabs.length) return n - 1;
  return tabs.findIndex((t) => t.key === arg || t.title.toLowerCase() === arg);
}

export default {
  name: "menu",
  aliases: ["help"],
  description: "Show the command menu (.menu ai, .menu 2)",
  ownerOnly: false,
  async run({ sock, msg, jid, args, commands }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
    const { tabs, total } = buildTabs(commands);
    const arg = (args[0] || "").toLowerCase();

    // 🏠 Home: logo + info card + tab list
    if (!arg) {
      const name = msg.pushName || "there";
      const header =
        `╭━━━━〔 👑 *${config.botName} V ${config.version}* 〕━━━━╮\n` +
        `┃ 👋 ${greeting()}, *${name}*!\n` +
        `┃\n` +
        `┃ 👨‍💻 Developer : ${config.developer}\n` +
        `┃ 🔰 Prefix : ${config.prefix}\n` +
        `┃ 📦 Commands : ${total}\n` +
        `┃ ⏱️ Uptime : ${formatUptime(process.uptime())}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

      const caption =
        `${header}\n\n${renderTabList(tabs)}\n\n_© ${config.botName} • ${config.developer}_`;
      return sendWithLogo(sock, jid, caption, { quoted: msg });
    }

    // 📜 All commands (same as .cmd)
    if (arg === "all" || arg === String(tabs.length + 1)) {
      const text = tabs.map(renderTab).join("\n\n") + `\n\n🔒 = owner only\n🏠 ${config.prefix}menu`;
      return reply(text);
    }

    // 📂 One tab
    const index = findTab(tabs, arg);
    if (index === -1) {
      return reply(`❌ Unknown tab "${arg.slice(0, 20)}".\n\n${renderTabList(tabs)}`);
    }

    const text =
      `${renderTab(tabs[index])}\n\n` +
      `${renderNavigation(index, tabs)}\n\n` +
      `🔒 = owner only`;
    return reply(text);
  },
};