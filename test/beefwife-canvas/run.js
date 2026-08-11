const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const files = [
  "test/beefwife-canvas/routing.test.js",
  "test/beefwife-canvas/runtime.test.js",
  "test/beefwife-canvas/render.test.js",
  "test/beefwife-canvas/canvas.test.js",
  "test/beefwife-canvas/bundle.test.js",
];

for (const file of files) {
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
