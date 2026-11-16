import { config } from "../config.js";
import { sendWithLogo } from "../branding.js";

export default {
  name: "owner",
  aliases: ["developer", "creator"],
  description: "Show the bot's developer details",
  ownerOnly: false,
  async run({ sock, msg, jid }) {
    const lines = [
      `👑 *${config.botName} V ${config.version}*`,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `👨‍💻 *Developer:* ${config.developer}`,
      `📞 *Contact:* wa.me/${config.ownerNumber}`,
    ];
    if (config.github) lines.push(`💻 *GitHub:* ${config.github}`);
    lines.push(
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `_Type ${config.prefix}menu to see all commands._`
    );

    await sendWithLogo(sock, jid, lines.join("\n"), { quoted: msg });

    // Contact card (tap to save the number)
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${config.developer}`,
      `ORG:${config.botName};`,
      `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:+${config.ownerNumber}`,
      "END:VCARD",
    ].join("\n");

    await sock.sendMessage(
      jid,
      {
        contacts: {
          displayName: config.developer,
          contacts: [{ vcard }],
        },
      },
      { quoted: msg }
    );
  },
};