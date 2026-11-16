import { getSetting, getGroupInfo, strip } from "./groupUtils.js";

const LINK_REGEX = /(https?:\/\/|www\.|chat\.whatsapp\.com\/)\S+/i;

// Returns true if the message was handled (so the command handler should stop)
export async function checkAntiLink(sock, msg, jid, senderJid, text, isOwner) {
  if (!getSetting(jid, "antilink")) return false;
  if (!LINK_REGEX.test(text)) return false;

  try {
    const info = await getGroupInfo(sock, jid, senderJid);
    if (info.isAdmin || isOwner) return false; // admins and the owner are allowed
    if (!info.isBotAdmin) return false; // the bot can't delete messages unless it's an admin

    await sock.sendMessage(jid, { delete: msg.key });
    await sock.sendMessage(jid, {
      text: `🚫 @${strip(senderJid)}, links are not allowed in this group.`,
      mentions: [senderJid],
    });
    return true;
  } catch (err) {
    console.error("Anti-link error:", err.message);
    return false;
  }
}