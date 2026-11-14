import { config } from "../config.js";

export default {
  name: "menu",
  aliases: ["help"],
  description: "Commands list",
  ownerOnly: false,
  async run({ sock, msg, jid, commands }) {
    const seen = new Set();
    let text = `*${config.botName}* 🤖\n\n`;
    for (const cmd of commands.values()) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      text += `${config.prefix}${cmd.name}${cmd.ownerOnly ? " 🔒" : ""} - ${cmd.description}\n`;
    }
    text += `\n🔒 = owner only`;
    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};