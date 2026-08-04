import assert from "node:assert/strict";

import Terrain from "../../terrain/src/terrain.mjs";

const terrain = new Terrain({
  avoid: [],
  edgeMargin: 0,
  viewport: { width: 100, height: 80 },
}).build();

assert.equal(terrain.ready, true);
assert.deepEqual(terrain.at(20, 30), { dx: 0, dy: 0, d: 0 });
assert.deepEqual(
  terrain.route({ x: 10, y: 20 }, { x: 90, y: 60 }),
  [
    { x: 10, y: 20 },
    { x: 90, y: 60 },
  ],
);

console.log("Terrain ES module: safe");
