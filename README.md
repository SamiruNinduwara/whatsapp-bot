<p align="center">
  <img src="assets/logo.jpg" width="220" alt="ASURA BOT">
</p>

<h1 align="center">ASURA BOT V 1.0</h1>

<p align="center">
  A multi-feature WhatsApp bot made with Node.js and Baileys.<br>
  Developer: <b>Samiru Ninduwara</b>
</p>

<p align="center">English|<a href="README.si.md">සිංහල</a></p>

---

## ✨ What it can do

| Group | Commands |
|---|---|
| 🤖 **AI** | `.ai` chat, `.stt` voice note to text, `.ocr` read text from a photo, `.tr` translate |
| 🎵 **Downloads** | `.mp3` YouTube audio, `.mp4` YouTube / TikTok / Facebook video, `.tiktok`, `.dl` direct file link |
| 🛠️ **Tools** | `.sticker`, `.remind`, `.weather`, `.rates` (LKR), `.fuel` (Sri Lanka), `.logo`, `.img` |
| 👥 **Group** | `.antilink`, `.welcome`, `.tagall`, `.add`, `.kick`, `.promote`, `.demote`, `.mute`, `.unmute` |
| ⚙️ **Owner** | `.update`, `.restart`, `.status`, `.cache`, `.say`, `.fuelset` |

Send `.menu` in WhatsApp to see all commands, and `.cmd` for one full list.

---

## 📋 Before you start

You need:

1. **An Android phone** to run the bot (this guide uses an app called *Termux*).
   A PC or a cheap server also works (see "Running on a PC or server" below).
2. **A spare WhatsApp number** for the bot. Please do **not** use your main number (see the warning at the bottom).
3. **A free Gemini API key** (for `.ai`, `.stt`, `.ocr`, `.tr`). Steps are in Step 6.
4. About **30 minutes** and a good internet connection.

---

## 🚀 Setup on Android (Termux), step by step

> Type each command in Termux and press **Enter**. Wait until one command finishes before typing the next one.

### Step 1: Install Termux

Install **Termux from F-Droid** (f-droid.org). Do **not** use the Google Play version. It is old and will not work.

### Step 2: Update Termux

```bash
pkg update && pkg upgrade -y
```

If it asks a question, type `y` and press Enter.

### Step 3: Install the tools the bot needs

```bash
pkg install nodejs git ffmpeg python imagemagick -y
pip install -U yt-dlp yt-dlp-ejs
```

| Tool | What it is for |
|---|---|
| `nodejs` | Runs the bot |
| `git` | Downloads the bot's code |
| `ffmpeg` | Stickers, audio and video |
| `python` and `yt-dlp` | YouTube, TikTok and Facebook downloads |
| `imagemagick` | The `.logo` maker |

### Step 4: Download the bot

```bash
cd ~
git clone https://github.com/SamiruNinduwara/whatsapp-bot.git
cd whatsapp-bot
```

> If GitHub asks for a username and password, the repository is private. Enter your GitHub username, and use a **personal access token** instead of the password.

### Step 5: Install the bot's packages

```bash
npm install
```

This takes a few minutes. Warnings are normal. Only red errors matter.

### Step 6: Get your free API keys

**Gemini key (needed for the AI commands):**

1. Open **aistudio.google.com/apikey** and sign in with a Google account.
2. Press **Create API key**.
3. Copy the key.

**Pixabay key (only for `.img`, optional):**

