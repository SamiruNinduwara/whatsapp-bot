// WhatsApp timestamps can be numbers or Long objects
const toMs = (ts) => {
  const n = typeof ts === "object" && ts !== null ? Number(ts.toString()) : Number(ts);
  return Number.isFinite(n) && n > 0 ? n * 1000 : 0;
};

export default {
  name: "alive",
  aliases: ["speed"],
  description: "Check how fast the bot responds",
  ownerOnly: false,
  async run({ sock, msg, jid }) {
    const sentAt = toMs(msg.messageTimestamp);
    const incoming = sentAt ? Math.max(Date.now() - sentAt, 0) : null;

    const start = Date.now();
    const sent = await sock.sendMessage(jid, { text: "🏓 aliving..." }, { quoted: msg });
    const roundTrip = Date.now() - start;

    const memory = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);
    const text =
      `🏓 *ASURA BOT IS ALIVE !*\n\n` +
      (incoming !== null ? `📥 Your message reached the bot in: ${incoming} ms\n` : "") +
      `📤 Sending a reply took: ${roundTrip} ms\n` +
      `💾 Memory: ${memory} MB`;

    try {
      await sock.sendMessage(jid, { text, edit: sent.key }); // edit the first message
    } catch {
      await sock.sendMessage(jid, { text }, { quoted: msg });
    }
  },
};