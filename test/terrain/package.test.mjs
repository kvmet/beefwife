import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const packageRoot = join(root, "terrain");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json")));
const temporary = mkdtempSync(join(tmpdir(), "terrain-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: join(temporary, "npm-cache"),
      npm_config_update_notifier: "false",
    },
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
  return result.stdout;
};

try {
  const packed = JSON.parse(
    run(
      npm,
      ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary],
      packageRoot,
    ),
  )[0];
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.deepEqual(packed.files.map((file) => file.path).sort(), [
    "LICENSE",
    "README.md",
    "demo.html",
    "package.json",
    "src/mesh.mjs",
    "src/support.mjs",
    "src/terrain.mjs",
    "terrain.js",
    "terrain.min.js",
  ]);

  const consumer = join(temporary, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), '{"private":true}\n');
  run(
    npm,
    [
      "install",
      join(temporary, packed.filename),
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    consumer,
  );

  const smoke = `
const terrain = new Terrain({
  avoid: [],
  edgeMargin: 0,
  viewport: { width: 100, height: 80 },
}).build();
const route = terrain.route({ x: 1, y: 2 }, { x: 3, y: 4 });
if (
  !terrain.ready ||
  terrain.nearest(1, 2).distance !== 0 ||
  terrain.offset(1, 2).distance !== 0 ||
  route.length !== 2 ||
  route.moved
)
  throw new Error("packed Terrain failed");
`;
  writeFileSync(
    join(consumer, "commonjs.cjs"),
    `const Terrain = require("@kvmet/terrain");${smoke}`,
  );
  writeFileSync(
    join(consumer, "module.mjs"),
    `import Terrain from "@kvmet/terrain";${smoke}`,
  );
  run(process.execPath, ["commonjs.cjs"], consumer);
  run(process.execPath, ["module.mjs"], consumer);

  const installed = JSON.parse(
    readFileSync(join(consumer, "node_modules/@kvmet/terrain/package.json")),
  );
  assert.equal(installed.license, "MIT");
  assert.equal(installed.dependencies, undefined);
  console.log(
    `@kvmet/terrain@${packed.version}: ${packed.size} byte tarball, ` +
      `${packed.unpackedSize} bytes unpacked: safe`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
