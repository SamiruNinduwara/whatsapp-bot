import { saveRestartTarget } from "../restartNotice.js";

// pm2 sets pm_id for the apps it manages, and it starts them again when they exit
const MANAGED_BY_PM2 = process.env.pm_id !== undefined;

export default {
  name: "restart",
  aliases: ["reboot"],
  description: "Owner only: restart the bot",
  ownerOnly: true,
  async run({ sock, msg, jid }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if (!MANAGED_BY_PM2) {
      return reply(
        "⚠️ I can't restart myself because I'm not running under pm2 (I would just stop).\n" +
          "Start me with: pm2 start index.js --name whatsapp-bot"
      );
    }

    saveRestartTarget(jid);
    await reply("🔄 Restarting... I'll be back in a few seconds.");

    // Give the message time to be delivered, then exit. pm2 starts a fresh copy.
    setTimeout(() => process.exit(0), 1500);
  },
};