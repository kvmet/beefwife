/**
 * Does the published tarball carry what it claims and run once installed?
 * Both entries are exercised: the module entry imports the peer renderer, the
 * classic-script entry reads a global that is absent here, so it must simulate
 * headless rather than fail to load.
 */

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
const packageRoot = join(root, "beefwife");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json")));
const example = JSON.stringify(
  JSON.parse(readFileSync(join(packageRoot, "beefwife.example.json"))),
);
const temporary = mkdtempSync(join(tmpdir(), "beefwife-package-"));
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
    "beefwife.example.json",
    "beefwife.js",
    "beefwife.min.js",
    "package.json",
    "src/atlas.mjs",
    "src/beefwife.mjs",
    "src/bend.mjs",
    "src/body.mjs",
    "src/carry.mjs",
    "src/chain.mjs",
    "src/descriptor.mjs",
    "src/display.mjs",
    "src/drive.mjs",
    "src/geometry.mjs",
    "src/global.mjs",
    "src/graphics.mjs",
    "src/legs.mjs",
    "src/model.mjs",
    "src/pixi.mjs",
    "src/schema.mjs",
    "src/skin.mjs",
    "src/tables.mjs",
  ]);

  const consumer = join(temporary, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), '{"private":true}\n');
  /* The renderer comes from the copy this repo already installed, so packing
     stays offline and the peer under test is the version the peer range names. */
  run(
    npm,
    [
      "install",
      join(temporary, packed.filename),
      join(packageRoot, "node_modules", "pixi.js"),
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    consumer,
  );

  writeFileSync(
    join(consumer, "module.mjs"),
    `import { Beefwife, Descriptor } from "@kvmet/beefwife";
     import * as PIXI from "pixi.js";
     const beefwife = new Beefwife(Descriptor.read(${example}));
     beefwife.step(1 / 60);
     if (!(beefwife instanceof PIXI.Container))
       throw new Error("the module entry did not reach the peer renderer");
     if (beefwife.children.length !== 1)
       throw new Error("packed Beefwife drew nothing");
     if (beefwife.getPose().head.x === 0) throw new Error("packed Beefwife is inert");`,
  );
  writeFileSync(
    join(consumer, "commonjs.cjs"),
    `const Beefwife = require("@kvmet/beefwife");
     const beefwife = new Beefwife(Beefwife.Descriptor.read(${example}));
     beefwife.step(1 / 60);
     if (beefwife.onRender !== null)
       throw new Error("the classic-script entry found a renderer it should not have");
     if (beefwife.getPose().head.x === 0) throw new Error("packed Beefwife is inert");`,
  );
  run(process.execPath, ["module.mjs"], consumer);
  run(process.execPath, ["commonjs.cjs"], consumer);

  const installed = JSON.parse(
    readFileSync(join(consumer, "node_modules/@kvmet/beefwife/package.json")),
  );
  assert.equal(installed.license, "MPL-2.0");
  assert.equal(installed.dependencies, undefined);
  assert.deepEqual(Object.keys(installed.peerDependencies), ["pixi.js"]);
  console.log(
    `${manifest.name}@${packed.version}: ${packed.size} byte tarball, ` +
      `${packed.unpackedSize} bytes unpacked: safe`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
