const assert = require("node:assert/strict");

const BeefwifeCanvasRender = require(
  "../../beefwife-canvas/beefwife-canvas-render.js"
);

const graphics = () => {
  const calls = [];
  const target = { calls };
  for (const method of ["circle", "clear", "lineTo", "moveTo", "rect", "stroke"])
    target[method] = (...args) => {
      calls.push([method, ...args]);
      return target;
    };
  return target;
};

const underlay = graphics();
const overlay = graphics();
const beefwife = { destroyed: false, getPose: () => ({ head: { x: 1, y: 2 } }) };
const actor = {
  beefwife,
  planner: { goal: { x: 12, y: 14 } },
  route: { path: [{ x: 5, y: 6 }, { x: 9, y: 10 }] },
};
const host = {
  actors: [actor],
  application: { render() {} },
  debug: { navigation: false, routes: false, targets: false, terrain: false },
  debugOverlay: overlay,
  debugUnderlay: underlay,
  displayed: [],
  terrain: {
    cells: [{ left: 20, lo: 21, right: 30, hi: 31 }],
    gates: [{ x: 25, lo: 22, hi: 29 }],
    rects: [{ left: 2, top: 3, right: 8, bottom: 9 }],
    x0: 0,
    x1: 100,
    y0: 0,
    y1: 80,
  },
  world: { addChildAt() {} },
};

const draw = (layer) => {
  underlay.calls.length = 0;
  overlay.calls.length = 0;
  host.debug = { navigation: false, routes: false, targets: false, terrain: false };
  host.debug[layer] = true;
  BeefwifeCanvasRender.draw(host);
};

draw("targets");
assert.ok(overlay.calls.some((call) => call[0] === "circle" && call[3] === 5));
assert.equal(underlay.calls.some((call) => call[0] === "rect"), false);

draw("routes");
assert.equal(
  overlay.calls.filter((call) => call[0] === "circle" && call[3] === 2.5).length,
  2,
);
assert.equal(overlay.calls.some((call) => call[0] === "circle" && call[3] === 5), false);

draw("terrain");
assert.equal(underlay.calls.filter((call) => call[0] === "rect").length, 2);

draw("navigation");
assert.equal(underlay.calls.filter((call) => call[0] === "rect").length, 1);
assert.ok(underlay.calls.some((call) => call[0] === "moveTo"));

console.log("BeefwifeCanvas debug rendering: 7 layer checks passed");
