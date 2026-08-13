const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const files = [
  "test/beefwife/descriptor.test.js",
  "test/beefwife/schema.test.js",
  "test/beefwife/scale.test.js",
  "test/beefwife/model.test.js",
  "test/beefwife/gait.test.js",
  "test/beefwife/body.test.js",
  "test/beefwife/bend.test.js",
  "test/beefwife/legs.test.js",
  "test/beefwife/rates.test.js",
  "test/beefwife/limb.test.js",
  "test/beefwife/skin.test.js",
  "test/beefwife/graphics.test.js",
  "test/beefwife/geometry.test.js",
  "test/beefwife/triangulation.test.js",
  "test/beefwife/api.test.js",
];

for (const file of files) {
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
