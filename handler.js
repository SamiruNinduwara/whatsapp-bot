import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const commands = new Map();

// commands folder eke okkoma files load karanawa
export async function loadCommands() {
  const dir = path.join(__dirname, "commands");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    const cmd = mod.default;
    commands.set(cmd.name, cmd);
    for (const alias of cmd.aliases || []) commands.set(alias, cmd);
  }
  console.log(`Loaded ${new Set(commands.values()).size} commands`);
}

// message ekak awama mekata enawa
export async function handleMessage(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;
  const jid = msg.key.remoteJid;
  if (jid === "status@broadcast") return;

   const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    "";
  if (!text.startsWith(config.prefix)) return;

  const [name, ...args] = text.slice(config.prefix.length).trim().split(/\s+/);
  const cmd = commands.get(name.toLowerCase());
  if (!cmd) return;

  const sender = (msg.key.participant || jid).split("@")[0].split(":")[0];
  const isOwner = config.owners.includes(sender);
  console.log(`[cmd] .${name} from ${sender} (owner: ${isOwner})`);

  if (cmd.ownerOnly && !isOwner) {
    return sock.sendMessage(
      jid,
      { text: "⛔ Only Owner." },
      { quoted: msg }
    );
  }

  try {
    await cmd.run({ sock, msg, jid, args, sender, isOwner, commands });
  } catch (err) {
    console.error(`Error in .${name}:`, err);
    await sock.sendMessage(jid, { text: "❌ Error." }, { quoted: msg });
  }
}