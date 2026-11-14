export default {
  name: "ping",
  description: "Let's try the bot together.",
  ownerOnly: false,
  async run({ sock, msg, jid }) {
    await sock.sendMessage(jid, { text: "pong 🏓" }, { quoted: msg });
  },
};