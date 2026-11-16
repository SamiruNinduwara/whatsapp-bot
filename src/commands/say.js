export default {
  name: "say",
  description: "The bot reads what you tell it.",
  ownerOnly: true,
  async run({ sock, msg, jid, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, { text: "Use: .say hello" }, { quoted: msg });
    }
    await sock.sendMessage(jid, { text: args.join(" ") });
  },
};