import { getSetting } from "./groupUtils.js";

const jidOf = (p) => (typeof p === "string" ? p : p.id || p.phoneNumber);
const tag = (j) => `@${j.split("@")[0].split(":")[0]}`;

export async function handleGroupUpdate(sock, { id, participants, action }) {
  try {
    if (!getSetting(id, "welcome")) return;
    if (action !== "add" && action !== "remove") return;

    const jids = participants.map(jidOf).filter(Boolean);
    if (!jids.length) return;

    const tags = jids.map(tag).join(" ");
    const meta = await sock.groupMetadata(id);

    const text =
      action === "add"
        ? `👋 Welcome ${tags}!\nGlad to have you in *${meta.subject}* 🎉`
        : `👋 ${tags} has left the group. Bye!`;

    await sock.sendMessage(id, { text, mentions: jids });
  } catch (err) {
    console.error("Group update error:", err.message);
  }
}