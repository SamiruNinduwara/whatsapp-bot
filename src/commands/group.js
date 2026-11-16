import {
  requireAdmin,
  getTarget,
  findParticipant,
  getSetting,
  setSetting,
  strip,
} from "../groupUtils.js";

// On/off commands such as .antilink and .welcome
function toggleCommand(name, key, label, needBotAdmin) {
  return {
    name,
    description: `Group admin: ${label} on/off (.${name} on)`,
    ownerOnly: false,
    async run(ctx) {
      const { sock, msg, jid, args } = ctx;
      const info = await requireAdmin(ctx);
      if (!info) return;

      const opt = (args[0] || "").toLowerCase();
      if (opt !== "on" && opt !== "off") {
        return sock.sendMessage(
          jid,
          {
            text: `Use: .${name} on / off\nCurrently: ${getSetting(jid, key) ? "ON ✅" : "OFF ❌"}`,
          },
          { quoted: msg }
        );
      }

      setSetting(jid, key, opt === "on");
      let text = `${label}: ${opt.toUpperCase()}`;
      if (opt === "on" && needBotAdmin && !info.isBotAdmin) {
        text += "\n⚠️ Please make the bot a group admin, otherwise this won't work.";
      }
      await sock.sendMessage(jid, { text }, { quoted: msg });
    },
  };
}

// .kick / .promote / .demote
function memberCommand(name, action, doneText) {
  return {
    name,
    description: `Group admin: ${doneText} (@mention or reply)`,
    ownerOnly: false,
    async run(ctx) {
      const { sock, msg, jid } = ctx;
      const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

      const info = await requireAdmin(ctx, true);
      if (!info) return;

      const target = getTarget(msg);
      if (!target) {
        return reply(`Reply to someone's message or @mention them.\nExample: .${name} @name`);
      }

      const p = findParticipant(info.participants, target);
      if (!p) return reply("That person is not in this group.");

      if (info.bot && strip(p.id) === strip(info.bot.id)) {
        return reply("I can't do that to myself 😅");
      }

      const targetIsAdmin = p.admin === "admin" || p.admin === "superadmin";
      if (action === "remove" && targetIsAdmin) {
        return reply("I can't kick an admin. Demote them first (.demote).");
      }
      if (action === "promote" && targetIsAdmin) return reply("They are already an admin.");
      if (action === "demote" && !targetIsAdmin) return reply("They are not an admin.");

      await sock.groupParticipantsUpdate(jid, [p.id], action);
      await sock.sendMessage(
        jid,
        { text: `✅ ${doneText}: @${strip(p.id)}`, mentions: [p.id] },
        { quoted: msg }
      );
    },
  };
}

// .mute / .unmute
function muteCommand(name, setting, doneText) {
  return {
    name,
    description: `Group admin: ${doneText}`,
    ownerOnly: false,
    async run(ctx) {
      const { sock, msg, jid } = ctx;
      const info = await requireAdmin(ctx, true);
      if (!info) return;
      await sock.groupSettingUpdate(jid, setting);
      await sock.sendMessage(jid, { text: `✅ ${doneText}` }, { quoted: msg });
    },
  };
}

const tagall = {
  name: "tagall",
  aliases: ["everyone"],
  description: "Group admin: tag everyone (.tagall message)",
  ownerOnly: false,
  async run(ctx) {
    const { sock, jid, args } = ctx;
    const info = await requireAdmin(ctx);
    if (!info) return;

    const mentions = info.participants.map((p) => p.id);
    const title = args.join(" ") || "Attention!";
    const text =
      `📢 *${title}*\n\n` + mentions.map((j) => `@${strip(j)}`).join("\n");

    await sock.sendMessage(jid, { text, mentions });
  },
};

export default [
  toggleCommand("antilink", "antilink", "Anti-link", true),
  toggleCommand("welcome", "welcome", "Welcome messages", false),
  tagall,
  memberCommand("kick", "remove", "Removed"),
  memberCommand("promote", "promote", "Promoted to admin"),
  memberCommand("demote", "demote", "Removed from admin"),
  muteCommand("mute", "announcement", "Group muted (only admins can send messages)"),
  muteCommand("unmute", "not_announcement", "Group unmuted"),
];