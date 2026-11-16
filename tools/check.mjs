// Checks that every relative import in index.js and src/ points to a file that exists.
// Run it from the project folder:  node tools/check.mjs
import fs from "fs";
import path from "path";

const files = ["index.js"];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
}
walk("src");

const importRegex = /(?:from\s+|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g;
let problems = 0;

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  for (const match of code.matchAll(importRegex)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(target)) {
      problems++;
      console.log(`❌ ${file}: cannot find ${match[1]}`);
    }
  }
}

console.log(
  problems
    ? `\n${problems} problem(s) found.`
    : `✅ All imports look correct (${files.length} files checked).`
);
process.exit(problems ? 1 : 0);