<p align="center">
  <img src="assets/logo.jpg" width="220" alt="ASURA BOT">
</p>

<h1 align="center">ASURA BOT V 1.0</h1>

<p align="center">
  Node.js සහ Baileys වලින් හදපු බහු-කාර්ය WhatsApp bot එකක්.<br>
  Developer: <b>Samiru Ninduwara</b>
</p>

<p align="center">සිංහල | <a href="README.md">English</a></p>

---

## ✨ මොනවද කරන්න පුළුවන්

| කොටස | Commands |
|---|---|
| 🤖 **AI** | `.ai` chat, `.stt` voice note එක text කිරීම, `.ocr` photo එකේ අකුරු කියවීම, `.tr` පරිවර්තනය |
| 🎵 **Downloads** | `.mp3` YouTube audio, `.mp4` YouTube / TikTok / Facebook video, `.tiktok`, `.dl` direct file link |
| 🛠️ **Tools** | `.sticker`, `.remind`, `.weather`, `.rates` (LKR), `.fuel` (ශ්‍රී ලංකාව), `.logo`, `.img` |
| 👥 **Group** | `.antilink`, `.welcome`, `.tagall`, `.kick`, `.promote`, `.demote`, `.mute`, `.unmute` |
| ⚙️ **Owner** | `.update`, `.restart`, `.status`, `.cache`, `.say`, `.fuelset` |

WhatsApp එකේ `.menu` යවලා commands ඔක්කොම බලන්න, `.cmd` එකෙන් එකම ලයිස්තුවක් බලන්න.

---

## 📋 පටන් ගන්න කලින්

ඔයාට ඕනේ:

1. Bot එක දුවන්න **Android phone** එකක් (මේ මාර්ගෝපදේශයේ *Termux* කියන app එක පාවිච්චි කරනවා). PC එකක් හෝ ලාභ server එකකත් වැඩ (පහළ "PC එකක / server එකක" බලන්න).
2. Bot එකට **අමතර WhatsApp number එකක්**. ඔයාගේ main number එක **පාවිච්චි කරන්න එපා** (පහළ අවවාදය බලන්න).
3. **නොමිලේ Gemini API key එකක්** (`.ai`, `.stt`, `.ocr`, `.tr` සඳහා). පියවර 6 හි විස්තර තියෙනවා.
4. විනාඩි **30** ක් විතර සහ හොඳ internet connection එකක්.

---

## 🚀 Android (Termux) එකේ Setup කරන හැටි, පියවරෙන් පියවර

> Termux එකේ හැම command එකක්ම type කරලා **Enter** ඔබන්න. ඊළඟ command එක type කරන්න කලින් කලින් එක ඉවර වෙනකම් බලා ඉන්න.

### පියවර 1: Termux install කරන්න

**F-Droid** (f-droid.org) එකෙන් **Termux** install කරන්න. **Google Play** version එක පාවිච්චි කරන්න එපා, ඒක පරණයි, වැඩ කරන්නේ නෑ.

### පියවර 2: Termux update කරන්න

```bash
pkg update && pkg upgrade -y
```

ප්‍රශ්නයක් ඇහුවොත් `y` type කරලා Enter ඔබන්න.

### පියවර 3: Bot එකට ඕනේ tools install කරන්න

```bash
pkg install nodejs git ffmpeg python imagemagick -y
pip install -U yt-dlp yt-dlp-ejs
```

| Tool | මොකටද |
|---|---|
| `nodejs` | Bot එක දුවන්න |
| `git` | Bot ගේ code එක download කරන්න |
| `ffmpeg` | Stickers, audio, video |
| `python` සහ `yt-dlp` | YouTube, TikTok, Facebook downloads |
| `imagemagick` | `.logo` හදන්න |

### පියවර 4: Bot එක download කරන්න

```bash
cd ~
git clone https://github.com/SamiruNinduwara/whatsapp-bot.git
cd whatsapp-bot
```

> GitHub එක username සහ password ඇහුවොත් repository එක private එකක්. GitHub username එක දීලා, password වෙනුවට **personal access token** එකක් දාන්න.

### පියවර 5: Bot ගේ packages install කරන්න

```bash
npm install
```

මේකට විනාඩි කීපයක් යනවා. Warnings සාමාන්‍යයි, රතු පාට errors විතරයි ගණන් ගන්න ඕනේ.

