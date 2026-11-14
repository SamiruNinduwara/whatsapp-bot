export const config = {
  prefix: ".",
  botName: "ASURA BOT",
  version: "1.0",
  developer: "Samiru Ninduwara",
  ownerNumber: "94765579961", // your main number, shown by .owner
  github: "https://github.com/SamiruNinduwara", // optional
  useLogo: true, // set to false to send menus as plain text (no image)
  maxDownloadMB: 1024, // biggest download for everyone (WhatsApp's limit is 2 GB = 2048 MB)
  userMaxDownloadMB: 1024, // biggest file for non-owners using .dl
  maxMediaMinutes: 120, // longest YouTube / TikTok / Facebook video, in minutes
  userDailyDownloads: 10, // .dl downloads per user per day
  fastAudio: true, // .mp3 sends M4A without converting (much faster). Set false for real MP3 files
  useAria2: false, // set true after installing aria2 in Termux (pkg install aria2) for faster downloads
  parallelDownloads: 1, // downloads running at the same time (1 to 3). 2 is OK on a strong phone
  owners: ["94765579961", "249396520317017"], // owner IDs (digits only)
  sendGapMinMs: 400, // minimum gap between messages sent back to back
  sendGapMaxMs: 900, // maximum gap
};