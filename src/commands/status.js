const startedAt = Date.now();

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default {
  name: "status",
  description: "Owner only: show bot uptime and memory use",
  ownerOnly: true,
  async run({ sock, msg, jid, commands }) {
    const memory = process.memoryUsage().rss / 1024 / 1024;
    const text =
      `🤖 *Bot status*\n\n` +
      `⏱️ Uptime: ${formatUptime(Date.now() - startedAt)}\n` +
      `💾 Memory: ${memory.toFixed(0)} MB\n` +
      `⚙️ Node: ${process.version}\n` +
      `📦 Commands: ${new Set(commands.values()).size}`;
    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};