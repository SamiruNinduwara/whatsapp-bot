import "dotenv/config";
import { getStoredMessage, handlePollUpdates } from "./pollMenu.js";
import dns from "dns";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { config } from "./config.js";
import { loadCommands, handleMessage } from "./handler.js";
import { initReminders } from "./reminders.js";
import { handleGroupUpdate } from "./groupEvents.js";
import { getCachedMeta, setCachedMeta, clearCachedMeta } from "./groupUtils.js";
import { throttleSends } from "./throttle.js";
import { startFuelWatcher } from "./fuelAuto.js";
import { announceRestart } from "./restartNotice.js";

dns.setDefaultResultOrder("ipv4first"); // prefer IPv4 (fixes many Termux timeouts)

const phoneNumber = process.argv[2];

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1); // pm2 will restart the bot
});

// Fetching the latest WhatsApp version must never slow the bot down:
// use a 5 second timeout, remember the result, and fall back to Baileys' built-in version.
let cachedVersion;
async function getVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const { version } = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    cachedVersion = version;
    return version;
  } catch {
    return undefined;
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const version = await getVersion();

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    markOnlineOnConnect: false, // don't show the bot as always online (saves battery and data)
    syncFullHistory: false, // don't download old chats
    cachedGroupMetadata: async (id) => getCachedMeta(id), // faster replies in groups
   getMessage: async (key) => getStoredMessage(key), // needed to read poll votes
  });

  throttleSends(sock);
  initReminders(sock);
  startFuelWatcher(sock);

  // First time only: ask for a pairing code
  if (!sock.authState.creds.registered) {
    if (!phoneNumber) {
      console.log("Please give your number: node index.js 94771234567");
      process.exit(1);
    }
    setTimeout(async () => {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log("Pairing code:", code);
    }, 3000);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ Bot online!");
      announceRestart(sock); // tells the chat that asked for a restart (only after .restart / .update)
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log("Logged out. Delete the auth_info folder and start again.");
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log("Connection replaced: another copy of the bot is using this session. Stop the other copy.");
      } else {
        console.log(`Connection closed (code ${reason}). Reconnecting in 3 seconds...`);
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("Message handler error:", err);
      }
    }
  });

  sock.ev.on("group-participants.update", (ev) => handleGroupUpdate(sock, ev));
    // A tap on a poll option arrives as a "messages.update" event
  sock.ev.on("messages.update", (updates) => handlePollUpdates(sock, updates));

  // Keep the group info cache fresh
  sock.ev.on("groups.update", (updates) => {
    for (const u of updates) if (u.id) clearCachedMeta(u.id);
  });
  sock.ev.on("groups.upsert", (groups) => {
    for (const g of groups) if (g.id) setCachedMeta(g.id, g);
  });
}

console.log(`${config.botName} V ${config.version} by ${config.developer}`);
await loadCommands();
startBot();