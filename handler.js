import fs from "fs";
import { checkRate } from "./throttle.js";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { config } from "./config.js";
import { checkAntiLink } from "./antilink.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const commands = new Map();

// Load every file in the commands folder
export async function loadCommands() {
  const dir = path.join(__dirname, "commands");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    const list = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const cmd of list) {
      commands.set(cmd.name, cmd);
      for (const alias of cmd.aliases || []) commands.set(alias, cmd);
    }
  }
  console.log(`Loaded ${new Set(commands.values()).size} commands`);
}

// Called for every incoming message
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

  const isGroup = jid.endsWith("@g.us");
  const senderJid = msg.key.participant || jid;
  const sender = senderJid.split("@")[0].split(":")[0];
  const isOwner = config.owners.includes(sender);

  // Anti-link (also checks messages that are not commands)
  if (
    isGroup &&
    text &&
    (await checkAntiLink(sock, msg, jid, senderJid, text, isOwner))
  ) {
    return;
  }

  if (!text.startsWith(config.prefix)) return;

  const [name, ...args] = text.slice(config.prefix.length).trim().split(/\s+/);
  const cmd = commands.get(name.toLowerCase());
  if (!cmd) return;

  console.log(`[cmd] .${name} from ${sender} (owner: ${isOwner})`);
    // Rate limit (the owner is exempt)
  if (!isOwner) {
    const rate = checkRate(sender);
    if (rate === "block") return;
    if (rate === "warn") {
      return sock.sendMessage(
        jid,
        { text: "⏳ You're sending commands too fast. Please slow down." },
        { quoted: msg }
      );
    }
  }

  if (cmd.ownerOnly && !isOwner) {
    return sock.sendMessage(
      jid,
      { text: "⛔ This command is for the bot owner only." },
      { quoted: msg }
    );
  }

  try {
    await cmd.run({
      sock,
      msg,
      jid,
      args,
      sender,
      senderJid,
      isGroup,
      isOwner,
      commands,
    });
  } catch (err) {
    console.error(`Error in .${name}:`, err);
    await sock.sendMessage(jid, { text: "❌ Something went wrong." }, { quoted: msg });
  }
}