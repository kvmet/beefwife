import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const Terrain = require("../../terrain/terrain.js");
const width = 1280;
const height = 720;
const obstacles = [];

// A multiplicative permutation spreads each prefix across the viewport, so the
// small-count cases are not confined to one row of the synthetic layout.
for (let index = 0; index < 96; index++) {
  const slot = (index * 37) % 96;
  const row = Math.floor(slot / 12);
  const column = slot % 12;
  const left = 26 + column * 103 + ((row * 7 + column * 3) % 13);
  const top = 24 + row * 84 + ((row * 5 + column * 11) % 15);
  const obstacleWidth = 28 + ((row * 13 + column * 7) % 39);
  const obstacleHeight = 22 + ((row * 11 + column * 5) % 35);
  obstacles.push({
    getBoundingClientRect: () => ({
      left,
      top,
      right: left + obstacleWidth,
      bottom: top + obstacleHeight,
    }),
  });
}

let random = 0x5eed1234;
const points = Array.from({ length: 8192 }, () => {
  random = (1664525 * random + 1013904223) >>> 0;
  const x = (random / 0x100000000) * width;
  random = (1664525 * random + 1013904223) >>> 0;
  const y = (random / 0x100000000) * height;
  return { x, y };
});

const profileAt = (terrain, milliseconds) => {
  const result = {};
  const started = performance.now();
  let count = 0;
  let elapsed = 0;
  let checksum = 0;
  do {
    for (let batch = 0; batch < 256; batch++) {
      const point = points[count & 8191];
      checksum += terrain.at(point.x, point.y, result)?.d || 0;
      count++;
    }
    elapsed = performance.now() - started;
  } while (elapsed < milliseconds);
  return { checksum, rate: (1000 * count) / elapsed };
};

const profileRoute = (terrain, milliseconds) => {
  const started = performance.now();
  let count = 0;
  let elapsed = 0;
  let checksum = 0;
  do {
    for (let batch = 0; batch < 16; batch++) {
      const route = terrain.route(
        points[count & 8191],
        points[(count * 17 + 31) & 8191],
      );
      checksum += route?.length || 0;
      count++;
    }
    elapsed = performance.now() - started;
  } while (elapsed < milliseconds);
  return { checksum, rate: (1000 * count) / elapsed };
};

const integer = (value) => Math.round(value).toLocaleString("en-US");
const rows = [];
let checksum = 0;
for (const obstacleCount of [0, 3, 6, 12, 24, 48, 96]) {
  const terrain = new Terrain({
    avoid: obstacles.slice(0, obstacleCount),
    viewport: { width, height },
    edgeMargin: 8,
    obstaclePadding: 3,
  });
  const builds = 20;
  const buildStarted = performance.now();
  for (let i = 0; i < builds; i++) terrain.build();
  const buildMs = (performance.now() - buildStarted) / builds;

  profileAt(terrain, 15);
  profileRoute(terrain, 15);
  const at = profileAt(terrain, 100);
  const route = profileRoute(terrain, 100);
  checksum += at.checksum + route.checksum;
  rows.push({
    obstacles: obstacleCount,
    cells: terrain.cells.length,
    gates: terrain.gates.length,
    build: buildMs.toFixed(3),
    at: integer(at.rate),
    route: integer(route.rate),
  });
}

const columns = [
  ["obstacles", 9],
  ["cells", 7],
  ["gates", 7],
  ["build ms", 10],
  ["at()/s", 14],
  ["route()/s", 12],
];
console.log(`Terrain scaling benchmark on ${process.version}`);
console.log(columns.map(([label, size]) => label.padStart(size)).join(""));
for (const row of rows) {
  console.log(
    [row.obstacles, row.cells, row.gates, row.build, row.at, row.route]
      .map((value, index) => String(value).padStart(columns[index][1]))
      .join(""),
  );
}
if (!Number.isFinite(checksum)) throw new Error("benchmark produced invalid output");
