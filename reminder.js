import fs from "fs";

const FILE = "data/reminders.json";
let list = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];
const scheduled = new Set();
let sockRef = null;

function save() {
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function fire(r) {
  list = list.filter((x) => x.id !== r.id);
  scheduled.delete(r.id);
  save();
  sockRef
    ?.sendMessage(r.jid, { text: `⏰ Reminder: ${r.text}` })
    .catch((e) => console.error("Reminder send error:", e));
}

function schedule(r) {
  if (scheduled.has(r.id)) return;
  scheduled.add(r.id);
  setTimeout(() => fire(r), Math.max(r.time - Date.now(), 0));
}

// bot start wela / reconnect wunama call wenawa
export function initReminders(sock) {
  sockRef = sock;
  list.forEach(schedule);
}

export function addReminder(jid, text, ms) {
  const r = { id: Date.now() + Math.random(), jid, text, time: Date.now() + ms };
  list.push(r);
  save();
  schedule(r);
  return r;
}