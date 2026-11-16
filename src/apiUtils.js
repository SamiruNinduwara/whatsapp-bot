// Small helpers shared by the weather and rates commands

const store = new Map();
const MAX_STALE_MS = 6 * 60 * 60 * 1000; // if the API is down, serve data up to 6 hours old

// Returns cached data while it is fresh. If the API fails, falls back to slightly old data.
export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.time < ttlMs) return hit.value;

  try {
    const value = await fn();
    if (store.size > 300) store.clear(); // keep memory small
    store.set(key, { time: Date.now(), value });
    return value;
  } catch (err) {
    if (hit && Date.now() - hit.time < MAX_STALE_MS) return hit.value;
    throw err;
  }
}

export async function getJson(url, timeoutMs = 10000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

const lastUse = new Map();

// Returns 0 if the user may continue (and starts the cooldown), otherwise the seconds left
export function takeCooldown(name, user, ms) {
  const key = `${name}:${user}`;
  const left = ms - (Date.now() - (lastUse.get(key) || 0));
  if (left > 0) return Math.ceil(left / 1000);
  lastUse.set(key, Date.now());
  return 0;
}