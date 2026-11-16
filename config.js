// Private values (your number) come from the .env file,
// so this file is safe to publish on GitHub.
const digits = (value) => String(value || "").replace(/\D/g, "");

const ownerNumber = digits(process.env.OWNER_NUMBER);
const extraIds = String(process.env.OWNER_IDS || "").split(",").map(digits).filter(Boolean);

if (!ownerNumber) {
  console.warn(
    "⚠️ OWNER_NUMBER is not set in the .env file. Nobody will be treated as the bot owner."
  );
}

export const config = {
  prefix: ".",
  botName: "ASURA BOT",
  version: "1.0",
  developer: "Samiru Ninduwara",
  github: "https://github.com/SamiruNinduwara", // optional, delete this line to hide it
  useLogo: true, // set to false to send menus as plain text (no image)
  defaultCity: "Colombo", // used by .weather when no city is given

  // Downloads
  maxDownloadMB: 2048, // biggest download (WhatsApp's limit is 2 GB = 2048 MB)
  userMaxDownloadMB: 2048, // biggest file for non-owners using .dl
  maxMediaMinutes: 10, // longest YouTube / TikTok / Facebook video, in minutes
  userDailyDownloads: 5, // .dl downloads per user per day
  fastAudio: true, // .mp3 sends M4A without converting (much faster)
  useAria2: false, // set true after: pkg install aria2
  parallelDownloads: 1, // downloads running at the same time (1 to 3)
  cacheDownloads: true, // keep downloads so repeated requests are instant
  cacheMaxMB: 500, // total size of the cache
  cacheMaxFileMB: 100, // biggest single file that is cached
  cacheDays: 7, // how long a file is kept

  // Speed
  sendGapMinMs: 400, // minimum gap between messages sent back to back
  sendGapMaxMs: 900, // maximum gap

  // Private values from the .env file
  ownerNumber, // shown by .owner
  owners: [...new Set([ownerNumber, ...extraIds].filter(Boolean))],
};