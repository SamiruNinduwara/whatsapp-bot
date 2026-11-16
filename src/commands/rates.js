import { cached, getJson, takeCooldown } from "../apiUtils.js";

const RATES_URL = "https://open.er-api.com/v6/latest/USD";

// Currencies shown in the main list (flag emoji for each)
const POPULAR = [
  ["USD", "🇺🇸"],
  ["EUR", "🇪🇺"],
  ["GBP", "🇬🇧"],
  ["AUD", "🇦🇺"],
  ["CAD", "🇨🇦"],
  ["SGD", "🇸🇬"],
  ["INR", "🇮🇳"],
  ["JPY", "🇯🇵"],
  ["AED", "🇦🇪"],
  ["SAR", "🇸🇦"],
  ["QAR", "🇶🇦"],
  ["KWD", "🇰🇼"],
];

// Rates update once a day, so a few hours of caching is plenty (and keeps us under the limits)
function getRates() {
  return cached("rates:USD", 3 * 60 * 60 * 1000, async () => {
    const json = await getJson(RATES_URL);
    if (json.result !== "success" || !json.rates?.LKR) throw new Error("BAD_RATES");
    return json;
  });
}

const fmt = (n) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: n >= 100 ? 2 : 4,
  });

// "100 usd eur" -> { amount: 100, codes: ["USD", "EUR"], hadAmount: true }
function parseArgs(args) {
  const tokens = args.map((a) => a.replace(/,/g, ""));
  let amount = 1;
  let hadAmount = false;
  if (tokens.length && /^\d+(\.\d+)?$/.test(tokens[0])) {
    amount = Number(tokens.shift());
    hadAmount = true;
  }
  return { amount, hadAmount, codes: tokens.map((t) => t.toUpperCase()) };
}

const FOOTER_NOTE =
  "ℹ️ _Indicative market rates, not bank buy/sell rates. Please check with your bank before any transaction._";

export default {
  name: "rates",
  aliases: ["lkr", "rate", "currency", "convert"],
  description: "LKR exchange rates (.rates, .rates 100 usd, .rates 100 usd eur)",
  ownerOnly: false,
  async run({ sock, msg, jid, args, sender }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const wait = takeCooldown("rates", sender, 8000);
    if (wait) return reply(`⏳ Please wait ${wait}s before asking again.`);

    const { amount, hadAmount, codes } = parseArgs(args);

    if (!codes.length && hadAmount) {
      return reply("Use: .rates 100 usd\nOr: .rates 100 usd eur");
    }
    if (codes.length > 2 || codes.some((c) => !/^[A-Z]{3}$/.test(c))) {
      return reply("Use: .rates 100 usd\nCurrency codes have 3 letters, e.g. USD, EUR, GBP, INR.");
    }
    if (amount > 1e12) return reply("❌ That amount is too large.");

    try {
      const data = await getRates();
      const rates = data.rates;
      const updated = (data.time_last_update_utc || "").slice(0, 16);
      const attribution = "_Rates by ExchangeRate-API (exchangerate-api.com)_";

      // 📋 No arguments: the popular list against LKR
      if (!codes.length) {
        let text = `╭━━❮ 💱 *LKR RATES* ❯━━╮\n┃\n┃ 1 unit ➜ Sri Lankan Rupee\n┃\n`;
        for (const [code, flag] of POPULAR) {
          if (!rates[code]) continue;
          text += `┃ ${flag} ${code}  ➜  Rs. ${fmt(rates.LKR / rates[code])}\n`;
        }
        text += `┃\n╰━━━━━━━━━━━━━━━━╯\n\n`;
        text += `🔁 Convert: *.rates 100 usd*\n`;
        text += `📅 Last update: ${updated}\n${FOOTER_NOTE}\n${attribution}`;
        return reply(text);
      }

      // 🔁 Convert: .rates 100 usd  /  .rates 100 usd eur
      const from = codes[0];
      const to = codes[1] || (from === "LKR" ? "USD" : "LKR");

      if (!rates[from] || !rates[to]) {
        return reply("❌ Unknown currency code. Examples: USD, EUR, GBP, INR, AUD, LKR");
      }

      const result = (amount * rates[to]) / rates[from];
      const unitRate = rates[to] / rates[from];

      const text =
        `💱 *Currency converter*\n\n` +
        `*${fmt(amount)} ${from} = ${fmt(result)} ${to}*\n\n` +
        `1 ${from} = ${fmt(unitRate)} ${to}\n` +
        `📅 Last update: ${updated}\n\n` +
        `${FOOTER_NOTE}\n${attribution}`;
      await reply(text);
    } catch (err) {
      console.error("Rates error:", err.message);
      await reply("❌ Couldn't get the exchange rates right now. Please try again later.");
    }
  },
};