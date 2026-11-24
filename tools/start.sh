#!/data/data/com.termux/files/usr/bin/bash
# Starts the bot with pm2, or restarts it if it is already in the pm2 list.
# Run it from anywhere:  bash tools/start.sh

termux-wake-lock 2>/dev/null   # keeps Android from putting Termux to sleep (only exists in Termux)

cd "$(dirname "$0")/.." || exit 1

if pm2 describe whatsapp-bot > /dev/null 2>&1; then
  pm2 restart whatsapp-bot --update-env
else
  pm2 start index.js --name whatsapp-bot --max-memory-restart 400M
fi

pm2 save
pm2 logs whatsapp-bot --lines 20