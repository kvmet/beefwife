/**
 * Questions: is the public lifecycle strict and predictable, and do landing
 * and routing stay outside every closed keep-out? Controls: boundary-contract
 * assertions plus exact segment-rectangle intersections over targeted cases
 * and deterministic random layouts with both funnel settings. Fails on invalid
 * input acceptance, stale builds, covered landings, unsafe routes, lost
 * endpoints, non-optimal gate searches, lost subpixel gaps, clear-run
 * detours, or routes through full-height walls.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WIDTH = 180;
const HEIGHT = 140;
const artifact = process.argv[2] || "terrain.js";

const terrainPath = path.join(
  __dirname,
  "..",
  "..",
  "terrain",
  artifact,
);
const source = fs.readFileSync(terrainPath, "utf8");
const Terrain = require(terrainPath);
const context = {
  innerWidth: WIDTH,
  innerHeight: HEIGHT,
  document: { querySelectorAll: () => [] },
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);
assert.equal(context.Terrain.name, "Terrain");
assert.equal(context.window.Terrain, context.Terrain);
vm.runInContext(source, context);
assert.equal(context.Terrain.name, "Terrain");
vm.runInContext(
  "this.browserTerrain = new Terrain({ edgeMargin: 0 }).build()",
  context,
);
assert.equal(context.browserTerrain.ready, true);
const collision = { window: null, document: context.document };
collision.window = collision;
vm.createContext(collision);
vm.runInContext("const finite = 1; const point = 2;", collision);
vm.runInContext(source, collision);
assert.equal(collision.Terrain.name, "Terrain");

const minPath = path.join(path.dirname(terrainPath), "terrain.min.js");
const minSource = fs.readFileSync(minPath, "utf8");
const MinTerrain = require(minPath);
assert.deepEqual(MinTerrain.DEFAULTS, Terrain.DEFAULTS);
const minContext = { window: null, document: context.document };
minContext.window = minContext;
vm.createContext(minContext);
vm.runInContext(minSource, minContext);
assert.equal(minContext.Terrain.name, "Terrain");

const element = (rect, count = null) => ({
  getBoundingClientRect() {
    if (count) count.calls++;
    return rect;
  },
});

const build = (rects, options = {}) =>
  new Terrain({
    avoid: rects.map((rect) => element(rect)),
    edgeMargin: 0,
    viewport: { width: WIDTH, height: HEIGHT },
    ...options,
  }).build();

const covered = (terrain, point) =>
  point.x < -1e-9 ||
  point.x > WIDTH + 1e-9 ||
  point.y < -1e-9 ||
  point.y > HEIGHT + 1e-9 ||
  terrain.rects.some(
    (rect) =>
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom,
  );

const hits = (a, b, rect) => {
  if (
    Math.max(a.x, b.x) < rect.left ||
    Math.min(a.x, b.x) > rect.right ||
    Math.max(a.y, b.y) < rect.top ||
    Math.min(a.y, b.y) > rect.bottom
  )
    return false;
  let enter = 0;
  let leave = 1;
  for (const [start, step, low, high] of [
    [a.x, b.x - a.x, rect.left, rect.right],
    [a.y, b.y - a.y, rect.top, rect.bottom],
  ]) {
    if (step === 0) {
      if (start < low || start > high) return false;
      continue;
    }
    const atLow = (low - start) / step;
    const atHigh = (high - start) / step;
    enter = Math.max(enter, Math.min(atLow, atHigh));
    leave = Math.min(leave, Math.max(atLow, atHigh));
    if (enter > leave) return false;
  }
  return true;
};

const safe = (terrain, route) => {
  if (route.some((point) => covered(terrain, point))) return false;
  for (let i = 1; i < route.length; i++) {
    if (terrain.rects.some((rect) => hits(route[i - 1], route[i], rect))) {
      return false;
    }
  }
  return true;
};

const land = (terrain, point) => {
  const offset = terrain.at(point.x, point.y);
  return {
    x: point.x + offset.dx * offset.d,
    y: point.y + offset.dy * offset.d,
  };
};

const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-7;
const clear = (terrain, a, b) =>
  !terrain.rects.some((rect) => hits(a, b, rect));

const controlCost = (terrain, from, start, to, goal) => {
  const size = 2 * terrain.gates.length;
  const cost = new Float64Array(size).fill(Infinity);
  const done = new Uint8Array(size);
  for (const gate of from.gates) {
    cost[2 * gate.id + (gate.a === from ? 1 : 0)] = Math.hypot(
      gate.mid.x - start.x,
      gate.mid.y - start.y,
    );
  }

  while (true) {
    let node = -1;
    let low = Infinity;
    for (let i = 0; i < size; i++) {
      if (!done[i] && cost[i] < low) {
        node = i;
        low = cost[i];
      }
    }
    if (node < 0) break;
    done[node] = 1;

    const gate = terrain.gates[node >> 1];
    const cell = node & 1 ? gate.b : gate.a;
    for (const next of cell.gates) {
      if (next === gate) continue;
      const nextNode = 2 * next.id + (next.a === cell ? 1 : 0);
      const nextCost =
        low + Math.hypot(next.mid.x - gate.mid.x, next.mid.y - gate.mid.y);
      if (nextCost < cost[nextNode]) cost[nextNode] = nextCost;
    }
  }

  let best = Infinity;
  for (const gate of to.gates) {
    const node = 2 * gate.id + (gate.b === to ? 1 : 0);
    best = Math.min(
      best,
      cost[node] + Math.hypot(gate.mid.x - goal.x, gate.mid.y - goal.y),
    );
  }
  return best;
};

const routeCost = (crossings, start, goal) => {
  if (!crossings) return Infinity;
  let point = start;
  let cost = 0;
  for (const { gate } of crossings) {
    cost += Math.hypot(gate.mid.x - point.x, gate.mid.y - point.y);
    point = gate.mid;
  }
  return cost + Math.hypot(goal.x - point.x, goal.y - point.y);
};

// Public construction, lifecycle, measurement, and failure contracts.
assert.equal(Object.isFrozen(Terrain.DEFAULTS), true);
assert.deepEqual(Terrain.DEFAULTS, {
  avoid: ".beefwife-avoid",
  edgeMargin: 25,
  obstaclePadding: 0,
  funnel: true,
});
for (const options of [
  null,
  [],
  { mystery: true },
  { edgeMargin: -1 },
  { obstaclePadding: NaN },
  { funnel: 1 },
  { avoid: {} },
  { root: {} },
  { viewport: null },
]) {
  assert.throws(() => new Terrain(options));
}

const dormant = new Terrain({
  avoid: [],
  viewport: { width: WIDTH, height: HEIGHT },
});
assert.equal(dormant.ready, false);
assert.equal(dormant.at(1, 1), null);
assert.equal(dormant.route({ x: 1, y: 1 }, { x: 2, y: 2 }), null);
assert.throws(() => dormant.at(Infinity, 1), TypeError);
assert.throws(() => dormant.at(1, 1, null), TypeError);
assert.throws(() => dormant.route({ x: 1 }, { x: 2, y: 2 }), TypeError);

const supplied = {
  avoid: [],
  edgeMargin: 4,
  viewport: { width: WIDTH, height: HEIGHT },
};
const snapshot = new Terrain(supplied);
supplied.edgeMargin = 40;
assert.equal(Object.isFrozen(snapshot.options), true);
assert.equal(snapshot.build(), snapshot);
assert.equal(snapshot.x0, 4);
const reused = {};
assert.equal(snapshot.at(20, 20, reused), reused);
assert.deepEqual(reused, { dx: 0, dy: 0, d: 0 });

const measured = { calls: 0 };
const keepOut = element(
  { left: 110, top: 220, right: 130, bottom: 240 },
  measured,
);
let selected = null;
const offset = new Terrain({
  avoid: ".blocked",
  root: {
    querySelectorAll(selector) {
      selected = selector;
      return [keepOut, keepOut];
    },
  },
  edgeMargin: 0,
  obstaclePadding: 2,
  viewport: () => ({ left: 100, top: 200, width: 80, height: 60 }),
}).build();
assert.equal(selected, ".blocked");
assert.equal(measured.calls, 1);
assert.deepEqual(offset.viewport, {
  left: 100,
  top: 200,
  width: 80,
  height: 60,
});
assert.deepEqual(offset.rects, [
  { left: 8, top: 18, right: 32, bottom: 42 },
]);
assert.equal(covered(offset, land(offset, { x: 20, y: 30 })), false);
assert.equal(offset.avoidElements().length, 2);
offset.build();
assert.equal(measured.calls, 2);

const noSpace = new Terrain({
  avoid: [element({ left: -1, top: -1, right: 11, bottom: 11 })],
  edgeMargin: 0,
  viewport: { width: 10, height: 10 },
}).build();
assert.equal(noSpace.ready, false);
assert.equal(noSpace.at(5, 5), null);
assert.equal(noSpace.route({ x: 1, y: 1 }, { x: 9, y: 9 }), null);

for (const viewport of [
  { width: 0, height: 10 },
  { width: 10, height: 0 },
  { width: 20, height: 10, edgeMargin: 5 },
]) {
  const { edgeMargin = 0, ...bounds } = viewport;
  const collapsed = new Terrain({
    avoid: [],
    edgeMargin,
    viewport: bounds,
  }).build();
  assert.equal(collapsed.ready, false);
  assert.equal(collapsed.at(0, 0), null);
}

const badRect = { left: 1, top: 1, right: 2, bottom: 2 };
const transactional = new Terrain({
  avoid: [element(badRect)],
  edgeMargin: 0,
  viewport: { width: 10, height: 10 },
}).build();
assert.equal(transactional.ready, true);
badRect.right = NaN;
assert.throws(() => transactional.build(), TypeError);
assert.equal(transactional.ready, false);
assert.deepEqual(transactional.rects, []);

assert.throws(
  () =>
    new Terrain({
      avoid: () => ".blocked",
      viewport: { width: 10, height: 10 },
    }).build(),
  /must return an iterable/,
);
assert.throws(
  () =>
    new Terrain({ avoid: [], viewport: () => null }).build(),
  /must be a rectangle/,
);
assert.throws(
  () => build([{ left: 2, top: 1, right: 1, bottom: 2 }]),
  /rectangle is inverted/,
);

const overlap = build([
  { left: 0, top: 0, right: 10, bottom: 100 },
  { left: 10.4, top: 40, right: 20, bottom: 60 },
]);
assert.equal(covered(overlap, land(overlap, { x: 10.45, y: 50 })), false);

const obstacle = build([{ left: 70, top: 50, right: 110, bottom: 90 }], {
  funnel: false,
});
assert.equal(obstacle.route({ x: 10, y: 20 }, { x: 160, y: 20 }).length, 2);
const boundary = obstacle.at(70, 70);
assert.equal(boundary.d > 0 && boundary.d < 1e-9, true);
assert.equal(covered(obstacle, land(obstacle, { x: 70, y: 70 })), false);
assert.equal(
  obstacle.route({ x: 10, y: 49.75 }, { x: 160, y: 49.75 }).length,
  2,
);

const wall = build([{ left: 80, top: -10, right: 100, bottom: 150 }]);
assert.equal(wall.route({ x: 10, y: 70 }, { x: 170, y: 70 }), null);

const verticalLine = build([
  { left: 90, top: -10, right: 90, bottom: 150 },
]);
assert.equal(verticalLine.route({ x: 10, y: 70 }, { x: 170, y: 70 }), null);
const horizontalLine = build([
  { left: -10, top: 70, right: 190, bottom: 70 },
]);
assert.equal(horizontalLine.route({ x: 90, y: 10 }, { x: 90, y: 130 }), null);
const pointObstacle = build([
  { left: 90, top: 70, right: 90, bottom: 70 },
]);
const aroundPoint = pointObstacle.route(
  { x: 10, y: 70 },
  { x: 170, y: 70 },
);
assert.equal(safe(pointObstacle, aroundPoint), true);
assert.equal(aroundPoint.length > 2, true);

const touching = build([{ left: -10, top: 40, right: 0, bottom: 100 }]);
const touchedEdge = land(touching, { x: 0, y: 70 });
assert.equal(touchedEdge.x > 0, true);
assert.equal(covered(touching, touchedEdge), false);

const floatBuffer = new ArrayBuffer(8);
const floatView = new DataView(floatBuffer);
const nextUp = (value) => {
  floatView.setFloat64(0, value);
  floatView.setBigUint64(0, floatView.getBigUint64(0) + 1n);
  return floatView.getFloat64(0);
};
const narrowRight = nextUp(nextUp(nextUp(nextUp(nextUp(80)))));
const narrowRects = [
  { left: 20, top: 20, right: 80, bottom: 120 },
  { left: narrowRight, top: 20, right: 160, bottom: 120 },
];
for (const funnel of [false, true]) {
  const narrow = build(narrowRects, { funnel });
  const route = narrow.route({ x: 79.8, y: 10 }, { x: 79.8, y: 130 });
  assert.equal(safe(narrow, route), true);
  assert.equal(
    route.some((point) => point.x > 80 && point.x < narrowRight),
    true,
  );
}

let seed = 0x7319ab2d;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

let landings = 0;
let routes = 0;
let direct = 0;
let searches = 0;
for (let world = 0; world < 250; world++) {
  const rects = [];
  for (let i = 0; i < 9; i++) {
    const left = -10 + random() * 170;
    const top = -10 + random() * 130;
    rects.push({
      left,
      top,
      right: left + 8 + random() * 55,
      bottom: top + 8 + random() * 45,
    });
  }
  const terrain = build(rects);

  for (let i = 0; i < 150; i++) {
    const point = { x: -20 + random() * 220, y: -20 + random() * 180 };
    if (!covered(terrain, point)) continue;
    const landed = land(terrain, point);
    assert.equal(covered(terrain, landed), false,
      JSON.stringify({ point, landed, rects }));
    landings++;
  }

  for (const funnel of [false, true]) {
    const terrain = build(rects, { funnel });
    for (let i = 0; i < 30; i++) {
      const a = { x: random() * WIDTH, y: random() * HEIGHT };
      const b = { x: random() * WIDTH, y: random() * HEIGHT };
      const start = land(terrain, a);
      const goal = land(terrain, b);
      if (world < 50 && !clear(terrain, start, goal)) {
        const from = terrain._seat(start);
        const to = terrain._seat(goal);
        if (from && to && from.cell !== to.cell) {
          const crossings = terrain._cross(
            from.cell,
            from.point,
            to.cell,
            to.point,
          );
          const expected = controlCost(
            terrain,
            from.cell,
            from.point,
            to.cell,
            to.point,
          );
          const actual = routeCost(crossings, from.point, to.point);
          assert.equal(Number.isFinite(actual), Number.isFinite(expected));
          if (Number.isFinite(expected)) {
            assert.equal(Math.abs(actual - expected) < 1e-7, true);
          }
          searches++;
        }
      }

      const route = terrain.route(a, b);
      if (!route) continue;
      assert.equal(safe(terrain, route), true, JSON.stringify({ a, b, route, rects }));
      assert.equal(same(route[0], start), true);
      assert.equal(same(route[route.length - 1], goal), true);
      if (clear(terrain, start, goal)) {
        assert.equal(route.length, 2);
        direct++;
      }
      routes++;
    }
  }
}

console.log(
  `${artifact}: ${landings} landings, ${routes} routes, ${direct} direct, ` +
    `${searches} optimal searches: safe`,
);
