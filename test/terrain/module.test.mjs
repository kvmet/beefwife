import assert from "node:assert/strict";

import Terrain from "../../terrain/src/terrain.mjs";

const terrain = new Terrain({
  avoid: [],
  edgeMargin: 0,
  viewport: { width: 100, height: 80 },
}).build();

assert.equal(terrain.ready, true);
assert.deepEqual(terrain.nearest(20, 30), {
  x: 20,
  y: 30,
  distance: 0,
});
assert.deepEqual(terrain.offset(20, 30), {
  dx: 0,
  dy: 0,
  distance: 0,
});
const route = terrain.route({ x: 10, y: 20 }, { x: 90, y: 60 });
assert.deepEqual(
  [...route],
  [
    { x: 10, y: 20 },
    { x: 90, y: 60 },
  ],
);
assert.equal(route.moved, false);

console.log("Terrain ES module: safe");
