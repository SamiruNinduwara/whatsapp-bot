import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { saveRestartTarget } from "../restartNotice.js";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// pm2 sets pm_id for the apps it manages, and it starts them again when they exit
const MANAGED_BY_PM2 = process.env.pm_id !== undefined;
let busy = false;

// Never print a token that may be inside a git URL
const redact = (text = "") => String(text).replace(/\/\/[^@\s/]+@/g, "//***@");

function git(args, timeout = 60000) {
  return run("git", args, {
    cwd: ROOT,
    timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, // fail instead of waiting for a password
    maxBuffer: 5 * 1024 * 1024,
  });
}

export default {
  name: "update",
  aliases: ["pull"],
  description: "Owner only: download the latest code from GitHub and restart",
  ownerOnly: true,
  async run({ sock, msg, jid }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg });

    if (busy) return reply("⏳ An update is already running.");
    busy = true;

    try {
      await reply("🔍 Checking GitHub for updates...");

      const before = (await git(["rev-parse", "HEAD"])).stdout.trim();

      // 1. Get the new code
      try {
        await git(["pull", "--ff-only"], 120000);
      } catch (err) {
        console.error("Update: git pull failed:", redact(err.stderr || err.message));
        return reply(
          "❌ Couldn't pull the update. It may be a network or login problem, or local changes on this phone are in the way. " +
            "Run `git pull` in Termux to see the reason."
        );
      }

      const after = (await git(["rev-parse", "HEAD"])).stdout.trim();
      if (before === after) {
        return reply(`✅ Already up to date (${after.slice(0, 7)}). No restart needed.`);
      }

      const changed = (await git(["diff", "--name-only", before, after])).stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      // 2. Syntax check: never restart into broken code
      const broken = [];
      for (const file of changed.filter((f) => /\.m?js$/.test(f))) {
        const full = path.join(ROOT, file);
        if (!fs.existsSync(full)) continue; // the file was deleted
        try {
          await run(process.execPath, ["--check", full], { timeout: 30000 });
        } catch (err) {
          console.error(`Update: syntax error in ${file}:`, redact(err.stderr || err.message));
          broken.push(file);
        }
      }
      if (broken.length) {
        await git(["reset", "--hard", before]);
        return reply(
          `❌ The update has a syntax error in: ${broken.join(", ")}\n` +
            `I rolled back to the previous version (${before.slice(0, 7)}) and did NOT restart.\n` +
            `Fix the code, push it again, then send .update.`
        );
      }

      // 3. Install new packages only if the package files changed
      if (changed.some((f) => f === "package.json" || f === "package-lock.json")) {
        await reply("📦 Installing new packages...");
        try {
          await run("npm", ["install", "--no-audit", "--no-fund"], {
            cwd: ROOT,
            timeout: 10 * 60 * 1000,
            maxBuffer: 10 * 1024 * 1024,
          });
        } catch (err) {
          console.error("Update: npm install failed:", redact(err.stderr || err.message));
          await git(["reset", "--hard", before]);
          return reply(
            "❌ `npm install` failed, so I rolled back to the previous version and did NOT restart."
          );
        }
      }

      // 4. Summary
      const subject = (await git(["log", "-1", "--pretty=%s"])).stdout.trim().slice(0, 80);
      const list =
        changed.slice(0, 10).map((f) => `• ${f}`).join("\n") +
        (changed.length > 10 ? `\n• ...and ${changed.length - 10} more` : "");
      const summary =
        `✅ Updated ${before.slice(0, 7)} ➜ ${after.slice(0, 7)}\n` +
        `📝 ${subject}\n\n` +
        `📂 Changed files (${changed.length}):\n${list}`;

      if (!MANAGED_BY_PM2) {
        return reply(
          `${summary}\n\n⚠️ I'm not running under pm2, so I can't restart myself. Restart me manually to use the new code.`
        );
      }

      // 5. Restart (pm2 starts a fresh copy) and announce when back online
      saveRestartTarget(jid, `📝 Updated to ${after.slice(0, 7)}`);
      await reply(`${summary}\n\n🔄 Restarting...`);
      setTimeout(() => process.exit(0), 1500);
    } catch (err) {
      console.error("Update error:", redact(err.message));
      await reply("❌ The update failed. Check the logs: pm2 logs whatsapp-bot");
    } finally {
      busy = false;
    }
  },
};