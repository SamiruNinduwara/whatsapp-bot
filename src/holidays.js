import { config } from "./config.js";
import { getSetting, setSetting } from "./groupUtils.js";
import { HOLIDAYS } from "./holidayList.js";

export const TIMEZONE = config.timezone || "Asia/Colombo";

// ---------- Dates ("YYYY-MM-DD") ----------
// Today's date in the bot's time zone, e.g. "2026-11-24"
export const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });

const toUtc = (key) => new Date(`${key}T00:00:00Z`);

export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / 86400000);

export const longDate = (key) =>
  toUtc(key).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export const shortDate = (key) =>
  toUtc(key).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

// True only for real dates such as 2026-12-31 (not 2026-02-31)
export function isValidDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return false;
  const d = toUtc(key);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

// ---------- The list: built-in + what the owner added or removed ----------
function overrides() {
  const s = getSetting("global", "holidayEdits");
  return { added: s?.added || [], removed: s?.removed || [] };
}

const saveOverrides = (o) => setSetting("global", "holidayEdits", o);

export function allHolidays() {
  const { added, removed } = overrides();
  return [...HOLIDAYS.filter((h) => !removed.includes(h.date)), ...added].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export const holidaysOn = (key) => allHolidays().filter((h) => h.date === key);

export const lastHolidayDate = () => allHolidays().at(-1)?.date || null;

// The next few holidays, starting today
export function upcoming(fromKey, count = 6) {
  return allHolidays().filter((h) => h.date >= fromKey).slice(0, count);
}

// kind: "poya", "holiday" or "merc" (a holiday that is also a mercantile holiday)
export function addHoliday(date, kind, name) {
  const o = overrides();
  o.added.push({
    date,
    type: kind === "poya" ? "poya" : "holiday",
    name,
    ...(kind === "merc" ? { merc: true } : {}),
  });
  saveOverrides(o);
}

// Removes every entry on that date (the built-in ones are hidden, the added ones are deleted)
export function removeHoliday(date) {
  const o = overrides();
  const hadAdded = o.added.some((h) => h.date === date);
  const hadBuiltIn = HOLIDAYS.some((h) => h.date === date);
  o.added = o.added.filter((h) => h.date !== date);
  if (hadBuiltIn && !o.removed.includes(date)) o.removed.push(date);
  saveOverrides(o);
  return hadAdded || hadBuiltIn;
}

export const resetHolidays = () => saveOverrides({ added: [], removed: [] });