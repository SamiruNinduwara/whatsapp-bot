import { FUELS, currentPrices, savePrices, resetPrices } from "../fuelData.js";
import { checkFuelNow } from "../fuelAuto.js";

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const rs = (n) => `Rs. ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const fuel = {
  name: "fuel",
  aliases: ["petrol", "diesel", "fuelprice"],
  description: "Sri Lanka fuel prices (.fuel, or .fuel 20 for the cost of 20 litres)",
  ownerOnly: false,
  async run({ sock, msg, jid, args }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
    const data = currentPrices();

    let litres = 0;
    if (args[0]) {
      litres = Number(args[0].replace(/,/g, ""));
      if (!Number.isFinite(litres) || litres <= 0 || litres > 1000) {
        return reply("Use: .fuel\nOr: .fuel 20  (to see the cost of 20 litres)");
      }
    }

    let text =
      `╭━━❮ ⛽ *FUEL PRICES* ❯━━╮\n┃\n` +
      `┃ 🇱🇰 Ceypetco (CPC), per litre\n` +
      `┃ 📅 Effective: ${fmtDate(data.updated)}\n┃\n`;

    for (const f of FUELS) {
      const price = data.prices[f.key];
      if (price == null) continue;
      text += `┃ ${f.emoji} ${f.name}\n┃      ➜ *${rs(price)}*`;
      if (litres) text += `  (${litres} L = ${rs(price * litres)})`;
      text += `\n`;
    }
    text += `┃\n╰━━━━━━━━━━━━━━━━╯\n\n`;

    // The Lanka IOC / Sinopec note only applies to the built-in November 2026 prices
    if (!data.custom) {
      text +=
        `🏪 *Other stations*\n` +
        `• Lanka IOC: Petrol 92 and Auto Diesel match CPC. Petrol 95 is Rs. 515 (from 5 Nov)\n` +
        `• Sinopec: Petrol 95 is Rs. 515 (other grades may differ)\n\n`;
    } else {
      text += `🏪 Lanka IOC and Sinopec prices can differ slightly from CPC.\n\n`;
    }

    if (data.source === "auto") {
      text += `🔄 _Updated automatically from the CPC website_\n`;
    }
    text += `ℹ️ _Prices are revised monthly (usually at the end of the month). Please check the pump for the final price._`;
    await reply(text);
  },
};

const fuelset = {
  name: "fuelset",
  description: "Owner only: set fuel prices by hand (.fuelset 92=430 date=2026-12-01)",
  ownerOnly: true,
  async run({ sock, msg, jid, args }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if ((args[0] || "").toLowerCase() === "reset") {
      resetPrices();
      return reply("♻️ Fuel prices were reset to the built-in defaults.");
    }

    if (!args.length) {
      return reply(
        "Use: .fuelset 92=430 95=500 ad=400 sd=550 ker=290 date=2026-12-01\n" +
          "Keys: 92, 95, ad (auto diesel), sd (super diesel), ker (kerosene), date\n" +
          "Reset: .fuelset reset"
      );
    }

    const base = currentPrices();
    const prices = { ...base.prices };
    let updated = base.updated;

    for (const pair of args) {
      const [key, value] = pair.toLowerCase().split("=");

      if (key === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
          return reply("❌ The date must look like 2026-12-01");
        }
        updated = value;
      } else if (FUELS.some((f) => f.key === key)) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 50 || n > 3000) {
          return reply(`❌ Invalid price for "${key}".`);
        }
        prices[key] = n;
      } else {
        return reply(`❌ Unknown key "${key.slice(0, 15)}". Use 92, 95, ad, sd, ker or date.`);
      }
    }

    savePrices(updated, prices, "manual");
    await reply("✅ Fuel prices updated. Type .fuel to check.");
  },
};

const fuelcheck = {
  name: "fuelcheck",
  description: "Owner only: check the CPC website for new fuel prices now",
  ownerOnly: true,
  async run({ sock, msg, jid }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });
    await reply("🔎 Checking the CPC website...");

    const r = await checkFuelNow();
    const explain = {
      updated: "✅ New prices found and saved. Type .fuel to see them.",
      same: "✅ The website prices match the saved prices. Nothing to update.",
      stale: "⚠️ The website shows older prices than the saved ones, so they were ignored.",
      no_data: "❌ Couldn't read the prices from the website (the page layout may have changed).",
    };

    let text = `⛽ *Fuel auto-check*\n\n${explain[r.status]}\n`;
    for (const res of r.results) {
      text += `\n📄 ${res.url}\n📅 Date found: ${res.date || "none"}\n`;
      text += FUELS.map((f) => `• ${f.name}: ${res.prices[f.key] ?? "not found"}`).join("\n");
      text += `\n`;
    }
    if (r.errors.length) text += `\n⚠️ Errors:\n${r.errors.join("\n")}`;
    await reply(text.trim());
  },
};

export default [fuel, fuelset, fuelcheck];