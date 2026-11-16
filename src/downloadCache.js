import fs from "fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(ROOT, "data", "cache");
const INDEX_FILE = path.join(DIR, "index.json");

export const CACHE_ENABLED = config.cacheDownloads !== false;
const MAX_TOTAL =
  (Number(config.cacheMaxMB) > 0 ? Number(config.cacheMaxMB) : 500) * 1024 * 1024;
const MAX_FILE =
  (Number(config.cacheMaxFileMB) > 0 ? Number(config.cacheMaxFileMB) : 100) * 1024 * 1024;
const MAX_AGE_MS =
  (Number(config.cacheDays) > 0 ? Number(config.cacheDays) : 7) * 24 * 60 * 60 * 1000;

// index: key -> { file, size, meta, added, lastUsed }
let index = {};
try {
  if (existsSync(INDEX_FILE)) index = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
} catch {
  index = {};
}

function saveIndex() {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(INDEX_FILE, JSON.stringify(index));
  } catch (err) {
    console.error("Cache index save error:", err.message);
  }
}

async function removeEntry(key) {
  const entry = index[key];
  delete index[key];
  if (entry) await fs.rm(path.join(DIR, entry.file), { force: true }).catch(() => {});
}

// Deletes expired files, then the least recently used files until the cache fits
async function evict() {
  const now = Date.now();
  for (const [key, e] of Object.entries(index)) {
    if (now - e.added > MAX_AGE_MS) await removeEntry(key);
  }

  let total = Object.values(index).reduce((sum, e) => sum + e.size, 0);
  const oldestFirst = Object.entries(index).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key, e] of oldestFirst) {
    if (total <= MAX_TOTAL) break;
    total -= e.size;
    await removeEntry(key);
  }
}

// On start: remove files that are not in the index (left over from a crash)
(async () => {
  try {
    if (!existsSync(DIR)) return;
    const known = new Set(Object.values(index).map((e) => e.file));
    for (const name of await fs.readdir(DIR)) {
      if (name !== "index.json" && !known.has(name)) {
        await fs.rm(path.join(DIR, name), { force: true });
      }
    }
    await evict();
    saveIndex();
  } catch (err) {
    console.error("Cache cleanup error:", err.message);
  }
})();

// Returns { path, meta } if the file is cached and still fresh, otherwise null
export async function cacheGet(key) {
  if (!CACHE_ENABLED) return null;
  const entry = index[key];
  if (!entry) return null;

  const file = path.join(DIR, entry.file);
  if (Date.now() - entry.added > MAX_AGE_MS || !existsSync(file)) {
    await removeEntry(key);
    saveIndex();
    return null;
  }

  entry.lastUsed = Date.now();
  saveIndex();
  return { path: file, meta: entry.meta };
}

// Saves a copy of a downloaded file. It never throws, so a cache problem cannot break a download.
export async function cacheAdd(key, srcPath, meta) {
  if (!CACHE_ENABLED) return;
  try {
    const { size } = await fs.stat(srcPath);
    if (size > MAX_FILE || size > MAX_TOTAL) return;

    await fs.mkdir(DIR, { recursive: true });
    const name =
      crypto.createHash("sha1").update(key).digest("hex").slice(0, 20) + path.extname(srcPath);
    await fs.copyFile(srcPath, path.join(DIR, name));

    if (index[key] && index[key].file !== name) await removeEntry(key);
    const now = Date.now();
    index[key] = { file: name, size, meta, added: now, lastUsed: now };

    await evict();
    saveIndex();
  } catch (err) {
    console.error("Cache add error:", err.message);
  }
}

export function cacheStats() {
  const entries = Object.values(index);
  return {
    count: entries.length,
    bytes: entries.reduce((sum, e) => sum + e.size, 0),
    maxBytes: MAX_TOTAL,
    days: MAX_AGE_MS / (24 * 60 * 60 * 1000),
  };
}

export async function cacheClear() {
  for (const key of Object.keys(index)) await removeEntry(key);
  saveIndex();
}