import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const cases = [
  ["test/terrain/demo.test.mjs"],
  ["test/terrain/module.test.mjs"],
  ["test/terrain/terrain.test.js"],
  ["test/terrain/terrain.test.js", "terrain.min.js"],
];

for (const args of cases) {
  const check = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
  });
  if (check.error) throw check.error;
  if (check.status !== 0) process.exit(check.status ?? 1);
}
