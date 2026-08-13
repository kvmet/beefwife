/**
 * What a shape instance costs to place, retained against batched.
 *
 * Every foot, plate and ornament is its own Graphics, and the library only
 * writes a transform onto each one per frame; Pixi turns those into vertices
 * at render time. The alternative is one mesh per shape family with the
 * instances written into a vertex buffer directly. Which wins depends on how
 * many vertices a shape has, so the buffer side is swept rather than sampled,
 * and the crossover is the number the answer turns on.
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { PIXI } from "../../beefwife/src/pixi.mjs";
import { setShapeTransform } from "../../beefwife/src/display.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const descriptor = JSON.parse(
  fs.readFileSync(
    path.join(here, "..", "fixtures", "beefwives", "chevron-guy.json"),
    "utf8",
  ),
);

const CREATURES = 400;
const PER_CREATURE = 43; // chevron-guy's feet, plates and ornaments
const COUNT = CREATURES * PER_CREATURE;
const SWEEP = [6, 12, 24, 48, 96, 192, 384];

const spec = {
  shape: descriptor.definitions.shapes.foot,
  paint: { fill: 0xcc8866, stroke: 0x221100, strokeWidth: 3.1 },
};

/* Every instance moves and turns each frame, as it does in life. Feeding both
   sides a still pose would let a cache hold what a running page cannot. */
const x = new Float64Array(COUNT);
const y = new Float64Array(COUNT);
const dx = new Float64Array(COUNT);
const dy = new Float64Array(COUNT);
const scale = new Float64Array(COUNT);
const seed = (index, salt) => Math.sin(index * 12.9898 + salt) * 0.5 + 0.5;
const stir = (frame) => {
  for (let index = 0; index < COUNT; index++) {
    const angle = seed(index, 1) * 6.28 + frame * 0.01;
    x[index] = seed(index, 2) * 1200 + Math.cos(angle) * 3;
    y[index] = seed(index, 3) * 800 + Math.sin(angle) * 3;
    dx[index] = Math.cos(angle);
    dy[index] = Math.sin(angle);
    scale[index] = 3;
  }
};

const root = new PIXI.Container();
const parts = [];
for (let creature = 0; creature < CREATURES; creature++) {
  const holder = root.addChild(new PIXI.Container());
  for (let part = 0; part < PER_CREATURE; part++) {
    const graphics = holder.addChild(new PIXI.Graphics());
    graphics.scaleBucket = null;
    parts.push(graphics);
  }
}
const retained = () => {
  for (let index = 0; index < COUNT; index++)
    setShapeTransform(
      parts[index],
      spec,
      x[index],
      y[index],
      dx[index],
      dy[index],
      scale[index],
      1,
      1,
      1,
    );
};

let vertexCount = 0;
let shapeX;
let shapeY;
let buffer;
const shapeOf = (count) => {
  vertexCount = count;
  shapeX = new Float64Array(count);
  shapeY = new Float64Array(count);
  for (let vertex = 0; vertex < count; vertex++) {
    const angle = (vertex / count) * 6.283185307179586;
    shapeX[vertex] = Math.cos(angle) * 4;
    shapeY[vertex] = Math.sin(angle) * 4;
  }
  buffer = new Float32Array(COUNT * count * 2);
};
/* dx and dy are already the rotation basis, so the batched side takes no
   angle and turns none back into a sine and cosine. */
const batched = () => {
  let at = 0;
  for (let index = 0; index < COUNT; index++) {
    const originX = x[index];
    const originY = y[index];
    const cosine = dx[index] * scale[index];
    const sine = dy[index] * scale[index];
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const localX = shapeX[vertex];
      const localY = shapeY[vertex];
      buffer[at++] = originX + localX * cosine - localY * sine;
      buffer[at++] = originY + localX * sine + localY * cosine;
    }
  }
};

const time = (run, milliseconds) => {
  let frame = 0;
  const started = performance.now();
  let elapsed;
  do {
    stir(frame++);
    run();
    elapsed = performance.now() - started;
  } while (elapsed < milliseconds);
  return elapsed / frame;
};
/* stir() runs on both sides, so its cost is measured once and taken off both;
   what is left is the placement each approach actually does. */
const stirOnly = () => {};

shapeOf(6);
time(retained, 400);
time(batched, 400);
time(stirOnly, 200);
const overhead = time(stirOnly, 400);
const retainedFrame = time(retained, 1000) - overhead;

console.log(`${COUNT} shape instances (${CREATURES} x ${PER_CREATURE})`);
console.log("");
console.log(
  `  retained Graphics, transform only   ${retainedFrame.toFixed(2)} ms/frame`,
);
console.log(
  "  flat in the shape's size: Pixi is handed a context reference here,",
);
console.log("  and walks the vertices later, during render.");
console.log("");
console.log("     shape vtx   batched ms    ratio    buffer MB");
for (const count of SWEEP) {
  shapeOf(count);
  time(batched, 300);
  const batchedFrame = time(batched, 800) - overhead;
  console.log(
    String(count).padStart(14) +
      batchedFrame.toFixed(2).padStart(13) +
      `${(retainedFrame / batchedFrame).toFixed(1)}x`.padStart(9) +
      ((COUNT * count * 2 * 4) / 1048576).toFixed(1).padStart(13),
  );
}
console.log("");
console.log("Batching pays only where the ratio is above 1x. Below it, the");
console.log("retained path is already cheaper than writing the vertices.");
