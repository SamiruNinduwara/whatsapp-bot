import { requireAdmin } from "../groupUtils.js";
import { takeCooldown } from "../apiUtils.js";
import {
  TIMEZONE,
  DEFAULT_CITY,
  MAX_CHATS,
  parseTime,
  getTime,
  getChat,
  chatCount,
  setTime,
  subscribe,
  setCity,
  unsubscribe,
  geocode,
  sendNow,
} from "../morning.js";

const USAGE =
  "🌅 *Daily morning message*\n\n" +
  "Every morning the bot sends the weather, LKR exchange rates.\n\n" +
  ".morning on Kandy  ➜ turn it on for this chat (pick your city)\n" +
  ".morning off  ➜ turn it off\n" +
  ".morning city Galle  ➜ change the city\n" +
  ".morning now  ➜ send it right now (to test)\n" +
  ".morning  ➜ show the settings\n\n" +
  "In a group, only group admins can change it.";

// Keeps letters, numbers and normal punctuation only
const cleanCity = (text) =>
  String(text || "")
    .replace(/[\u0000-\u001f<>*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

const SUBS = ["on", "off", "city", "now", "status", "time", "help"];

export default {
  name: "morning",
  aliases: ["daily"],
  description: "Daily morning message with weather, rates (.morning on Kandy)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args, isGroup, isOwner } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const sub = (args[0] || "status").toLowerCase();
    const rest = cleanCity(args.slice(1).join(" "));

    if (sub === "help" || !SUBS.includes(sub)) return reply(USAGE);

    // The sending time is the same for every chat, so only the bot owner can change it
    if (sub === "time") {
      if (!isOwner) return reply("⛔ Only the bot owner can change the sending time.");
      const t = parseTime(args[1]);
      if (!t) return reply(`Use: .morning time 06:30  (24-hour clock, ${TIMEZONE} time)`);
      setTime(t);
      return reply(
        `⏰ The morning message will now be sent at ${t} (${TIMEZONE}).\n` +
          `Chats that already got today's message are not affected.`
      );
    }

    if (sub === "status") {
      const chat = getChat(jid);
      return reply(
        chat
          ? `🌅 Daily morning message: *ON* ✅\n📍 City: ${chat.city}\n⏰ Time: ${getTime()} (${TIMEZONE})\n\nTurn it off: .morning off`
          : `🌅 Daily morning message: *OFF* ❌\n\nTurn it on: .morning on Kandy`
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
          ? "✅ Daily morning message is now OFF for this chat."
          : "It was not turned on in this chat."
      );
    }

    if (sub === "on") {
      const existing = getChat(jid);
      if (!existing && chatCount() >= MAX_CHATS) {
        return reply(
          `⚠️ The bot already sends the morning message to ${MAX_CHATS} chats (the limit). Ask the bot owner to raise the limit.`
        );
      }

      const city = rest || existing?.city || DEFAULT_CITY;
      let place;
      try {
        place = await geocode(city);
      } catch {
        return reply("❌ Couldn't check that city right now. Please try again later.");
      }
      if (!place) return reply(`😕 I couldn't find "${city}". Try a different spelling.`);

      const { firstIsToday, time } = subscribe(jid, city);
      return reply(
        `✅ Daily morning message is *ON*\n` +
          `📍 ${place.name}${place.country ? `, ${place.country}` : ""}\n` +
          `⏰ Every day at ${time} (${TIMEZONE})\n` +
          `🗓️ First message: ${firstIsToday ? "today" : "tomorrow"}\n\n` +
          `Try it now: .morning now`
      );
    }

    if (sub === "city") {
      if (!getChat(jid)) return reply("Turn it on first: .morning on Kandy");
      if (!rest) return reply("Use: .morning city Galle");

      let place;
      try {
        place = await geocode(rest);
      } catch {
        return reply("❌ Couldn't check that city right now. Please try again later.");
      }
      if (!place) return reply(`😕 I couldn't find "${rest}". Try a different spelling.`);

      setCity(jid, rest);
      return reply(`✅ City changed to ${place.name}${place.country ? `, ${place.country}` : ""}.`);
    }

    // sub === "now"
    const wait = takeCooldown("morningnow", jid, 60000);
    if (wait) return reply(`⏳ Please wait ${wait}s before asking again.`);

    const city = rest || getChat(jid)?.city || DEFAULT_CITY;
    await reply("🌅 Getting the morning update...");
    try {
      await sendNow(sock, jid, city);
    } catch (err) {
      console.error("Morning now error:", err.message);
      await reply("❌ Couldn't get the update right now. Please try again later.");
    }
  },
};