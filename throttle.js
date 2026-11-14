// Per-user rate limiting and send throttling (looks less like a spam bot)

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

// Wraps sock.sendMessage so messages go out one by one with a small delay
export function throttleSends(sock) {
  const original = sock.sendMessage.bind(sock);
  let last = Promise.resolve();

  sock.sendMessage = (jid, content, options) => {
    const run = last.then(async () => {
      const result = await original(jid, content, options);
      await sleep(700 + Math.random() * 800); // 0.7 - 1.5 seconds
      return result;
    });
    last = run.catch(() => {});
    return run;
  };
}