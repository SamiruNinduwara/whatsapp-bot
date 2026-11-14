import fs from "fs";

const FILE = "data/groups.json";
let settings = fs.existsSync(FILE)
  ? JSON.parse(fs.readFileSync(FILE, "utf8"))
  : {};

export function getSetting(jid, key) {
  return settings[jid]?.[key] ?? false;
}

export function setSetting(jid, key, value) {
  settings[jid] = { ...settings[jid], [key]: value };
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2));
}

// "9477...:12@s.whatsapp.net" -> "9477..."
export const strip = (j = "") => String(j).split("@")[0].split(":")[0];

function same(p, jid) {
  const t = strip(jid);
  return [p.id, p.phoneNumber, p.lid, p.jid].some((x) => x && strip(x) === t);
}

export function findParticipant(participants, jid) {
  return participants.find((p) => same(p, jid));
}

const isAdminP = (p) => p?.admin === "admin" || p?.admin === "superadmin";

export async function getGroupInfo(sock, jid, senderJid) {
  const meta = await sock.groupMetadata(jid);
  const sender = findParticipant(meta.participants, senderJid);
  const bot =
    (sock.user?.id && findParticipant(meta.participants, sock.user.id)) ||
    (sock.user?.lid && findParticipant(meta.participants, sock.user.lid));
  return {
    meta,
    participants: meta.participants,
    isAdmin: isAdminP(sender),
    isBotAdmin: isAdminP(bot),
    bot,
  };
}

// Admin check. Returns the group info object if allowed, otherwise null.
export async function requireAdmin(ctx, needBotAdmin = false) {
  const { sock, msg, jid, isGroup, isOwner, senderJid } = ctx;
  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

  if (!isGroup) {
    await reply("👥 This command only works in groups.");
    return null;
  }

  const info = await getGroupInfo(sock, jid, senderJid);
  console.log(
    `[group] sender=${strip(senderJid)} admin=${info.isAdmin} botAdmin=${info.isBotAdmin}`
  );

  if (!info.isAdmin && !isOwner) {
    await reply("⛔ Only group admins can use this command.");
    return null;
  }
  if (needBotAdmin && !info.isBotAdmin) {
    await reply("⚠️ I need to be a group admin. Please make the bot an admin.");
    return null;
  }
  return info;
}

// The person who was @mentioned, or the author of the replied-to message
export function getTarget(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.mentionedJid?.[0] || ctx?.participant || null;
}