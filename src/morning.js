import { config } from "./config.js";
import { getSetting, setSetting } from "./groupUtils.js";
import { TIMEZONE, todayKey, daysBetween;

// ---------- Settings (change them in config.js) ----------
export { TIMEZONE };
export const MAX_CHATS = Number(config.morningMaxChats) > 0 ? Number(config.morningMaxChats) : 10;
const DEFAULT_TIME = /^\d{2}:\d{2}$/.test(config.morningTime || "") ? config.morningTime : "06:00";
const GRACE_MIN = 120; // if the bot was offline at the sending time, it still sends within 2 hours

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Time ----------
// "6:00" and "06:00" are valid, "6:5" is not. Returns "HH:MM" or null.
export function parseTime(text) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(text || "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Minutes since midnight in the bot's time zone
function minutesNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );
  return Number(p.hour) * 60 + Number(p.minute);
}

// ---------- Saved state: { time, chats: { jid: { last } } } ----------
function load() {
  const s = getSetting("global", "morning");
  if (s && typeof s === "object") {
    return { time: parseTime(s.time) || DEFAULT_TIME, chats: s.chats || {} };
  }
  return { time: DEFAULT_TIME, chats: {} };
}

const save = (state) => setSetting("global", "morning", state);

export const getTime = () => load().time;
export const isOn = (jid) => !!load().chats[jid];
export const chatCount = () => Object.keys(load().chats).length;

export function setTime(hhmm) {
  const state = load();
  state.time = hhmm;
  save(state);
}

// If the sending time has already passed today, the first message is tomorrow
export function subscribe(jid) {
  const state = load();
  const passed = minutesNow() >= toMinutes(state.time);
  state.chats[jid] = { last: passed ? todayKey() : state.chats[jid]?.last || "" };
  save(state);
  return { firstIsToday: !passed, time: state.time };
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

// ---------- The message ----------
// A different greeting each day, so the message is not word for word the same every morning
const GREETINGS = [
  ["Good morning! ☀️", "සුභ උදෑසනක්!"],
  ["Rise and shine! 🌄", "සුභ දවසක් වේවා!"],
  ["Good morning, everyone! 🌅", "සුභ උදෑසනක් ඔබ සැමට!"],
  ["A fresh new day! 🌞", "අලුත් දවසක් අලුත් බලාපොරොත්තු!"],
  ["Good morning! Have a lovely day 🌼", "ඔබට සුභ දවසක්!"],
  ["Wake up and smile! 😊", "සුභ උදෑසනක්, සුභ දවසක්!"],
  ["Good morning, and good luck today! 🍀", "සුභ උදෑසනක්!"],
];

function greetingFor(dateKey) {
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
  return GREETINGS[((dayNumber % GREETINGS.length) + GREETINGS.length) % GREETINGS.length];
}

// The text for one day: a greeting, and a note if it is a Poya day or a public holiday
export function buildMorningMessage(dateKey = todayKey()) {
  const [english, sinhala] = greetingFor(dateKey);
  const events = holidaysOn(dateKey);

  const lines = [`🌅 *${english}*`, `${sinhala}`, `📅 ${longDate(dateKey)}`];

  for (const e of events) {
    lines.push("");
    if (e.type === "poya") {
      lines.push(`🌕 Today is *${e.name}*${e.si ? ` (${e.si})` : ""}`);
      lines.push(`සුභ පොහොය දවසක් වේවා! 🙏`);
    } else {
      lines.push(`🎉 Today is a public holiday: *${e.name}*`);
      lines.push(e.merc ? `🏢 A bank, public and mercantile holiday.` : `🏦 A bank and public holiday.`);
    }
  }

  if (events.length === 0) lines.push("", `Have a great day! 🙌`);

  lines.push("", `_${config.botName} • stop these messages: .morning off_`);
  return lines.join("\n");
}

// Used by ".morning now"
export async function sendNow(sock, jid, dateKey) {
  await sock.sendMessage(jid, { text: buildMorningMessage(dateKey) });
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
  const minutes = minutesNow();
  if (minutes < target || minutes >= target + GRACE_MIN) return;

  const today = todayKey();
  const due = Object.entries(state.chats).filter(
    ([jid, chat]) => chat.last !== today && (failures.get(`${today}:${jid}`) || 0) < 3
  );
  if (!due.length) return;

  running = true;
  try {
    for (const [jid] of due) {
      try {
        await currentSock.sendMessage(jid, { text: buildMorningMessage(today) });
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

// Tells the owner when the holiday list is about to run out (at most once a week)
async function checkListEnd() {
  if (!currentSock) return;

  const last = lastHolidayDate();
  const today = todayKey();
  const daysLeft = last ? daysBetween(today, last) : -1;
  if (daysLeft >= 45) return;

  const lastWarning = getSetting("global", "holidayWarning");
  if (lastWarning && daysBetween(lastWarning, today) < 7) return;

  const owner = String(config.ownerNumber || "").replace(/\D/g, "");
  if (!/^\d{9,15}$/.test(owner)) return;

  await currentSock.sendMessage(`${owner}@s.whatsapp.net`, {
    text:
      `⚠️ *Holiday list is running out*\n\n` +
      (last ? `The list covers dates only until ${last}.` : `The holiday list is empty.`) +
      `\nWhen the government announces the next year's holidays, add the Poya days and holidays ` +
      `(.holiday add 2028-01-13 poya Duruthu Full Moon Poya Day) or update src/holidayList.js.`,
  });
  setSetting("global", "holidayWarning", today);
}

// Checks every minute. Called every time the bot connects (it keeps using the newest connection).
export function startMorning(sock) {
  currentSock = sock;
  if (started) return;
  started = true;

  const safe = (fn) => () => fn().catch((err) => console.error("Morning error:", err.message));
  setTimeout(safe(tick), 30 * 1000);
  setInterval(safe(tick), 60 * 1000);
  setTimeout(safe(checkListEnd), 90 * 1000);
  setInterval(safe(checkListEnd), 24 * 60 * 60 * 1000);
}