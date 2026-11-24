import { requireAdmin, clearCachedMeta, strip } from "../groupUtils.js";
import { takeCooldown } from "../apiUtils.js";
import { config } from "../config.js";

const MAX_NUMBERS = 3; // numbers in one command
const MAX_PER_HOUR = 5; // numbers per group per hour (adding many strangers can get the bot banned)
const HOUR_MS = 60 * 60 * 1000;
const recent = new Map(); // group jid -> times of the latest add attempts

const USAGE =
  "➕ *Add a member*\n\n" +
  ".add 94771234567  ➜ add this number to the group\n" +
  ".add 0771234567  ➜ local numbers work too\n" +
  ".add 0771111111, 0772222222  ➜ up to 3 numbers (separate them with commas)\n\n" +
  "Only group admins can use it, and the bot must be an admin too.\n" +
  "Please add only people who want to join.";

// "0771234567", "+94 77 123 4567", "94-77-1234567" -> "94771234567" (or null if it is not a number)
function cleanNumber(text) {
  const countryCode = String(config.defaultCountryCode || "").replace(/\D/g, "");
  let digits = String(text).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // 0094... -> 94...
  else if (digits.startsWith("0") && countryCode) digits = countryCode + digits.slice(1);
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

// Finds the numbers in the text. Commas separate numbers; spaces inside one number are fine.
function parseNumbers(text) {
  let pieces = text.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  if (pieces.length === 1 && !cleanNumber(pieces[0])) {
    pieces = pieces[0].split(/\s+/); // "9477... 9477..." (separated by spaces only)
  }
  const numbers = pieces.map(cleanNumber);
  return { numbers: [...new Set(numbers.filter(Boolean))], invalid: numbers.filter((n) => !n).length };
}

export default {
  name: "add",
  aliases: ["invite"],
  description: "Group admin: add a number to this group (.add 94771234567)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, msg, jid, args, sender } = ctx;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    // Checks: this is a group, the sender is an admin (or the owner), and the bot is an admin
    const info = await requireAdmin(ctx, true);
    if (!info) return;

    const { numbers, invalid } = parseNumbers(args.join(" "));
    if (!numbers.length) {
      return reply(invalid ? `❌ That doesn't look like a phone number.\n\n${USAGE}` : USAGE);
    }
    if (numbers.length > MAX_NUMBERS) {
      return reply(`❌ Please add at most ${MAX_NUMBERS} numbers at a time.`);
    }

    const wait = takeCooldown("add", sender, 10000);
    if (wait) return reply(`⏳ Please wait ${wait}s before adding again.`);

    // Hourly limit per group
    const now = Date.now();
    const used = (recent.get(jid) || []).filter((t) => now - t < HOUR_MS);
    if (used.length + numbers.length > MAX_PER_HOUR) {
      return reply(
        `⏳ To keep the bot safe, only ${MAX_PER_HOUR} numbers can be added per hour in a group. Please try again later.`
      );
    }

    const lines = [];

    // Which numbers are on WhatsApp? (if this check fails, we just try to add them)
    let toAdd = numbers;
    try {
      const found = await sock.onWhatsApp(...numbers.map((n) => `${n}@s.whatsapp.net`));
      const exists = new Set(
        (found || []).filter((f) => f.exists).map((f) => strip(f.jid))
      );
      if (found && found.length) {
        toAdd = numbers.filter((n) => exists.has(n));
        for (const n of numbers.filter((x) => !exists.has(x))) {
          lines.push(`❌ +${n} is not on WhatsApp`);
        }
      }
    } catch {
      // keep going
    }

    if (toAdd.length) {
      recent.set(jid, [...used, ...toAdd.map(() => now)]);

      let results;
      try {
        results = await sock.groupParticipantsUpdate(jid, toAdd.map((n) => `${n}@s.whatsapp.net`), "add");
      } catch (err) {
        console.error("Add error:", err.message);
        return reply("❌ WhatsApp didn't let me add them. Please try again later.");
      }

      for (const [i, r] of (results || []).entries()) {
        const number = toAdd.find((n) => strip(r.jid) === n) || toAdd[i] || strip(r.jid);
        const status = String(r.status);
        console.log(`[add] ...${String(number).slice(-4)} -> ${status}`);

        if (status === "200") {
          lines.push(`✅ +${number} was added`);
        } else if (status === "409") {
          lines.push(`ℹ️ +${number} is already in the group`);
        } else if (status === "403") {
          // Their privacy settings don't allow being added: send them the group link privately
          try {
            const code = await sock.groupInviteCode(jid);
            await sock.sendMessage(`${number}@s.whatsapp.net`, {
              text: `👋 You were invited to join *${info.meta.subject}*:\nhttps://chat.whatsapp.com/${code}`,
            });
            lines.push(`🔒 +${number}'s privacy settings don't allow being added. I sent them the group link privately.`);
          } catch {
            lines.push(`🔒 +${number}'s privacy settings don't allow being added. Send them the group link instead.`);
          }
        } else if (status === "408") {
          lines.push(`⚠️ +${number} left the group recently and can't be added right now`);
        } else if (status === "401") {
          lines.push(`⚠️ +${number} can't be added (they may have blocked this number)`);
        } else {
          lines.push(`❌ +${number} couldn't be added (code ${status})`);
        }
      }

      clearCachedMeta(jid); // the member list changed
    }

    await reply(`➕ *Add members*\n\n${lines.join("\n") || "Nothing to add."}`);
  },
};