import { getAggregateVotesInPollMessage } from "@whiskeysockets/baileys";

// poll message id -> { message, options, expires, created, onChoice, onExpired }
const polls = new Map();
const HOLD_MS = 60 * 60 * 1000; // keep the data for 1 hour
const MAX_POLLS = 300;

// Baileys needs the original poll message to read the votes (used by getMessage in index.js)
export function getStoredMessage(key) {
  return polls.get(key?.id)?.message;
}

// Call it with the result of sock.sendMessage({ poll: ... })
export function registerPoll(sent, { options, ttlMs, onChoice, onExpired }) {
  if (!sent?.key?.id) return;
  if (polls.size >= MAX_POLLS) polls.delete(polls.keys().next().value); // forget the oldest

  polls.set(sent.key.id, {
    message: sent.message,
    options,
    expires: Date.now() + ttlMs,
    created: Date.now(),
    onChoice,
    onExpired,
  });
}

// Called for every "messages.update" event: finds votes and runs onChoice
export async function handlePollUpdates(sock, updates) {
  for (const { key, update } of updates) {
    const entry = polls.get(key?.id);
    if (!entry || !update?.pollUpdates?.length) continue;

    try {
      const results = getAggregateVotesInPollMessage(
        { message: entry.message, pollUpdates: update.pollUpdates },
        sock.user?.id
      );
      const chosen = results.find((r) => r.voters.length && entry.options.includes(r.name));
      console.log(`[poll] vote received: ${chosen ? chosen.name : "(vote removed)"}`);
      if (!chosen) continue; // the vote was removed

      polls.delete(key.id); // the first vote wins, later votes are ignored

      if (Date.now() > entry.expires) {
        await entry.onExpired?.(sock);
        continue;
      }
      await entry.onChoice(chosen.name, chosen.voters[0], sock);
    } catch (err) {
      console.error("Poll update error:", err.message);
    }
  }
}

// Remove very old polls
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of polls) {
    if (now - entry.created > HOLD_MS) polls.delete(id);
  }
}, 10 * 60 * 1000).unref();