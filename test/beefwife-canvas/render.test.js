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
const actor = {
  display: { destroyed: false },
  head: { x: 1, y: 2 },
  target: { x: 12, y: 14 },
  route: [{ x: 5, y: 6 }, { x: 9, y: 10 }],
};
const host = {
  actors: [actor],
  debug: { routes: false, targets: false, terrain: false },
  scene: {
    debugOverlay: overlay,
    debugUnderlay: underlay,
    render() {},
    syncDisplays() {},
  },
  terrainView: {
    bounds: { left: 0, top: 0, right: 100, bottom: 80 },
    rectangles: [{ left: 2, top: 3, right: 8, bottom: 9 }],
  },
};

const draw = (layer) => {
  underlay.calls.length = 0;
  overlay.calls.length = 0;
  host.debug = { routes: false, targets: false, terrain: false };
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

console.log("BeefwifeCanvas debug rendering: 5 layer checks passed");
