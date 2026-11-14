import { getSetting, setSetting } from "./groupUtils.js";

// Built-in prices: Ceypetco (CPC), effective midnight 1 November 2026 (from 2 Nov)
export const DEFAULTS = {
  updated: "2026-11-02",
  prices: { "92": 424, "95": 490, ad: 397, sd: 543, ker: 285 },
  source: "default",
};

export const FUELS = [
  { key: "92", emoji: "🟢", name: "Petrol 92 Octane" },
  { key: "95", emoji: "🔵", name: "Petrol 95 Octane" },
  { key: "ad", emoji: "🟡", name: "Auto Diesel" },
  { key: "sd", emoji: "🟠", name: "Super Diesel" },
  { key: "ker", emoji: "⚪", name: "Kerosene" },
];

// Prices saved by .fuelset or by the automatic check, or the built-in defaults
export function currentPrices() {
  const saved = getSetting("global", "fuelPrices");
  if (saved && saved.prices) return { ...saved, custom: true };
  return { ...DEFAULTS, custom: false };
}

export function savePrices(updated, prices, source) {
  setSetting("global", "fuelPrices", { updated, prices, source });
}

export function resetPrices() {
  setSetting("global", "fuelPrices", false);
}