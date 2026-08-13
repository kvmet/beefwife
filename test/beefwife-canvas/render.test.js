const assert = require("node:assert/strict");

const BeefwifeCanvasRender = require("../../beefwife-canvas/src/render.mjs");

const graphics = () => {
  const calls = [];
  const target = { calls };
  for (const method of [
    "circle",
    "clear",
    "lineTo",
    "moveTo",
    "rect",
    "stroke",
  ])
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
  route: [
    { x: 5, y: 6 },
    { x: 9, y: 10 },
  ],
};
const host = {
  actors: [actor],
  debug: { routes: false, targets: false, terrain: false },
  scene: {
    debugOverlay: overlay,
    debugUnderlay: underlay,
    renderOptions: { pixelResolution: 1 },
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
assert.equal(
  underlay.calls.some((call) => call[0] === "rect"),
  false,
);

draw("routes");
assert.equal(
  overlay.calls.filter((call) => call[0] === "circle" && call[3] === 2.5)
    .length,
  2,
);
assert.equal(
  overlay.calls.some((call) => call[0] === "circle" && call[3] === 5),
  false,
);

draw("terrain");
assert.equal(underlay.calls.filter((call) => call[0] === "rect").length, 2);

/* A mark is sized in renderer pixels, so a quarter-resolution renderer takes
   four canvas pixels for each one and the mark survives the upscale at the
   size it was authored. */
host.scene.renderOptions.pixelResolution = 0.25;
draw("targets");
assert.ok(overlay.calls.some((call) => call[0] === "circle" && call[3] === 20));
assert.ok(
  overlay.calls.some((call) => call[0] === "stroke" && call[1].width === 8),
);
draw("routes");
assert.equal(
  overlay.calls.filter((call) => call[0] === "circle" && call[3] === 10).length,
  2,
);
draw("terrain");
assert.ok(
  underlay.calls.every((call) => call[0] !== "stroke" || call[1].width === 4),
);

/* A renderer finer than the canvas, which is a retina display at full scale,
   draws the mark at the size it is written rather than shrinking it to one of
   its own pixels. */
host.scene.renderOptions.pixelResolution = 2;
draw("targets");
assert.ok(overlay.calls.some((call) => call[0] === "circle" && call[3] === 5));
host.scene.renderOptions.pixelResolution = 1;

/* The cast changes only on a spawn or a recycle, but the draw hands it over
   every frame, and re-adding a child is Pixi reordering the world. An
   unchanged list must cost nothing; a changed one must still land, and a
   creature dropped from it must still be destroyed. */
const { BeefwifeCanvasScene } = require("../../beefwife-canvas/src/scene.mjs");
const added = [];
/* A scene without its Pixi application, because only the cast bookkeeping is
   under test and initialising one needs a document. */
const stage = Object.assign(Object.create(BeefwifeCanvasScene.prototype), {
  displayed: [],
  world: { addChildAt: (child, index) => added.push([child, index]) },
});
const sync = (displays) => stage.syncDisplays(displays);
const first = {
  destroyed: false,
  destroy() {
    this.destroyed = true;
  },
};
const second = {
  destroyed: false,
  destroy() {
    this.destroyed = true;
  },
};
sync([first, second]);
assert.equal(added.length, 2);
sync([first, second]);
assert.equal(added.length, 2, "an unchanged cast was re-added to the world");
sync([second, first]);
assert.equal(added.length, 4, "a reordered cast was not re-added");
sync([second]);
assert.ok(first.destroyed, "a creature dropped from the cast was left alive");
assert.equal(second.destroyed, false);

console.log("BeefwifeCanvas debug rendering: 16 layer and cast checks passed");
