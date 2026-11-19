import {
  TIMEZONE,
  todayKey,
  shortDate,
  isValidDate,
  holidaysOn,
  upcoming,
  lastHolidayDate,
  addHoliday,
  removeHoliday,
  resetHolidays,
} from "../holidays.js";

const icon = (h) => (h.type === "poya" ? "🌕" : "🎉");

const describe = (h) =>
  `${icon(h)} ${h.name}${h.type === "holiday" && h.merc ? " (mercantile)" : ""}`;

const OWNER_USAGE =
  "Owner commands:\n" +
  ".holiday add 2028-01-13 poya Duruthu Full Moon Poya Day\n" +
  ".holiday add 2028-02-04 merc Independence Day\n" +
  ".holiday add 2028-03-01 holiday Special Bank Holiday\n" +
  ".holiday remove 2028-03-01\n" +
  ".holiday reset  ➜ back to the built-in list\n" +
  "(types: poya, holiday, merc = holiday that is also a mercantile holiday)";

export default {
  name: "holiday",
  aliases: ["holidays", "poya"],
  description: "Sri Lanka Poya days and public holidays (.holiday)",
  ownerOnly: false,
  async run({ sock, msg, jid, args, isOwner }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
    const sub = (args[0] || "").toLowerCase();
    const today = todayKey();

    // ----- owner: change the list -----
    if (["add", "remove", "reset"].includes(sub)) {
      if (!isOwner) return reply("⛔ Only the bot owner can change the holiday list.");

      if (sub === "reset") {
        resetHolidays();
        return reply("♻️ The holiday list is back to the built-in list.");
      }

      const date = args[1];
      if (!isValidDate(date)) return reply(`Use a date like 2028-01-13\n\n${OWNER_USAGE}`);

      if (sub === "remove") {
        return reply(
          removeHoliday(date)
            ? `✅ Removed the holiday(s) on ${date}.`
            : `There is nothing on ${date}.`
        );
      }

      // sub === "add"
      const kind = (args[2] || "").toLowerCase();
      const name = args
        .slice(3)
        .join(" ")
        .replace(/[\u0000-\u001f*_~`]/g, "")
        .trim()
        .slice(0, 60);
      if (!["poya", "holiday", "merc"].includes(kind) || !name) {
        return reply(`Use: .holiday add 2028-01-13 poya Duruthu Full Moon Poya Day\n\n${OWNER_USAGE}`);
      }
      addHoliday(date, kind, name);
      return reply(`✅ Added: ${shortDate(date)}, ${name}`);
    }

    // ----- everyone: see the holidays -----
    const todays = holidaysOn(today);
    const next = upcoming(today, 6);

    let text = `📅 *Sri Lanka holidays*\n\n`;
    text += todays.length
      ? `Today: ${todays.map(describe).join(", ")}\n\n`
      : `Today (${shortDate(today)}) is a normal day.\n\n`;

    if (next.length) {
      text += `*Coming up*\n` + next.map((h) => `• ${shortDate(h.date)}\n   ${describe(h)}`).join("\n");
    } else {
      text += `No holidays are saved after today.`;
    }

    const last = lastHolidayDate();
    text += `\n\n_List covers dates until ${last || "—"}. Times use ${TIMEZONE}._`;
    if (isOwner) text += `\n\n${OWNER_USAGE}`;
    await reply(text);
  },
};