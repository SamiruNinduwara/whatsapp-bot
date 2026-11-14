const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const SYSTEM =
  "You are a helpful WhatsApp assistant. Reply in the same language the user writes in (Sinhala, English, or romanized Sinhala/Singlish). Keep answers short and clear, suitable for a chat message. Avoid heavy markdown; WhatsApp only supports *bold* and _italic_.";

const histories = new Map(); // chat eka anuwa conversation history
const lastUse = new Map(); // user anuwa cooldown
const MAX_HISTORY = 10; // anthima messages 10 witharak mathak thiyaganna
const COOLDOWN_MS = 5000; // user kenekta 5 seconds ekak

async function askGemini(contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { maxOutputTokens: 800 },
    }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("\n").trim();
}

export default {
  name: "ai",
  aliases: ["ask"],
  description: "Ask a question to the AI. Use: .ai your question",
  ownerOnly: false,
  async run({ sock, msg, jid, args, sender }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if (!process.env.GEMINI_API_KEY) {
      return reply("❌ The API key has not been set (.Check the env file).");
    }

    const question = args.join(" ").trim();
    if (!question) {
      return reply("Use: .ai your question.ai clear - to clear the history");
    }

    if (question.toLowerCase() === "clear") {
      histories.delete(jid);
      return reply("🧹 History Cleared.");
    }

    // spam nawaththanna (free limits nisa)
    const now = Date.now();
    if (now - (lastUse.get(sender) || 0) < COOLDOWN_MS) {
      return reply("⏳ please Wait.");
    }
    lastUse.set(sender, now);

    await sock.sendPresenceUpdate("composing", jid);

    let history = histories.get(jid) || [];
    const contents = [
      ...history,
      { role: "user", parts: [{ text: question }] },
    ];

    try {
      const answer = await askGemini(contents);
      history = [
        ...contents,
        { role: "model", parts: [{ text: answer }] },
      ].slice(-MAX_HISTORY);
      while (history.length && history[0].role !== "user") history.shift();
      histories.set(jid, history);
      await reply(answer || "🤔 I couldn't find an answer.");
    } catch (err) {
      console.error("AI error:", err.message);
      await reply("❌ The AI is not working right now. Try again later");
    }
  },
};