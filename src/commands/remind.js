import { addReminder } from "../reminders.js";

const UNITS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

export default {
  name: "remind",
  aliases: ["reminder"],
  description: "Set Reminder. Use: .remind 10m or anything",
  ownerOnly: false,
  async run({ sock, msg, jid, args }) {
    const match = /^(\d+)([smhd])$/i.exec(args[0] || "");
    const text = args.slice(1).join(" ");

    if (!match || !text) {
      return sock.sendMessage(
        jid,
        { text: "Use: .do remind 10m\n(s = seconds, m = minutes, h = hours, d = days)" },
        { quoted: msg }
      );
    }

    const ms = Number(match[1]) * UNITS[match[2].toLowerCase()];
    if (ms < 5000 || ms > 7 * 86400000) {
      return sock.sendMessage(
        jid,
        { text: "Time eka 5 seconds idan 7 days athara wenna one." },
        { quoted: msg }
      );
    }

    addReminder(jid, text, ms);
    await sock.sendMessage(
      jid,
      { text: `✅ Done! ${args[0]} I'll remind you later..` },
      { quoted: msg }
    );
  },
};