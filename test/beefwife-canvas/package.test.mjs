/**
 * Does the published tarball carry what it claims and run once installed?
 * The bundle inlines Beefwife and Terrain, so the check is that a page needs
 * nothing but a renderer: one global appears, it carries the schema, and the
 * install pulls down no dependencies of its own.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const packageRoot = join(root, "beefwife-canvas");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json")));
const temporary = mkdtempSync(join(tmpdir(), "beefwife-canvas-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (command, args, cwd) => {
  const env = {};
  // A parent `npm pack --dry-run` exports NPM_CONFIG_DRY_RUN, and a nested
  // npm inherits it, so the tarball this test installs is never written.
  for (const [key, value] of Object.entries(process.env))
    if (!/^npm_config_dry_run$/i.test(key)) env[key] = value;
  env.npm_config_cache = join(temporary, "npm-cache");
  env.npm_config_update_notifier = "false";
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
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
    "CHANGELOG.md",
    "LICENSE",
    "README.md",
    "beefwife-canvas.js",
    "beefwife-canvas.min.js",
    "beefwife-canvas.mjs",
    "package.json",
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

  /* The bundle mounts whatever the page already holds, so the page has to
     exist before it loads. Nothing is on it, which is the point: the load
     itself must not reach for a renderer. */
  writeFileSync(
    join(consumer, "page.cjs"),
    `globalThis.document = { readyState: "complete", querySelectorAll: () => [] };
     const BeefwifeCanvas = require("@kvmet/beefwife-canvas");
     for (const key of ["get", "mount", "scan"])
       if (typeof BeefwifeCanvas[key] !== "function")
         throw new Error(\`packed BeefwifeCanvas is missing \${key}\`);
     if (BeefwifeCanvas.Descriptor.VERSION !== 1)
       throw new Error("the bundle did not carry the schema out with it");
     BeefwifeCanvas.Descriptor.read(
       JSON.parse(require("node:fs").readFileSync(process.argv[2], "utf8")),
     );`,
  );
  run(
    process.execPath,
    ["page.cjs", join(root, "beefwife", "beefwife.example.json")],
    consumer,
  );

  /* The module entry resolves the peer instead of reading a global, so this
     consumer gets a renderer and the one above deliberately does not. */
  const moduleConsumer = join(temporary, "consumer-module");
  mkdirSync(moduleConsumer);
  writeFileSync(join(moduleConsumer, "package.json"), '{"private":true}\n');
  run(
    npm,
    [
      "install",
      join(temporary, packed.filename),
      "--ignore-scripts",
      "--offline",
      "--legacy-peer-deps",
      "--no-audit",
      "--no-fund",
    ],
    moduleConsumer,
  );
  /* The peer is symlinked rather than installed, so this smoke test needs no
     registry access. npm runs a local directory dependency's prepare script
     even under --ignore-scripts, and pixi ships `prepare: husky install`,
     which fails wherever husky is absent. */
  symlinkSync(
    join(packageRoot, "node_modules", "pixi.js"),
    join(moduleConsumer, "node_modules", "pixi.js"),
    "dir",
  );
  // The stub has to land before the entry evaluates, so the import is dynamic.
  writeFileSync(
    join(moduleConsumer, "page.mjs"),
    `globalThis.document = { readyState: "complete", querySelectorAll: () => [] };
     const { default: BeefwifeCanvas } = await import("@kvmet/beefwife-canvas");
     const PIXI = await import("pixi.js");
     for (const key of ["get", "mount", "scan"])
       if (typeof BeefwifeCanvas[key] !== "function")
         throw new Error(\`the module entry is missing \${key}\`);
     if (BeefwifeCanvas.Descriptor.VERSION !== 1)
       throw new Error("the module entry did not carry the schema out with it");
     if (typeof PIXI.Container !== "function")
       throw new Error("the module entry did not reach the peer renderer");`,
  );
  run(process.execPath, ["page.mjs"], moduleConsumer);

  const installed = JSON.parse(
    readFileSync(
      join(consumer, "node_modules/@kvmet/beefwife-canvas/package.json"),
    ),
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
