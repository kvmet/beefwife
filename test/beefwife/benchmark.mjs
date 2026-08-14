/**
 * How many beefwives a frame affords. Cost is reported per creature against
 * population size, because a lone creature runs entirely out of cache and
 * flatters any change made for locality; the shape of that curve is the part
 * an optimisation has to move.
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Beefwife } from "../../beefwife/src/beefwife.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "..", "..", "beefwife", "samples");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(fixtures, `${name}.json`), "utf8"));

const FRAME = 1 / 60;
const FRAME_BUDGET_US = 16666;
const POPULATIONS = [1, 10, 50, 150, 400];
/* The weights the example manifest ships, so one column stands for a page
   rather than four hundred copies of one descriptor. */
const MIXED = [
  ["slow-guy", 3],
  ["long-girl", 1],
  ["bounding", 1],
];
const CASTS = [
  { label: "chevron-guy", pick: () => ["chevron-guy"] },
  { label: "long-girl", pick: () => ["long-girl"] },
  { label: "undulating", pick: () => ["undulating"] },
  { label: "slow-guy", pick: () => ["slow-guy"] },
  {
    label: "mixed cast",
    pick: () => MIXED.flatMap(([name, weight]) => Array(weight).fill(name)),
  },
];

/* A fixed stream, so a population is the same population run to run and two
   benchmark runs differ only by the code between them. */
const seeded = (seed) => () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const populate = (names, count) => {
  const random = seeded(0x9e3779b9);
  const descriptors = new Map(names.map((name) => [name, read(name)]));
  const crowd = [];
  for (let index = 0; index < count; index++) {
    const name = names[index % names.length];
    crowd.push(
      new Beefwife(descriptors.get(name), {
        position: { x: (index % 40) * 37, y: Math.floor(index / 40) * 41 },
        direction: { x: 1, y: 0 },
        phase: random() * Math.PI * 2,
        random,
      }),
    );
  }
  return crowd;
};

/* Shapes are particles out of a baked atlas, and the atlas is only built once
   a renderer arrives. Drawing without one leaves a creature holding its two
   meshes and no shapes at all, which reads as a draw two thirds cheaper than
   the one a page pays. Standing in for the renderer costs only the rasterising,
   which is the GPU's half and not what this measures. */
const STAND_IN_RENDERER = { render() {} };

/* Every creature is stepped before any is drawn, matching how the canvas
   runtime drives a population: one update pass, then one render pass. */
const frameOf = (crowd, controls, draw) => () => {
  for (const beefwife of crowd) beefwife.step(FRAME, controls);
  if (draw)
    for (const beefwife of crowd) beefwife.onRender?.(STAND_IN_RENDERER);
};

const microsecondsPer = (run, count, milliseconds) => {
  const started = performance.now();
  let frames = 0;
  let elapsed;
  do {
    run();
    frames++;
    elapsed = performance.now() - started;
  } while (elapsed < milliseconds);
  return (elapsed * 1000) / (frames * count);
};

const measure = (names, count) => {
  const crowd = populate(names, count);
  const controls = { throttle: 1, direction: { x: 1, y: 0 } };
  const whole = frameOf(crowd, controls, true);
  const simulate = frameOf(crowd, controls, false);
  /* Warmed on a clock rather than a frame count: a small population needs
     many more frames than a large one to reach the same iteration count, and
     counting frames leaves it measured before it is compiled. */
  microsecondsPer(whole, count, 200);
  const frame = microsecondsPer(whole, count, 300);
  microsecondsPer(simulate, count, 200);
  const step = microsecondsPer(simulate, count, 300);
  let checksum = 0;
  for (const beefwife of crowd) {
    checksum += beefwife.getPose().center.x;
    beefwife.destroy();
  }
  return { frame, step, checksum };
};

const grid = new Map();
let checksum = 0;
for (const cast of CASTS) {
  const names = cast.pick();
  for (const count of POPULATIONS) {
    const result = measure(names, count);
    grid.set(`${cast.label}:${count}`, result);
    checksum += result.checksum;
  }
}

const width = 13;
const label = (text) => String(text).padStart(width);
const number = (value) => label(value.toFixed(1));

console.log(`Beefwife frame cost on ${process.version}`);
console.log("");
console.log("microseconds per creature per frame, simulation and draw");
console.log(
  label("population") + CASTS.map((cast) => label(cast.label)).join(""),
);
for (const count of POPULATIONS)
  console.log(
    label(count) +
      CASTS.map((cast) => number(grid.get(`${cast.label}:${count}`).frame)).join(
        "",
      ),
  );

const busiest = POPULATIONS[POPULATIONS.length - 1];
console.log("");
console.log(`at ${busiest} on screen`);
console.log(
  label("") + CASTS.map((cast) => label(cast.label)).join(""),
);
const row = (name, of) =>
  console.log(label(name) + CASTS.map((cast) => of(grid.get(`${cast.label}:${busiest}`))).join(""));
row("step us", (r) => number(r.step));
row("draw us", (r) => number(r.frame - r.step));
row("N at 60fps", (r) => label(Math.floor(FRAME_BUDGET_US / r.frame)));
console.log(
  label("vs alone") +
    CASTS.map((cast) =>
      label(
        (
          grid.get(`${cast.label}:${busiest}`).frame /
          grid.get(`${cast.label}:1`).frame
        ).toFixed(2) + "x",
      ),
    ).join(""),
);

if (!Number.isFinite(checksum))
  throw new Error("benchmark produced invalid output");
