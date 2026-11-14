import { config } from "./config.js";

// Per-user rate limiting and send spacing (looks less like a spam bot)

const WINDOW_MS = 60_000;
const MAX_COMMANDS = 10; // commands per user per minute
const hits = new Map();

// Returns "ok", "warn" (first time over the limit) or "block" (ignore silently)
export function checkRate(user) {
  const now = Date.now();
  const rec = hits.get(user) || { times: [], warned: false };
  rec.times = rec.times.filter((t) => now - t < WINDOW_MS);

  if (rec.times.length >= MAX_COMMANDS) {
    const result = rec.warned ? "block" : "warn";
    rec.warned = true;
    hits.set(user, rec);
    return result;
  }

  rec.times.push(now);
  rec.warned = false;
  hits.set(user, rec);
  return "ok";
}

// Clean up old records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [user, rec] of hits) {
    rec.times = rec.times.filter((t) => now - t < WINDOW_MS);
    if (!rec.times.length) hits.delete(user);
  }
}, 10 * 60_000).unref();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gap between two messages that go out back to back (milliseconds).
// You can change them in config.js with sendGapMinMs / sendGapMaxMs.
const MIN_GAP_MS = Number(config.sendGapMinMs ?? 400);
const MAX_GAP_MS = Math.max(Number(config.sendGapMaxMs ?? 900), MIN_GAP_MS);

// A single reply is sent immediately. Only messages sent right after each other are spaced out.
// Only the START of each send is spaced, so a slow upload never blocks other replies.
export function throttleSends(sock) {
  const original = sock.sendMessage.bind(sock);
  let nextSlot = 0;

  sock.sendMessage = async (jid, content, options) => {
    const now = Date.now();
    const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + gap;

    const wait = slot - now;
    if (wait > 0) await sleep(wait);
    return original(jid, content, options);
  };
}