1. Create a free account on **pixabay.com**.
2. Open **pixabay.com/api/docs/**. Your key is shown on that page.

> 🔒 A key is like a password. Never post it in a chat, a screenshot or on GitHub.

### Step 7: Save the keys in a `.env` file

Replace `PASTE_YOUR_KEY_HERE` with your real key. Do not put spaces around the `=` sign.

```bash
echo 'GEMINI_API_KEY=PASTE_YOUR_KEY_HERE' > .env
echo 'GEMINI_MODEL=gemini-3.5-flash-lite' >> .env
echo 'PIXABAY_API_KEY=PASTE_YOUR_KEY_HERE' >> .env
echo 'OWNER_NUMBER=94771234567' >> .env
echo 'OWNER_IDS=' >> .env
```

The first line uses `>` (creates the file). The other lines use `>>` (add to the file). Skip the Pixabay line if you do not want `.img`.

`OWNER_NUMBER` is **your own main number** (country code first, no `+`, no leading `0`). The bot will treat this number as its owner. `OWNER_IDS` is filled in Step 11.

A template of this file is also in the project: `.env.example`.

Check that the file exists. This command shows the names only, not the keys:

```bash
cut -d= -f1 .env
```

### Step 8: Change the settings (optional)

Your number is already saved in `.env`. If you want to change the bot's name, the developer name or the limits, open the settings file:

```bash
nano src/config.js
```

To save in `nano`: press **Ctrl + O**, then **Enter**. To leave: press **Ctrl + X**. You can skip this step and use the defaults.

### Step 9: Link the bot to WhatsApp (first time only)

Use the **spare number's** WhatsApp. Type the bot number with the country code (no `+`, no leading `0`):

```bash
node index.js 94771234567
```

After a few seconds Termux shows a code like this:

```
Pairing code: ABCD-EFGH
```

Now, on the phone that has the bot number's WhatsApp:

1. Open WhatsApp, then **Settings**, then **Linked devices**, then **Link a device**.
2. Tap **Link with phone number instead**.
3. Type the code from Termux.

When Termux shows `✅ Bot online!`, the bot is linked. You do **not** need the pairing code again.

### Step 10: Test it

From **your own** WhatsApp, send this to the bot number:

```
.alive
```

The bot should answer. Then try `.menu`.

> The bot does **not** read its own messages. Always send commands from a different number.

### Step 11: Make yourself the owner (important)

If a command says *"This command is for the bot owner only"* when you send it, WhatsApp is using a hidden ID for you instead of your phone number. To find it:

1. Send `.alive` from your own account.
2. Look at the Termux screen. You will see a line like:
   ```
   [cmd] .alive from 249396520317017 (owner: false)
   ```
3. Put that long number in `.env` (use your own number from the line):
   ```bash
   sed -i '/^OWNER_IDS=/d' .env
   echo 'OWNER_IDS=249396520317017' >> .env
   ```
   If you have more than one ID, separate them with commas: `OWNER_IDS=2493...,5678...`.
4. Restart the bot: `pm2 restart whatsapp-bot --update-env` (or stop it with **Ctrl + C** and run `node index.js` again).

Send `.alive` again. The line should now say `owner: true`.

### Step 12: Keep it running all day

Stop the bot (**Ctrl + C**) and start it with **pm2**, a tool that keeps it running and restarts it if it stops:

```bash
termux-wake-lock
npm install -g pm2
pm2 start index.js --name whatsapp-bot --max-memory-restart 400M
pm2 save
pm2 logs whatsapp-bot
```

Press **Ctrl + C** to stop watching the logs. The bot keeps running in the background.

Everyday pm2 commands:

| Command | What it does |
|---|---|
| `pm2 status` | Is the bot running? |
| `pm2 logs whatsapp-bot` | Shows what the bot is doing |
| `pm2 restart whatsapp-bot` | Restarts the bot |
| `pm2 stop whatsapp-bot` | Stops the bot |

**Phone settings that stop Android from closing Termux:**

1. **Settings, Apps, Termux, Battery**: choose **Unrestricted**.
2. In the recent apps screen, **lock** the Termux card.
3. If your phone has an **Autostart** setting, allow it for Termux.
4. Do not remove the Termux notification.
5. Keep the phone on a charger and on stable Wi-Fi.


---

## 🔁 If the bot stops, logs out or needs a fresh start

Find your situation in the table, then follow the steps below it.

| What happened | What to do |
|---|---|
| The bot stopped, or the phone restarted (`pm2 status` shows nothing) | **A. Start it again** |
| The log says `Logged out`, or the bot's number was removed from *Linked devices* | **B. Link WhatsApp again** |
| Something is badly broken and you want to begin from zero | **C. Fresh start** |

Where the bot keeps things:

| What | Where |
|---|---|
| Your keys and your number | `.env` |
| The WhatsApp login | `auth_info/` |
| Settings, reminders, holiday edits, download cache | `data/` |

### A. Start it again

```bash
cd ~/whatsapp-bot
bash tools/start.sh
```

This keeps Termux awake, starts the bot with pm2 (or restarts it if it is already there), saves the pm2 list and shows the log. When you see `✅ Bot online!`, it works. You do **not** need a pairing code.

### B. Link WhatsApp again (the bot got logged out)

1. Stop the bot: `pm2 stop whatsapp-bot`
2. Delete the old login: `rm -rf auth_info`
3. Link again with the **bot's** number (country code first, no `+`, no leading `0`):
   ```bash
   node index.js 94771234567
   ```
4. In WhatsApp on the bot's phone: **Settings, Linked devices, Link a device, Link with phone number instead**, then type the pairing code.
5. When you see `✅ Bot online!`, press **Ctrl + C**, then run `bash tools/start.sh`.

Your settings, `.env` file, reminders and cache are **not** touched.

### C. Fresh start (begin from zero)

> ⚠️ This deletes the bot's saved settings (reminders, group settings, holiday edits, download cache). Your `.env` file stays.
> If you want a copy first: `cp -r data data_backup`

```bash
cd ~/whatsapp-bot
pm2 delete whatsapp-bot
rm -rf auth_info data
git pull
npm install
node index.js 94771234567
```

Enter the pairing code as in B, press **Ctrl + C**, then run `bash tools/start.sh`.


Next time the bot is not running, just run `bash tools/start.sh`.

Tips:

- The pairing code works for a short time only. If it fails, run the `node index.js ...` command again for a new code.
- If WhatsApp says there were too many attempts, wait a while (even a few hours) and try again.
- Keep a private copy of your `.env` file. It has your keys.
- Never upload `.env` or `auth_info/` to GitHub. Anyone who has them controls the bot.

---

## 🔧 Settings you may want to change

All settings are in `src/config.js`.

| Setting | Meaning |
|---|---|
| `prefix` | The symbol before commands (default `.`) |
| `useLogo` | `false` sends menus as plain text (no image) |
| `maxDownloadMB` | Biggest download (WhatsApp's limit is 2048 MB) |
| `userMaxDownloadMB` | Biggest `.dl` file for other users |
| `userDailyDownloads` | `.dl` downloads per user per day |
| `maxMediaMinutes` | Longest YouTube / TikTok / Facebook video |
| `fastAudio` | `true` sends `.mp3` quickly without converting |
| `cacheDownloads` | `true` keeps downloads so repeated requests are instant |

After changing a setting, restart the bot: `pm2 restart whatsapp-bot`.

---

## 🔄 Updating the bot

Easiest way: send **`.update`** from your owner account. The bot downloads the newest code from GitHub, checks it, and restarts itself. If the new code has a mistake, it goes back to the old version automatically.

By hand:

```bash
cd ~/whatsapp-bot
git pull
pm2 restart whatsapp-bot
```

---

## 💻 Running on a PC or server

1. Install **Node.js 20 or newer**, **git**, **ffmpeg**, **yt-dlp** and **ImageMagick** with your system's package manager.
2. Follow Steps 4 to 12 above (ignore the Termux and Android parts).
3. `pm2` works the same way. On a server it keeps the bot running all the time.

---

## ❓ Troubleshooting

| Problem | What to do |
|---|---|
| `Please give your number: node index.js 94...` | Type your number after the command: `node index.js 94771234567` |
| No pairing code appears | Check the internet. Use the number with the country code, no `+`, no leading `0` |
| The bot does not answer | Send from a **different** number. Check `pm2 status`. Look at `pm2 logs whatsapp-bot` |
| The bot does not answer in a group | The **bot number must be a member** of the group. Admin commands also need the bot to be an admin |
| "This command is for the bot owner only" | Do Step 11 |
| `⚠️ OWNER_NUMBER is not set in the .env file` | Add `OWNER_NUMBER=94771234567` to `.env` (Step 7) and restart the bot |
| `| `Logged out. Delete the auth_info folder...` | Follow **B. Link WhatsApp again** in the section "If the bot stops, logs out or needs a fresh start" |
| The bot is not running after the phone restarted | Run `bash tools/start.sh` |
| `.mp3` / `.mp4` fail | Update the downloader: `pip install -U yt-dlp yt-dlp-ejs` |
| Photos, stickers or logos do not send | Your internet may block WhatsApp's media server. Try Wi-Fi or mobile data, whichever you did not use |
| `.logo` says ImageMagick is missing | `pkg install imagemagick -y` |
| `Cannot find module` | Run `npm install`, then restart the bot |
| The bot stops by itself | Do the phone settings in Step 12 |

---

## ⚠️ Important notes

- This bot uses an **unofficial** WhatsApp library. WhatsApp can **ban** the number. Use a **spare number**, never your main one, and do not send messages to many people at once.
- Downloads are for personal use. Respect copyright and the rules of each website.
- Photos and voice notes sent to `.ocr`, `.tr` and `.stt` go to Google's Gemini service. Do not use them for private documents or personal data.
- Keep your `.env` file and the `auth_info` folder private. Anyone who gets them can control your bot.