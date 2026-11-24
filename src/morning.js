import { config } from "./config.js";
import { cached, getJson } from "./apiUtils.js";
import { getSetting, setSetting } from "./groupUtils.js";

// ---------- Settings (change them in config.js) ----------
const TZ = config.timezone || "Asia/Colombo";
export const TIMEZONE = TZ;
export const DEFAULT_CITY = config.defaultCity || "Colombo";
const DEFAULT_TIME = /^\d{2}:\d{2}$/.test(config.morningTime || "") ? config.morningTime : "06:00";
export const MAX_CHATS = Number(config.morningMaxChats) > 0 ? Number(config.morningMaxChats) : 10;
const GRACE_MIN = 120; // if the bot was offline at the sending time, it still sends within 2 hours

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Time ----------
// "6:5" is not valid, "06:05" and "6:05" are. Returns "HH:MM" or null.
export function parseTime(text) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(text || "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// The current time in the bot's time zone
function nowInfo() {
  const now = new Date();
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return {
    minutes: Number(p.hour) * 60 + Number(p.minute),
    today: now.toLocaleDateString("en-CA", { timeZone: TZ }), // 2026-11-16
    longDate: new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now),
  };
}

// ---------- Saved state: { time, chats: { jid: { city, last } } } ----------
function load() {
  const s = getSetting("global", "morning");
  if (s && typeof s === "object") {
    return { time: parseTime(s.time) || DEFAULT_TIME, chats: s.chats || {} };
  }
  return { time: DEFAULT_TIME, chats: {} };
}

const save = (state) => setSetting("global", "morning", state);

export const getTime = () => load().time;
export const getChat = (jid) => load().chats[jid] || null;
export const chatCount = () => Object.keys(load().chats).length;

export function setTime(hhmm) {
  const state = load();
  state.time = hhmm;
  save(state);
}

// If the sending time has already passed today, the first message is tomorrow
export function subscribe(jid, city) {
  const state = load();
  const { minutes, today } = nowInfo();
  const passed = minutes >= toMinutes(state.time);
  state.chats[jid] = { city, last: passed ? today : state.chats[jid]?.last || "" };
  save(state);
  return { firstIsToday: !passed, time: state.time };
}

export function setCity(jid, city) {
  const state = load();
  if (!state.chats[jid]) return false;
  state.chats[jid].city = city;
  save(state);
  return true;
}

export function unsubscribe(jid) {
  const state = load();
  const had = !!state.chats[jid];
  delete state.chats[jid];
  save(state);
  return had;
}

function markSent(jid, today) {
  const state = load(); // load again: the settings may have changed while we were sending
  if (!state.chats[jid]) return;
  state.chats[jid].last = today;
  save(state);
}

// ---------- Weather (Open-Meteo, no key) ----------
function describe(code, isDay = 1) {
  if (code === 0) return { text: "Clear sky", emoji: isDay ? "☀️" : "🌙" };
  if (code === 1) return { text: "Mainly clear", emoji: "🌤️" };
  if (code === 2) return { text: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { text: "Overcast", emoji: "☁️" };
  if (code === 45 || code === 48) return { text: "Fog", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { text: "Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { text: "Rain", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { text: "Snow", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { text: "Showers", emoji: "🌦️" };
  if (code === 85 || code === 86) return { text: "Snow showers", emoji: "🌨️" };
  if (code >= 95) return { text: "Thunderstorm", emoji: "⛈️" };
  return { text: "Unknown", emoji: "🌡️" };
}

// City name -> place (the same cache as .weather uses)
export async function geocode(name) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?" +
    new URLSearchParams({ name, count: "1", language: "en", format: "json" });
  const data = await cached(`geo:${name.toLowerCase()}`, 24 * 60 * 60 * 1000, () => getJson(url));
  return data.results?.[0] || null;
}

async function weatherSection(city) {
  const place = await geocode(city);
  if (!place) throw new Error("CITY_NOT_FOUND");

  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: "temperature_2m,apparent_temperature,weather_code,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "1",
    });
  const data = await cached(`mwx:${place.latitude},${place.longitude}`, 30 * 60 * 1000, () => getJson(url));

  const c = data.current;
  const d = data.daily;
  const now = describe(c.weather_code, c.is_day);
  const today = describe(d.weather_code[0]);
  const rain = d.precipitation_probability_max?.[0];

  let text =
    `🌍 *Weather in ${place.name}*\n` +
    `Now: ${now.emoji} ${now.text}, ${Math.round(c.temperature_2m)}°C (feels like ${Math.round(c.apparent_temperature)}°C)\n` +
    `Today: ${today.emoji} ${Math.round(d.temperature_2m_min[0])}–${Math.round(d.temperature_2m_max[0])}°C` +
    (rain != null ? ` · rain ${rain}%` : "");
  if (rain != null && rain >= 50) text += `\n☔ Take an umbrella today!`;
  return text;
}

