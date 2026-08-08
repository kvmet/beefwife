/**
 * Rewrite the example and every cast fixture in canonical schema form.
 * `read` validates and returns canonical key order, so this changes ordering
 * and the trailing newline only; a file it cannot read is left alone and
 * reported.
 */

const fs = require("node:fs");
const path = require("node:path");
const BeefwifeDescriptor = require("../beefwife/beefwife-descriptor.js");

const root = path.join(__dirname, "..");
const castDir = path.join(root, "test", "fixtures", "beefwives");
const files = [
  path.join(root, "beefwife", "beefwife.example.json"),
  ...fs
    .readdirSync(castDir)
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .sort()
    .map((name) => path.join(castDir, name)),
];

let rewritten = 0;
let failed = 0;
for (const file of files) {
  const shown = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  let canonical;
  try {
    canonical = `${BeefwifeDescriptor.stringify(BeefwifeDescriptor.parse(text))}\n`;
  } catch (error) {
    console.error(`${shown}: ${error.message}`);
    failed++;
    continue;
  }
  if (canonical === text) continue;
  fs.writeFileSync(file, canonical);
  console.log(`${shown}: rewritten`);
  rewritten++;
}

console.log(`format-cast: ${rewritten} rewritten, ${failed} unreadable`);
if (failed) process.exitCode = 1;
