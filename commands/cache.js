import { CACHE_ENABLED, cacheStats, cacheClear } from "../downloadCache.js";

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

export default {
  name: "cache",
  description: "Owner only: show the download cache (.cache) or empty it (.cache clear)",
  ownerOnly: true,
  async run({ sock, msg, jid, args }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if ((args[0] || "").toLowerCase() === "clear") {
      await cacheClear();
      return reply("🧹 The download cache was emptied.");
    }

    const s = cacheStats();
    await reply(
      `💾 *Download cache*\n\n` +
        `Status: ${CACHE_ENABLED ? "ON ✅" : "OFF ❌"}\n` +
        `Saved files: ${s.count}\n` +
        `Size: ${mb(s.bytes)} MB of ${mb(s.maxBytes)} MB\n` +
        `Kept for: ${s.days} days\n\n` +
        `Empty it: .cache clear`
    );
  },
};