// ---------- LKR rates (same cache as .rates) ----------
const RATE_LIST = [
  ["USD", "🇺🇸"],
  ["EUR", "🇪🇺"],
  ["GBP", "🇬🇧"],
  ["AUD", "🇦🇺"],
  ["INR", "🇮🇳"],
  ["AED", "🇦🇪"],
];

const fmtRate = (n) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n >= 10 ? 2 : 4 });

async function ratesSection() {
  const data = await cached("rates:USD", 3 * 60 * 60 * 1000, async () => {
    const json = await getJson("https://open.er-api.com/v6/latest/USD");
    if (json.result !== "success" || !json.rates?.LKR) throw new Error("BAD_RATES");
    return json;
  });

  const lines = RATE_LIST.filter(([code]) => data.rates[code]).map(
    ([code, flag]) => `${flag} 1 ${code} = Rs. ${fmtRate(data.rates.LKR / data.rates[code])}`
  );
  return `💱 *Exchange rates (LKR)*\n${lines.join("\n")}`;
}

// ---------- The message ----------
// Every part is optional: if one fails, the others are still sent.
export async function buildMorningMessage(city) {
  const [weather, rates] = await Promise.allSettled([weatherSection(city), ratesSection()]);

  if (weather.status === "rejected") console.error("Morning weather error:", weather.reason?.message);
  if (rates.status === "rejected") console.error("Morning rates error:", rates.reason?.message);

  const sections = [];
  if (weather.status === "fulfilled") sections.push(weather.value);
  if (rates.status === "fulfilled") sections.push(rates.value);
  const { longDate } = nowInfo();
  return (
    `🌅 *Good morning!*\n` +
    `සුභ උදෑසනක්! ☀️\n` +
    `📅 ${longDate}\n\n` +
    sections.join("\n\n") +
    `\n\n_Have a great day! 🙌_\n_${config.botName} • stop these messages: .morning off_`
  );
}

// Used by ".morning now"
export async function sendNow(sock, jid, city) {
  const text = await buildMorningMessage(city);
  await sock.sendMessage(jid, { text });
}

// ---------- The daily sender ----------
let started = false;
let running = false;
let currentSock = null;
const failures = new Map(); // "date:jid" -> number of failed tries today

async function tick() {
  if (!currentSock || running) return;

  const state = load();
  const target = toMinutes(state.time);
  const { minutes, today } = nowInfo();
  if (minutes < target || minutes >= target + GRACE_MIN) return;

  const due = Object.entries(state.chats).filter(
    ([jid, chat]) => chat.last !== today && (failures.get(`${today}:${jid}`) || 0) < 3
  );
  if (!due.length) return;

  running = true;
  try {
    for (const [jid, chat] of due) {
      try {
        const text = await buildMorningMessage(chat.city || DEFAULT_CITY);
        await currentSock.sendMessage(jid, { text });
        markSent(jid, today);
        console.log(`[morning] sent to ${jid.split("@")[0]}`);
      } catch (err) {
        const key = `${today}:${jid}`;
        failures.set(key, (failures.get(key) || 0) + 1);
        console.error("Morning send error:", err.message);
      }
      await sleep(4000 + Math.random() * 4000); // wait between chats so it doesn't look like spam
    }
  } finally {
    running = false;
    for (const key of failures.keys()) if (!key.startsWith(today)) failures.delete(key);
  }
}

// Checks every minute. Called every time the bot connects (it keeps using the newest connection).
export function startMorning(sock) {
  currentSock = sock;
  if (started) return;
  started = true;

  const safeTick = () => tick().catch((err) => console.error("Morning error:", err.message));
  setTimeout(safeTick, 30 * 1000);
  setInterval(safeTick, 60 * 1000);
}