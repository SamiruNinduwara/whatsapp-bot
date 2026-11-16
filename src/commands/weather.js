import { cached, getJson, takeCooldown } from "../apiUtils.js";
import { config } from "../config.js";

const DEFAULT_CITY = config.defaultCity || "Gampaha";

// WMO weather codes -> [description, emoji]
const CODES = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌦️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌧️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Light showers", "🌦️"],
  81: ["Showers", "🌧️"],
  82: ["Heavy showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Thunderstorm with hail", "⛈️"],
};

function describe(code, isDay = 1) {
  const [text, emoji] = CODES[code] || ["Unknown", "🌡️"];
  return { text, emoji: code === 0 && !isDay ? "🌙" : emoji };
}

const fmtDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

// City name -> coordinates (cached for a day)
async function geocode(name) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?" +
    new URLSearchParams({ name, count: "1", language: "en", format: "json" });
  const data = await cached(`geo:${name.toLowerCase()}`, 24 * 60 * 60 * 1000, () =>
    getJson(url)
  );
  return data.results?.[0] || null;
}

// Coordinates -> current weather + 3 day forecast (cached for 10 minutes)
function getWeather(place) {
  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "3",
    });
  return cached(`wx:${place.latitude},${place.longitude}`, 10 * 60 * 1000, () =>
    getJson(url)
  );
}

function formatWeather(place, data) {
  const c = data.current;
  const d = data.daily;
  const now = describe(c.weather_code, c.is_day);
  const placeName = [place.name, place.admin1, place.country].filter(Boolean).join(", ");

  let text =
    `╭━━❮ 🌍 *WEATHER* ❯━━╮\n┃\n` +
    `┃ 📍 ${placeName}\n` +
    `┃ 🕒 Local time: ${c.time.slice(11, 16)}\n┃\n` +
    `┃ ${now.emoji} *${now.text}*\n` +
    `┃ 🌡️ ${Math.round(c.temperature_2m)}°C (feels like ${Math.round(c.apparent_temperature)}°C)\n` +
    `┃ 💧 Humidity: ${c.relative_humidity_2m}%\n` +
    `┃ 💨 Wind: ${Math.round(c.wind_speed_10m)} km/h\n` +
    `┃ 🌧️ Rain now: ${c.precipitation} mm\n┃\n` +
    `╰━━━━━━━━━━━━━━━━╯\n\n` +
    `📅 *3-day forecast*\n`;

  d.time.forEach((day, i) => {
    const w = describe(d.weather_code[i]);
    const rain = d.precipitation_probability_max?.[i];
    text +=
      `• ${fmtDay(day)}: ${w.emoji} ${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°C` +
      (rain != null ? ` · rain ${rain}%` : "") +
      `\n`;
  });

  text += `\n_Weather data by Open-Meteo.com_`;
  return text;
}

export default {
  name: "weather",
  aliases: ["w", "wthr"],
  description: "Weather and 3-day forecast (.weather Kandy)",
  ownerOnly: false,
  async run({ sock, msg, jid, args, sender }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    const wait = takeCooldown("weather", sender, 8000);
    if (wait) return reply(`⏳ Please wait ${wait}s before asking again.`);

    const query = args.join(" ").trim().slice(0, 60) || DEFAULT_CITY;

    try {
      const place = await geocode(query);
      if (!place) {
        return reply(`😕 I couldn't find "${query}". Try a different spelling.`);
      }
      const data = await getWeather(place);
      await reply(formatWeather(place, data));
    } catch (err) {
      console.error("Weather error:", err.message);
      await reply("❌ Couldn't get the weather right now. Please try again later.");
    }
  },
};