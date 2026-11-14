import "dotenv/config";
import { startFuelWatcher } from "./fuelAuto.js";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first"); // prefer IPv4 (fixes many Termux timeouts)
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
import { throttleSends } from "./throttle.js";
import { setGlobalDispatcher, Agent } from "undici";
setGlobalDispatcher(new Agent({ connect: { timeout: 30_000 } }));

const phoneNumber = process.argv[2];

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1); // pm2 will restart the bot
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Ubuntu", "Chrome", "20.0.04"],
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
    if (connection === "open") console.log("✅ Bot online!");

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
}

console.log(`${config.botName} V ${config.version} by ${config.developer}`);
await loadCommands();
startBot();