import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";

const phoneNumber = process.argv[2];

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  // First time only: ask for a pairing code
  if (!sock.authState.creds.registered) {
    if (!phoneNumber) {
      console.log("Number eka danna: node index.js 94771234567");
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
      if (reason !== DisconnectReason.loggedOut) {
        startBot(); // reconnect
      } else {
        console.log("Logged out. auth_info folder eka delete karala aluthen patan gannna.");
      }
    }
  });

  // Simple test command: .ping
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";
    if (text.toLowerCase() === ".ping") {
      await sock.sendMessage(msg.key.remoteJid, { text: "pong 🏓" });
    }
  });
}

startBot();