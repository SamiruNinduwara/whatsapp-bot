import fs from "fs";

const FILE = "data/restart.json";

// Remember which chat asked for the restart (and an optional note)
export function saveRestartTarget(jid, note = "") {
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ jid, note, time: Date.now() }));
}

// Called when the bot is back online: tells the chat that asked for the restart
export async function announceRestart(sock) {
  if (!fs.existsSync(FILE)) return;

  try {
    const { jid, note, time } = JSON.parse(fs.readFileSync(FILE, "utf8"));
    fs.rmSync(FILE, { force: true }); // delete first so it is only announced once

    if (Date.now() - time > 5 * 60 * 1000) return; // too old, ignore

    const seconds = Math.round((Date.now() - time) / 1000);
    await sock.sendMessage(jid, {
      text:
        `✅ Restart complete. I'm back online! (${seconds}s)` +
        (note ? `\n${note}` : ""),
    });
  } catch (err) {
    console.error("Restart notice error:", err.message);
  }
}