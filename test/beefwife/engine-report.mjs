/**
 * Runs the engine scripts once per case per engine and lays the results side
 * by side. Every case gets its own process, so nothing a case measures was
 * warmed by a case before it. Each table names the script its cases live in:
 * `engines.js` for the bend solver's trigonometry, `engines-layout.js` for the
 * chunk-state layout of the single-sweep loops, and `engines-bend.js` for the
 * span sweep.
 *
 * JavaScriptCore is the engine behind every browser on iOS, and it is only
 * reachable here on macOS. Where it is missing the column is left out and the
 * V8 numbers stand alone, which is the situation the report exists to warn
 * about rather than one to fail on.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptFor = (name) => path.join(here, name);
const JSC =
  "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc";

const engines = [{ label: "V8", command: process.execPath, separator: [] }];
if (fs.existsSync(JSC))
  engines.push({ label: "JSC", command: JSC, separator: ["--"] });

const TABLES = [
  {
    title: "bend solver, nanoseconds per joint",
    script: "engines.js",
    baseline: "builtin",
    rows: [
      ["builtin", "Math.atan2 + Math.cos/sin"],
      ["poly-trig", "Math.atan2 + poly sin/cos"],
      ["poly9", "poly9 atan2 + Math.cos/sin"],
      ["poly5", "poly5 atan2 + Math.cos/sin"],
      ["all-poly", "poly9 atan2 + poly sin/cos"],
    ],
  },
  {
    title: "link relaxation, nanoseconds per pass over 49 chunks",
    script: "engines-layout.js",
    baseline: "relax-objects",
    rows: [
      ["relax-objects", "one object per chunk"],
      ["relax-typed", "parallel typed arrays"],
    ],
  },
  {
    title: "tangent update, nanoseconds per pass over 49 chunks",
    script: "engines-layout.js",
    baseline: "tangents-objects",
    rows: [
      ["tangents-objects", "one object per chunk"],
      ["tangents-typed", "parallel typed arrays"],
    ],
  },
  {
    title: "bend span sweep, nanoseconds per pass over 49 chunks",
    script: "engines-bend.js",
    baseline: "bend-objects",
    rows: [
      ["bend-objects", "one object per chunk"],
      ["bend-typed", "parallel typed arrays"],
    ],
  },
  /* The loop that reads and writes every field, so it is where a layout of ten
     separate arrays has the most streams to keep open at once and the least to
     gain. Reported whatever it says. */
  {
    title: "integrate, nanoseconds per pass over 49 chunks",
    script: "engines-layout.js",
    baseline: "integrate-objects",
    rows: [
      ["integrate-objects", "one object per chunk"],
      ["integrate-typed", "parallel typed arrays"],
    ],
  },
];

const run = (engine, script, name) => {
  const result = spawnSync(
    engine.command,
    [scriptFor(script), ...engine.separator, name],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      `${engine.label} failed on ${name}: ${result.stderr || result.stdout}`,
    );
  return Number.parseFloat(result.stdout);
};

for (const engine of engines) console.log(`engine: ${engine.label}`);
console.log("");

for (const table of TABLES) {
  console.log(table.title);
  console.log(
    "".padStart(30) +
      engines
        .map((e) => `${e.label} ns`.padStart(9) + "ratio".padStart(8))
        .join(""),
  );
  const baseline = new Map(
    engines.map((engine) => [
      engine.label,
      run(engine, table.script, table.baseline),
    ]),
  );
  for (const [name, label] of table.rows) {
    let line = `  ${label}`.padEnd(30);
    for (const engine of engines) {
      const nanoseconds =
        name === table.baseline
          ? baseline.get(engine.label)
          : run(engine, table.script, name);
      const ratio = baseline.get(engine.label) / nanoseconds;
      line +=
        nanoseconds.toFixed(2).padStart(9) + `${ratio.toFixed(2)}x`.padStart(8);
    }
    console.log(line);
  }
  console.log("");
}

if (engines.length === 1)
  console.log(
    "Only V8 was measured. These numbers say nothing about iOS, where every\n" +
      "browser runs JavaScriptCore. Rerun on macOS before acting on them.",
  );
else
  console.log(
    "Ratios are against each engine's own baseline, so a row is only worth\n" +
      "shipping unconditionally where it holds at or above 1.00x in every column.",
  );
