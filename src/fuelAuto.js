import { config } from "./config.js";
import { FUELS, currentPrices, savePrices } from "./fuelData.js";

// Pages that show the current CPC prices (the newest result wins)
const PAGES = [
  "https://ceypetco.gov.lk/marketing-sales/",
  "https://ceypetco.gov.lk/?p=6482",
];

const PRODUCTS = {
  "92": "(?:Lanka\\s+)?Petrol\\s+92\\s+Octane",
  "95": "(?:Lanka\\s+)?Petrol\\s+95\\s+Octane",
  ad: "(?:Lanka\\s+)?Auto\\s+Diesel",
  sd: "(?:Lanka\\s+)?Super\\s+Diesel",
  ker: "(?:Lanka\\s+)?Kerosene",
};

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

// Finds "<product> ... Rs. 398.00 per Ltr ... Effect from: 21-03-2026" for every fuel type
export function parseCpcPage(html) {
  const text = htmlToText(html);
  const prices = {};
  const missing = [];
  const dates = [];

  for (const [key, pattern] of Object.entries(PRODUCTS)) {
    const regex = new RegExp(
      `${pattern}[\\s\\S]{0,80}?Rs\\.?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(?:per|/)\\s*(?:Ltr|Litre|L)\\b`,
      "i"
    );
    const m = regex.exec(text);
    if (!m) {
      missing.push(key);
      continue;
    }

    const price = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(price) || price < 50 || price > 3000) {
      missing.push(key);
      continue;
    }
    prices[key] = price;

    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 120);
    const d = /Effect\s*from:?\s*(\d{1,2})-(\d{1,2})-(\d{4})/i.exec(after);
    if (d) dates.push(`${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`);
  }

  // Unchanged fuels can keep an older date, so the newest date is the revision date
  const date = dates.sort().at(-1) || null;
  return { prices, missing, date };
}

// Returns { status: "updated" | "same" | "stale" | "no_data", results, errors, ... }
export async function checkFuelNow() {
  const results = [];
  const errors = [];

  for (const url of PAGES) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; AsuraBot/1.0)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      results.push({ url, ...parseCpcPage(await res.text()) });
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  // Only complete results (all 5 prices + a date) are trusted; the newest one wins
  const complete = results.filter((r) => !r.missing.length && r.date);
  if (!complete.length) return { status: "no_data", results, errors };
  complete.sort((a, b) => b.date.localeCompare(a.date));
  const best = complete[0];

  const saved = currentPrices();
  const same = FUELS.every((f) => saved.prices[f.key] === best.prices[f.key]);
  if (same) return { status: "same", best, results, errors };

  // Ignore data that is older than what we already have (1 day tolerance)
  const oldest = new Date(`${saved.updated}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  if (new Date(`${best.date}T00:00:00Z`).getTime() < oldest) {
    return { status: "stale", best, results, errors };
  }

  const before = saved.prices;
  savePrices(best.date, best.prices, "auto");
  return { status: "updated", best, before, results, errors };
}

function changesText(before, after) {
  return FUELS.filter((f) => before[f.key] !== after[f.key])
    .map((f) => `• ${f.name}: Rs. ${before[f.key] ?? "?"} ➜ Rs. ${after[f.key]}`)
    .join("\n");
}

let started = false;
let currentSock = null;

// Checks every 3 hours and tells the owner when the prices change
export function startFuelWatcher(sock) {
  currentSock = sock; // always use the newest connection
  if (started) return;
  started = true;

  const run = async () => {
    try {
      const r = await checkFuelNow();
      if (r.status !== "updated" || !currentSock) return;

      const owner = String(config.ownerNumber || "").replace(/\D/g, "");
      if (!/^\d{9,15}$/.test(owner)) return;

      await currentSock.sendMessage(`${owner}@s.whatsapp.net`, {
        text:
          `⛽ *Fuel prices updated automatically*\n\n` +
          `${changesText(r.before, r.best.prices)}\n\n` +
          `📅 Effective: ${r.best.date}\n` +
          `Type .fuel to see the new list.`,
      });
    } catch (err) {
      console.error("Fuel watcher error:", err.message);
    }
  };

  setTimeout(run, 60 * 1000); // first check 1 minute after start
  setInterval(run, 3 * 60 * 60 * 1000); // then every 3 hours
}