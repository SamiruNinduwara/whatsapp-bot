import { config } from "../config.js";
import { buildTabs, renderTab } from "./menu.js";

export default {
  name: "cmd",
  aliases: ["commands", "cmds"],
  description: "Show every command in one list",
  ownerOnly: false,
  async run({ sock, msg, jid, commands }) {
    const { tabs, total } = buildTabs(commands);

    const header =
      `╭━━━〔 📜 *ALL COMMANDS* 〕━━━╮\n` +
      `┃ 👑 ${config.botName} V ${config.version}\n` +
      `┃ 📦 Total : ${total}\n` +
      `┃ 🔰 Prefix : ${config.prefix}\n` +
      `╰━━━━━━━━━━━━━━━━━━━╯`;

    const body = tabs.map(renderTab).join("\n\n");
    const footer =
      `🔒 = owner only\n` +
      `📂 ${config.prefix}menu (tabs)  •  👨‍💻 ${config.developer}`;

    await sock.sendMessage(
      jid,
      { text: `${header}\n\n${body}\n\n${footer}` },
      { quoted: msg }
    );
  },
};