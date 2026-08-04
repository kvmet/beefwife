/**
 * Question: do landing and routing stay outside every closed keep-out?
 * Control: exact segment-rectangle intersections over targeted cases and
 * deterministic random layouts, with both funnel settings.
 * Fails on a covered landing, an unsafe route, a lost endpoint, a higher-cost
 * corridor than quadratic Dijkstra, a clear-run detour, or a route across a
 * full-height wall.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WIDTH = 180;
const HEIGHT = 140;

const source =
  fs.readFileSync(
    path.join(__dirname, "..", "..", "terrain", "terrain.js"),
    "utf8",
  ) +
  "\nthis.Terrain = Terrain; this.TERRAIN_CONFIG = TERRAIN_CONFIG;";
const context = {
  window: { innerWidth: WIDTH, innerHeight: HEIGHT },
  document: { querySelectorAll: () => [] },
};
vm.createContext(context);
vm.runInContext(source, context);

const { Terrain, TERRAIN_CONFIG } = context;
TERRAIN_CONFIG.edgeMargin = 0;

const build = (rects) => {
  const terrain = new Terrain();
  Object.assign(terrain, {
    x0: 0,
    y0: 0,
    x1: WIDTH,
    y1: HEIGHT,
    rects,
  });
  terrain.edges = terrain._border();
  terrain._buildSlabs();
  return terrain;
};

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
  let enter = 0;
  let leave = 1;
  for (const [start, step, low, high] of [
    [a.x, b.x - a.x, rect.left, rect.right],
    [a.y, b.y - a.y, rect.top, rect.bottom],
  ]) {
    if (Math.abs(step) < 1e-12) {
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

const overlap = build([
  { left: 0, top: 0, right: 10, bottom: 100 },
  { left: 10.4, top: 40, right: 20, bottom: 60 },
]);
assert.equal(covered(overlap, land(overlap, { x: 10.45, y: 50 })), false);

const obstacle = build([{ left: 70, top: 50, right: 110, bottom: 90 }]);
TERRAIN_CONFIG.funnel = false;
assert.equal(obstacle.route({ x: 10, y: 20 }, { x: 160, y: 20 }).length, 2);

const wall = build([{ left: 80, top: -10, right: 100, bottom: 150 }]);
assert.equal(wall.route({ x: 10, y: 70 }, { x: 170, y: 70 }), null);

const narrow = build([
  { left: 20, top: 20, right: 80, bottom: 120 },
  { left: 80.2, top: 20, right: 160, bottom: 120 },
]);
for (const funnel of [false, true]) {
  TERRAIN_CONFIG.funnel = funnel;
  const route = narrow.route({ x: 79.8, y: 10 }, { x: 79.8, y: 130 });
  assert.equal(route === null || safe(narrow, route), true);
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
    assert.equal(covered(terrain, land(terrain, point)), false);
    landings++;
  }

  for (const funnel of [false, true]) {
    TERRAIN_CONFIG.funnel = funnel;
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
      assert.equal(safe(terrain, route), true);
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
  `${landings} landings, ${routes} routes, ${direct} direct, ` +
    `${searches} optimal searches: safe`,
);
