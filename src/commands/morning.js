import { requireAdmin } from "../groupUtils.js";
import { takeCooldown } from "../apiUtils.js";
import { isValidDate } from "../holidays.js";
import {
  TIMEZONE,
  MAX_CHATS,
  parseTime,
  getTime,
  isOn,
  chatCount,
  setTime,
  subscribe,
  unsubscribe,
  sendNow,
} from "../morning.js";

const USAGE =
  "🌅 *Good morning message*\n\n" +
  "Every morning the bot says good morning. On a Poya day or a public holiday it tells you that too.\n\n" +
  ".morning on  ➜ turn it on for this chat\n" +
  ".morning off  ➜ turn it off\n" +
  ".morning now  ➜ send today's message right now (to test)\n" +
  ".morning  ➜ show the settings\n\n" +
  "In a group, only group admins can change it.\n" +

const SUBS = ["on", "off", "now", "status", "time", "help"];

export default {
  name: "morning",
  aliases: ["goodmorning"],
  description: "Daily good morning message with Poya days and holidays (.morning on)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args, isGroup, isOwner } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const sub = (args[0] || "status").toLowerCase();
    if (sub === "help" || !SUBS.includes(sub)) return reply(USAGE);

    // The sending time is the same for every chat, so only the bot owner can change it
    if (sub === "time") {
      if (!isOwner) return reply("⛔ Only the bot owner can change the sending time.");
      const t = parseTime(args[1]);
      if (!t) return reply(`Use: .morning time 06:30  (24-hour clock, ${TIMEZONE} time)`);
      setTime(t);
      return reply(
        `⏰ The good morning message will now be sent at ${t} (${TIMEZONE}).\n` +
          `Chats that already got today's message are not affected.`
      );
    }

    if (sub === "status") {
      return reply(
        isOn(jid)
          ? `🌅 Good morning message: *ON* ✅\n⏰ Every day at ${getTime()} (${TIMEZONE})\n\nTurn it off: .morning off`
          : `🌅 Good morning message: *OFF* ❌\n\nTurn it on: .morning on`
      );
    }

    // In a group, only admins (and the bot owner) can change things
    if (isGroup) {
      const info = await requireAdmin(ctx);
      if (!info) return;
    }

    if (sub === "off") {
      return reply(
        unsubscribe(jid)
          ? "✅ The good morning message is now OFF for this chat."
          : "It was not turned on in this chat."
      );
    }

    if (sub === "on") {
      if (!isOn(jid) && chatCount() >= MAX_CHATS) {
        return reply(
          `⚠️ The bot already sends the good morning message to ${MAX_CHATS} chats (the limit). Ask the bot owner to raise the limit.`
        );
      }
      const { firstIsToday, time } = subscribe(jid);
      return reply(
        `✅ The good morning message is *ON*\n` +
          `⏰ Every day at ${time} (${TIMEZONE})\n` +
          `🗓️ First message: ${firstIsToday ? "today" : "tomorrow"}\n\n` +
          `Try it now: .morning now`
      );
    }

    // sub === "now" (optionally with a date to preview, like .morning now 2026-12-25)
    const wait = takeCooldown("morningnow", jid, 30000);
    if (wait) return reply(`⏳ Please wait ${wait}s before asking again.`);

    const date = args[1];
    if (date && !isValidDate(date)) {
      return reply("Use: .morning now  or  .morning now 2026-12-25  (to preview a day)");
    }
    await sendNow(sock, jid, date || undefined);
  },
};