### පියවර 6: නොමිලේ API keys ගන්න

**Gemini key (AI commands වලට ඕනේ):**

1. **aistudio.google.com/apikey** ට ගිහින් Google account එකෙන් login වෙන්න.
2. **Create API key** ඔබන්න.
3. Key එක copy කරගන්න.

**Pixabay key (`.img` වලට විතරයි, අනිවාර්ය නෑ):**

1. **pixabay.com** එකේ නොමිලේ account එකක් හදාගන්න.
2. **pixabay.com/api/docs/** පිටුවට යන්න. ඔයාගේ key එක ඒ පිටුවේ පෙනෙනවා.

> 🔒 Key එකක් password එකක් වගේ. එය chat එකකට, screenshot එකකට, GitHub එකට දාන්න එපා.

### පියවර 7: Keys `.env` file එකේ save කරන්න

`PASTE_YOUR_KEY_HERE` වෙනුවට ඔයාගේ ඇත්ත key එක දාන්න. `=` ලකුණ දෙපැත්තේ space දාන්න එපා.

```bash
echo 'GEMINI_API_KEY=PASTE_YOUR_KEY_HERE' > .env
echo 'GEMINI_MODEL=gemini-3.5-flash-lite' >> .env
echo 'PIXABAY_API_KEY=PASTE_YOUR_KEY_HERE' >> .env
echo 'OWNER_NUMBER=94771234567' >> .env
echo 'OWNER_IDS=' >> .env
```

පළවෙනි line එකේ `>` (file එක හදනවා), අනිත් lines වල `>>` (file එකට එකතු කරනවා). `.img` ඕනේ නැත්නම් Pixabay line එක අත්හරින්න.

`OWNER_NUMBER` කියන්නේ **ඔයාගේම main number එක** (country code එක්ක, `+` නැතුව, මුල 0 නැතුව). Bot එක මේ number එක owner ලෙස සලකනවා. `OWNER_IDS` පියවර 11 හි පුරවනවා.

File එක හැදුණාද බලන්න. මේකෙන් නම් විතරක් පෙන්නනවා, keys නෙවෙයි:

```bash
cut -d= -f1 .env
```

### පියවර 8: Settings වෙනස් කරන්න (අවශ්‍ය නම් පමණයි)

ඔයාගේ number එක දැනටමත් `.env` එකේ තියෙනවා. Bot ගේ නම, developer ගේ නම, limits වෙනස් කරන්න ඕනේ නම් settings file එක open කරන්න:

```bash
nano src/config.js
```

`nano` එකේ save කරන්න: **Ctrl + O** ඊට පස්සේ **Enter**. එළියට එන්න: **Ctrl + X**. මේ පියවර මඟ හැරලා default අගයන් පාවිච්චි කරන්නත් පුළුවන්.

### පියවර 9: Bot එක WhatsApp එකට link කරන්න (පළවෙනි වතාවට විතරයි)

**Bot number එකේ** WhatsApp පාවිච්චි කරන්න. Bot number එක country code එක්ක type කරන්න (`+` නැතුව, මුල 0 නැතුව):

```bash
node index.js 94771234567
```

තත්පර කීපයකින් Termux එකේ මෙහෙම code එකක් පෙනෙනවා:

```
Pairing code: ABCD-EFGH
```

ඊට පස්සේ bot number එකේ WhatsApp තියෙන phone එකේ:

1. WhatsApp open කරලා **Settings**, ඊට පස්සේ **Linked devices**, ඊට පස්සේ **Link a device** ඔබන්න.
2. **Link with phone number instead** ඔබන්න.
3. Termux එකේ තියෙන code එක type කරන්න.

Termux එකේ `✅ Bot online!` පෙනුණාම bot එක link වෙලා. ආයෙ pairing code එක ඕනේ නෑ.

### පියවර 10: Test කරන්න

**ඔයාගේම** WhatsApp එකෙන්, bot number එකට මේක යවන්න:

```
.alive
```

Bot එක reply කරන්න ඕනේ. ඊට පස්සේ `.menu` try කරන්න.

> Bot එක තමන්ගේම messages කියවන්නේ නෑ. Commands හැමවිටම **වෙන number එකකින්** යවන්න.

### පියවර 11: ඔයාව owner කරගන්න (වැදගත්)

ඔයා command එකක් යවද්දී *"This command is for the bot owner only"* කියලා ආවොත්, WhatsApp එක ඔයාව phone number එකකින් නෙවෙයි, සැඟවුණු ID එකකින් හඳුන්වනවා. ඒක හොයාගන්න:

1. ඔයාගේ account එකෙන් `.alive` යවන්න.
2. Termux screen එක බලන්න. මෙහෙම line එකක් පෙනෙනවා:
   ```
   [cmd] .alive from 249396520317017 (owner: false)
   ```
3. ඒ දිගු අංකය `.env` එකට දාන්න (ඔයාගේ line එකේ තියෙන අංකය පාවිච්චි කරන්න):
   ```bash
   sed -i '/^OWNER_IDS=/d' .env
   echo 'OWNER_IDS=249396520317017' >> .env
   ```
   ID එකකට වඩා තියෙනවා නම් කොමා එකකින් වෙන් කරන්න: `OWNER_IDS=2493...,5678...`.
4. Bot එක restart කරන්න: `pm2 restart whatsapp-bot --update-env` (නැත්නම් **Ctrl + C** එබුවම නවතිනවා, ආයෙ `node index.js` කරන්න).

ආයෙ `.alive` යවන්න. දැන් line එකේ `owner: true` කියලා පෙනෙන්න ඕනේ.

### පියවර 12: දවස පුරාම දුවන්න තියන්න

Bot එක නවත්තන්න (**Ctrl + C**), ඊට පස්සේ **pm2** වලින් පටන් ගන්න. pm2 කියන්නේ bot එක දිගටම දුවන්න තියලා, නැවතුණොත් ආයෙ පටන් ගන්න දෙන tool එකක්:

```bash
termux-wake-lock
npm install -g pm2
pm2 start index.js --name whatsapp-bot --max-memory-restart 400M
pm2 save
pm2 logs whatsapp-bot
```

Logs බලන එක නවත්තන්න **Ctrl + C** ඔබන්න. Bot එක background එකේ දිගටම දුවනවා.

සාමාන්‍ය pm2 commands:

| Command | මොකද කරන්නේ |
|---|---|
| `pm2 status` | Bot එක දුවනවාද? |
| `pm2 logs whatsapp-bot` | Bot එක කරන දේ පෙන්නනවා |
| `pm2 restart whatsapp-bot` | Bot එක restart කරනවා |
| `pm2 stop whatsapp-bot` | Bot එක නවත්තනවා |

**Android එක Termux වහන එක වළක්වන phone settings:**

1. **Settings, Apps, Termux, Battery**: **Unrestricted** තෝරන්න.
2. Recent apps screen එකේ Termux card එක **lock** කරන්න.
3. ඔයාගේ phone එකේ **Autostart** setting එකක් තියෙනවා නම් Termux ට ඉඩ දෙන්න.
4. Termux notification එක අයින් කරන්න එපා.
5. Phone එක charger එකේ, ස්ථාවර Wi-Fi එකක තියන්න.

---

## 🔧 වෙනස් කරන්න පුළුවන් settings

හැම setting එකක්ම `src/config.js` එකේ තියෙනවා.

| Setting | තේරුම |
|---|---|
| `prefix` | Commands වලට ඉස්සරහින් දාන සලකුණ (default `.`) |
| `useLogo` | `false` කළොත් menus logo නැතුව text විතරක් යවනවා |
| `maxDownloadMB` | ලොකුම download එක (WhatsApp ගේ සීමාව 2048 MB) |
| `userMaxDownloadMB` | අනිත් අයට `.dl` වලට ලොකුම file එක |
| `userDailyDownloads` | දවසකට user කෙනෙකුට `.dl` ගාණ |
| `maxMediaMinutes` | දිගම YouTube / TikTok / Facebook video එක |
| `fastAudio` | `true` නම් `.mp3` convert නොකර ඉක්මනින් යවනවා |
| `cacheDownloads` | `true` නම් downloads තියාගන්නවා, ආයෙ ඉල්ලුවොත් ක්ෂණිකව යවනවා |

Setting එකක් වෙනස් කළාට පස්සේ bot එක restart කරන්න: `pm2 restart whatsapp-bot`.


---

## 🔁 Bot එක නතර වුණාම, logout වුණාම, අලුතින් පටන් ගන්න ඕනේ වුණාම

ඔයාගේ තත්ත්වය table එකේ හොයාගෙන, ඊට යටින් තියෙන පියවර කරන්න.

| මොකද වුණේ | කරන්න ඕනේ |
|---|---|
| Bot එක නතර වුණා, නැත්නම් phone එක restart වුණා (`pm2 status` හිස්) | **අ. ආයෙ පටන් ගන්න** |
| Log එකේ `Logged out` කියනවා, නැත්නම් *Linked devices* වලින් bot number එක අයින් වෙලා | **ආ. WhatsApp ආයෙ link කරන්න** |
| ගොඩක් අවුල් වෙලා, මුල ඉඳන්ම පටන් ගන්න ඕනේ | **ඇ. අලුතින් පටන් ගැනීම** |

Bot එක දේවල් තියාගන්න තැන්:

| මොකක්ද | කොහේද |
|---|---|
| ඔයාගේ keys සහ number එක | `.env` |
| WhatsApp login එක | `auth_info/` |
| Settings, reminders, නිවාඩු වෙනස්කම්, download cache | `data/` |

### අ. ආයෙ පටන් ගන්න

```bash
cd ~/whatsapp-bot
bash tools/start.sh
```

මේකෙන් Termux නිදි වැටෙන එක වළක්වනවා, bot එක pm2 වලින් පටන් ගන්නවා (කලින් තියෙනවා නම් restart කරනවා), pm2 ලයිස්තුව save කරනවා, log එක පෙන්නනවා. `✅ Bot online!` පෙනුණාම වැඩ. Pairing code එකක් **ඕනේ නෑ**.

### ආ. WhatsApp ආයෙ link කරන්න (bot logout වුණාම)

1. Bot එක නවත්තන්න: `pm2 stop whatsapp-bot`
2. පරණ login එක මකන්න: `rm -rf auth_info`
3. **Bot ගේ** number එකෙන් ආයෙ link කරන්න (country code එක්ක, `+` නැතුව, මුල 0 නැතුව):
   ```bash
   node index.js 94771234567
   ```
4. Bot number එකේ WhatsApp එකේ: **Settings, Linked devices, Link a device, Link with phone number instead**, ඊට පස්සේ pairing code එක type කරන්න.
5. `✅ Bot online!` පෙනුණාම **Ctrl + C** ඔබලා, `bash tools/start.sh` run කරන්න.

ඔයාගේ settings, `.env`, reminders, cache **ස්පර්ශ වෙන්නේ නෑ**.

### ඇ. අලුතින් පටන් ගැනීම (මුල ඉඳන්)

> ⚠️ මේකෙන් bot එකේ save වෙලා තියෙන settings (reminders, group settings, නිවාඩු වෙනස්කම්, download cache) මැකෙනවා. `.env` file එක තියෙනවා.
> කලින් පිටපතක් ඕනේ නම්: `cp -r data data_backup`

```bash
cd ~/whatsapp-bot
pm2 delete whatsapp-bot
rm -rf auth_info data
git pull
npm install
node index.js 94771234567
```

ආ හි වගේම pairing code එක දාලා, **Ctrl + C** ඔබලා `bash tools/start.sh` run කරන්න.

උපදෙස්:

- Pairing code එක ටික වෙලාවක් විතරයි වැඩ. අවුල් වුණොත් `node index.js ...` command එක ආයෙ run කරලා අලුත් code එකක් ගන්න.
- WhatsApp එක "උත්සාහ ගොඩක්" කියලා කිව්වොත් ටික වෙලාවක් (සමහර විට පැය කීපයක්) ඉඳලා ආයෙ try කරන්න.
- ඔයාගේ `.env` file එකේ පෞද්ගලික පිටපතක් තියාගන්න. ඒකේ ඔයාගේ keys තියෙනවා.
- `.env` හෝ `auth_info/` GitHub එකට කවදාවත් දාන්න එපා. ඒවා ලැබෙන ඕනෑම කෙනෙකුට ඔයාගේ bot එක පාලනය කරන්න පුළුවන්.

ඊළඟ වතාවේ bot එක දුවන්නේ නැත්නම් `bash tools/start.sh` run කරන්න.
---

## 🔄 Bot එක update කරන හැටි

ලේසිම ක්‍රමය: ඔයාගේ owner account එකෙන් **`.update`** යවන්න. Bot එක GitHub එකෙන් අලුත්ම code එක download කරලා, පරීක්ෂා කරලා, තනියම restart වෙනවා. අලුත් code එකේ වැරැද්දක් තිබුණොත් ඉබේම පරණ version එකට ආපහු යනවා.

අතින් කරන්න:

```bash
cd ~/whatsapp-bot
git pull
pm2 restart whatsapp-bot
```

---

## 💻 PC එකක / server එකක

1. ඔයාගේ system එකේ package manager එකෙන් **Node.js 20 හෝ ඊට වැඩි**, **git**, **ffmpeg**, **yt-dlp**, **ImageMagick** install කරන්න.
2. ඉහත පියවර 4 සිට 12 දක්වා කරන්න (Termux සහ Android කොටස් අත්හරින්න).
3. `pm2` එකම විදියට වැඩ. Server එකක නම් bot එක සැමවිටම දුවන්න තියනවා.

---

## ❓ ප්‍රශ්න විසඳන හැටි

| ප්‍රශ්නය | කරන්න ඕනේ |
|---|---|
| `Please give your number: node index.js 94...` | Command එකට පස්සේ ඔයාගේ number එක ලියන්න: `node index.js 94771234567` |
| Pairing code එක එන්නේ නෑ | Internet බලන්න. Number එක country code එක්ක, `+` නැතුව, මුල 0 නැතුව ලියන්න |
| Bot එක reply කරන්නේ නෑ | **වෙන number එකකින්** යවන්න. `pm2 status` බලන්න. `pm2 logs whatsapp-bot` බලන්න |
| Group එකේ bot එක reply කරන්නේ නෑ | **Bot number එක group එකේ member කෙනෙක්** වෙන්න ඕනේ. Admin commands වලට bot එකත් admin වෙන්න ඕනේ |
| "This command is for the bot owner only" | පියවර 11 කරන්න |
| `⚠️ OWNER_NUMBER is not set in the .env file` | `.env` එකට `OWNER_NUMBER=94771234567` එකතු කරලා (පියවර 7) bot එක restart කරන්න |
| `Logged out. Delete the auth_info folder...` | "Bot එක නතර වුණාම, logout වුණාම..." කොටසේ **ආ. WhatsApp ආයෙ link කරන්න** කරන්න |
| Phone එක restart වුණාට පස්සේ bot එක දුවන්නේ නෑ | `bash tools/start.sh` run කරන්න |
| `.mp3` / `.mp4` fail වෙනවා | Downloader එක update කරන්න: `pip install -U yt-dlp yt-dlp-ejs` |
| Photos, stickers, logos යවන්න බෑ | ඔයාගේ internet එකෙන් WhatsApp ගේ media server එක අවහිර වෙන්න පුළුවන්. Wi-Fi ↔ mobile data මාරු කරලා බලන්න |
| `.logo` එකෙන් ImageMagick නෑ කියනවා | `pkg install imagemagick -y` |
| `Cannot find module` | `npm install` කරලා bot එක restart කරන්න |
| Bot එක තනියම නවතිනවා | පියවර 12 හි phone settings කරන්න |

---

## ⚠️ වැදගත් සටහන්

- මේ bot එක **නිල නොවන** WhatsApp library එකක් පාවිච්චි කරනවා. WhatsApp එකට ඒ number එක **ban** කරන්න පුළුවන්. **අමතර number එකක්** පාවිච්චි කරන්න, ඔයාගේ main number එක කවදාවත් පාවිච්චි කරන්න එපා, ඒ වගේම එකවර ගොඩක් අයට messages යවන්න එපා.
- Downloads පෞද්ගලික පාවිච්චියට පමණයි. Copyright සහ හැම website එකකම නීති ගරු කරන්න.
- `.ocr`, `.tr`, `.stt` වලට යවන photos සහ voice notes Google ගේ Gemini service එකට යනවා. පෞද්ගලික ලේඛන, පුද්ගලික දත්ත සඳහා පාවිච්චි කරන්න එපා.
- ඔයාගේ `.env` file එකයි `auth_info` folder එකයි රහසිගතව තියන්න. ඒවා ලැබුණු ඕනෑම කෙනෙකුට ඔයාගේ bot එක පාලනය කරන්න පුළුවන්.