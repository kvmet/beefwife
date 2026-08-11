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
    "beefwife-canvas.js",
    "beefwife-canvas.min.js",
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
