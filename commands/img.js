import { cached, getJson, takeCooldown } from "../apiUtils.js";

const MAX_IMAGES = 5;
const DEFAULT_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per photo
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const BLOCKED = /\b(nude|nudes|naked|porn|xxx|sex|sexy|nsfw|erotic|boobs|nipples)\b/i;

// One search at a time
let chain = Promise.resolve();
let waiting = 0;
function oneAtATime(task) {
  waiting++;
  const run = chain.then(task);
  chain = run.catch(() => {}).finally(() => {
    waiting--;
  });
  return run;
}

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Sinhala / Tamil searches are turned into English first (Pixabay understands English best)
async function toEnglish(text) {
  if (!process.env.GEMINI_API_KEY) throw new Error("NO_TRANSLATE");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Translate this photo search into a short English search phrase (1 to 4 words). " +
                "Output only the English phrase, nothing else.\n\n" +
                `<text>${text.replace(/<\/?text>/gi, "")}</text>`,
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 60 },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error("NO_TRANSLATE");
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const english = parts.map((p) => p.text || "").join("").trim();
  if (!english) throw new Error("NO_TRANSLATE");
  return english;
}

// Pixabay results must be cached for 24 hours (their rule), so the same search is only sent once a day
function searchPixabay(query) {
  const params = new URLSearchParams({
    key: process.env.PIXABAY_API_KEY,
    q: query,
    image_type: "photo",
    safesearch: "true", // always on
    per_page: "20",
    lang: "en",
  });

  return cached(`pixabay:${query.toLowerCase()}`, 24 * 60 * 60 * 1000, async () => {
    const data = await getJson(`https://pixabay.com/api/?${params}`, 15000);
    return (data.hits || [])
      .filter((h) => h.webformatURL)
      .map((h) => ({ url: h.webformatURL, user: h.user || "" }));
  });
}

// Only downloads from pixabay.com and only real images
async function fetchImage(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !u.hostname.endsWith("pixabay.com")) {
    throw new Error("BAD_URL");
  }

  const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);

  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error("NOT_IMAGE");

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("TOO_BIG");
  return buffer;
}

export default {
  name: "img",
  aliases: ["image", "photo", "pic"],
  description: "Send 5 photos for a search (.img sri lanka beach, or .img cats 3)",
  ownerOnly: false,
  async run({ sock, msg, jid, args, sender }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if (!process.env.PIXABAY_API_KEY) {
      return reply("❌ PIXABAY_API_KEY is not set (check your .env file).");
    }

    // The last word can be the number of photos (1-5)
    const parts = [...args];
    let count = DEFAULT_IMAGES;
    const last = parts[parts.length - 1];
    if (parts.length > 1 && /^\d+$/.test(last)) {
      count = Math.min(Math.max(Number(parts.pop()), 1), MAX_IMAGES);
    }

    let query = parts.join(" ").trim().slice(0, 60);
    if (!query) {
      return reply("Use: .img <what to search> [1-5]\nExample: .img sri lanka beach");
    }
    if (BLOCKED.test(query)) return reply("❌ That search isn't allowed.");

    const wait = takeCooldown("img", sender, 15000);
    if (wait) return reply(`⏳ Please wait ${wait}s before the next search.`);

    await reply(waiting > 0 ? "⏳ Queued. I'm finishing another search first..." : "🔎 Searching...");

    await oneAtATime(async () => {
      try {
        // Sinhala / Tamil: translate to English first, then check the words again
        if (/[^\x00-\x7F]/.test(query)) {
          try {
            query = (await toEnglish(query)).slice(0, 60);
          } catch {
            return reply("❌ Please search in English (for example: .img beach).");
          }
          if (BLOCKED.test(query)) return reply("❌ That search isn't allowed.");
        }

        const hits = await searchPixabay(query);
        if (!hits.length) return reply(`😕 No photos found for "${query}".`);

        let sent = 0;
        for (const hit of shuffle(hits).slice(0, count)) {
          try {
            const image = await fetchImage(hit.url);
            const by = hit.user.replace(/[*_~`]/g, "").slice(0, 40);
            const caption =
              (sent === 0 ? `🔎 ${query}\n` : "") +
              `📸 ${by ? `by ${by} ` : ""}via Pixabay`;

            await sock.sendMessage(
              jid,
              { image, caption },
              sent === 0 ? { quoted: msg } : undefined
            );
            sent++;
          } catch (err) {
            console.error("Image send failed:", err.message);
          }
        }

        if (!sent) await reply("❌ Couldn't send the photos. Please try again later.");
      } catch (err) {
        console.error("Image search error:", err.message);
        if (/HTTP_429/.test(err.message)) {
          await reply("⏳ The photo search limit was reached. Please try again in a minute.");
        } else if (/HTTP_(400|401|403)/.test(err.message)) {
          await reply("❌ The Pixabay API key is invalid. Please tell the bot owner.");
        } else {
          await reply("❌ Photo search failed. Please try again later.");
        }
      }
    });
  },
};