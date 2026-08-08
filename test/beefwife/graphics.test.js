/**
 * Does Beefwife own one retained Pixi scene with the promised overlap order?
 * A minimal Pixi implementation is the control. Fails if feet cover limbs,
 * meshes rebuild instead of updating, invalid resources mutate the instance,
 * knee projection moves planted endpoints, pulls any knee toward view center,
 * leans end joints away from the leg section middle, scales the lean by limb
 * length, splits the joint, or destruction leaves owned display objects alive.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

class Container {
  constructor() {
    this.children = [];
    this.parent = null;
    this.destroyed = false;
  }

  addChild(...children) {
    for (const child of children) this.addChildAt(child, this.children.length);
    return children.at(-1);
  }

  addChildAt(child, index) {
    if (child.parent) child.parent.removeChild(child);
    this.children.splice(index, 0, child);
    child.parent = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parent = null;
    return child;
  }

  destroy() {
    if (this.parent) this.parent.removeChild(this);
    this.destroyed = true;
  }
}

class Graphics extends Container {
  constructor() {
    super();
    this.position = { set: (x, y) => ([this.x, this.y] = [x, y]) };
    this.scale = { set: (x, y) => ([this.scaleX, this.scaleY] = [x, y]) };
  }

  clear() {
    return this;
  }
  moveTo() {
    return this;
  }
  lineTo() {
    return this;
  }
  arc() {
    return this;
  }
  closePath() {
    return this;
  }
  fill() {
    return this;
  }
  stroke() {
    return this;
  }
}

class GraphicsPath {
  constructor(value) {
    if (value === "BAD") throw new Error("bad SVG path");
  }

  transform() {
    return this;
  }
}

class GraphicsContext {
  path() {
    return this;
  }
  fill() {
    return this;
  }
  stroke() {
    return this;
  }
}

class MeshGeometry {
  constructor(options) {
    this.positions = options.positions;
    this.buffer = { updates: 0, update: () => this.buffer.updates++ };
  }

  getBuffer() {
    return this.buffer;
  }
}

class Mesh extends Container {
  constructor(options) {
    super();
    this.geometry = options.geometry;
  }
}

class Color {
  constructor(value) {
    if (value === "BAD") throw new Error("bad CSS color");
  }
}

global.PIXI = {
  Color,
  Container,
  Graphics,
  GraphicsContext,
  GraphicsPath,
  Matrix: class Matrix {},
  Mesh,
  MeshGeometry,
  Texture: { WHITE: {} },
};

const Beefwife = require("../../beefwife/beefwife.js");
const BeefwifeGraphics = require("../../beefwife/beefwife-graphics.js");
const source = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"), "utf8"),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;

const beefwife = new Beefwife(source, { random: () => 0.5 });
assert.ok(beefwife instanceof Container);
assert.equal(beefwife.label, source.name);
assert.equal(typeof beefwife.onRender, "function");
checks += 3;

const footCount = source.legs.pairs * 2;
const meshIndexes = beefwife.children
  .map((child, index) => (child instanceof Mesh ? index : -1))
  .filter((index) => index >= 0);
assert.equal(meshIndexes[0], footCount);
assert.equal(meshIndexes.length, 2);
assert.ok(meshIndexes[1] > meshIndexes[0]);
checks += 3;

const meshes = beefwife.children.filter((child) => child instanceof Mesh);
const buffers = meshes.map((mesh) => mesh.geometry.buffer);
const children = [...beefwife.children];
beefwife.step(1 / 60);
beefwife.onRender();
assert.deepEqual(beefwife.children, children);
assert.ok(buffers.every((buffer) => buffer.updates >= 2));
checks += 2;

const leggedSource = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "long-girl.json"),
    "utf8",
  ),
);
const bentLeggedSource = copy(leggedSource);
bentLeggedSource.legs.fold = 0.75;
bentLeggedSource.legs.jointLean = 0;
const baselineLegs = new Beefwife(bentLeggedSource, { random: () => 0.5 });
const baselinePositions = baselineLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const segmentPoint = (positions, offset) => ({
  x: (positions[offset] + positions[offset + 2]) / 2,
  y: (positions[offset + 1] + positions[offset + 3]) / 2,
});
const near = (before, after) => Math.abs(before - after) < 1e-5;
const baselineHip = segmentPoint(baselinePositions, 0);
const baselineKnee = segmentPoint(baselinePositions, 4);
const projectionCenterX = baselineKnee.x - 10;
const projectionCenterY = baselineKnee.y;
const localProjection = {
  centerX: projectionCenterX,
  centerY: projectionCenterY,
  maxOffset: 100,
  perspective: 0.1,
};
const projectedLegs = new Beefwife(bentLeggedSource, {
  random: () => 0.5,
  render: { kneeProjection: localProjection },
});
const projectedPositions = projectedLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
for (const offset of [0, 12]) {
  const baselinePoint = segmentPoint(baselinePositions, offset);
  const projectedPoint = segmentPoint(projectedPositions, offset);
  assert.ok(near(baselinePoint.x, projectedPoint.x));
  assert.ok(near(baselinePoint.y, projectedPoint.y));
  checks += 2;
}
const projectedKnee = segmentPoint(projectedPositions, 4);
const baselineFoot = segmentPoint(baselinePositions, 12);
const elbowHeight = Math.hypot(
  baselineKnee.x - (baselineHip.x + baselineFoot.x) / 2,
  baselineKnee.y - (baselineHip.y + baselineFoot.y) / 2,
);
assert.ok(near(projectedKnee.x, baselineKnee.x + elbowHeight));
assert.ok(near(projectedKnee.y, baselineKnee.y));
const lowerKnee = segmentPoint(projectedPositions, 8);
assert.ok(near(projectedKnee.x, lowerKnee.x));
assert.ok(near(projectedKnee.y, lowerKnee.y));
checks += 4;
for (let legOffset = 0; legOffset < baselinePositions.length; legOffset += 16) {
  const before = segmentPoint(baselinePositions, legOffset + 4);
  const after = segmentPoint(projectedPositions, legOffset + 4);
  const radialX = before.x - projectionCenterX;
  const radialY = before.y - projectionCenterY;
  const displacementX = after.x - before.x;
  const displacementY = after.y - before.y;
  assert.ok(displacementX * radialX + displacementY * radialY >= 0);
  checks++;
}
projectedLegs.destroy();

const roundedLegs = new Beefwife(bentLeggedSource, {
  random: () => 0.5,
  render: { roundVertices: true },
});
const roundedMeshes = roundedLegs.children.filter(
  (child) => child instanceof Mesh,
);
assert.ok(
  roundedMeshes.every((mesh) =>
    Array.from(mesh.dynamicPositions).every(Number.isInteger),
  ),
);
checks++;
roundedLegs.destroy();

const reducedRender = { roundVertices: true, pixelResolution: 0.25 };
const reducedLegs = new Beefwife(bentLeggedSource, {
  random: () => 0.5,
  render: reducedRender,
});
const reducedPositions = reducedLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.deepEqual(
  Array.from(reducedPositions),
  Array.from(baselinePositions, (value) => Math.round(value * 0.25) * 4),
);
reducedRender.pixelResolution = 0.5;
reducedLegs.onRender();
assert.deepEqual(
  Array.from(reducedPositions),
  Array.from(baselinePositions, (value) => Math.round(value * 0.5) * 2),
);
checks += 2;
reducedLegs.destroy();

const centeredLegs = new Beefwife(bentLeggedSource, {
  random: () => 0.5,
  render: {
    kneeProjection: {
      centerX: baselineKnee.x,
      centerY: baselineKnee.y,
      maxOffset: 12,
      perspective: 1,
    },
  },
});
const centeredPositions = centeredLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const centeredKnee = segmentPoint(centeredPositions, 4);
assert.ok(near(centeredKnee.x, baselineKnee.x));
assert.ok(near(centeredKnee.y, baselineKnee.y));
checks += 2;
centeredLegs.destroy();

const cappedLegs = new Beefwife(bentLeggedSource, {
  random: () => 0.5,
  render: {
    kneeProjection: {
      centerX: baselineKnee.x - 1,
      centerY: baselineKnee.y,
      maxOffset: 12,
      perspective: 100,
    },
  },
});
const cappedPositions = cappedLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const cappedKnee = segmentPoint(cappedPositions, 4);
assert.ok(
  near(
    Math.hypot(cappedKnee.x - baselineKnee.x, cappedKnee.y - baselineKnee.y),
    12,
  ),
);
checks++;
cappedLegs.destroy();

const leaningSource = copy(bentLeggedSource);
leaningSource.legs.jointLean = 0.2;
const leaningLegs = new Beefwife(leaningSource, { random: () => 0.5 });
const leaningPositions = leaningLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const legCount = baselinePositions.length / 16;
const firstLeftBefore = segmentPoint(baselinePositions, 4);
const firstLeftAfter = segmentPoint(leaningPositions, 4);
const firstRightBefore = segmentPoint(baselinePositions, 20);
const firstRightAfter = segmentPoint(leaningPositions, 20);
const lastLeftOffset = (legCount - 2) * 16 + 4;
const lastLeftBefore = segmentPoint(baselinePositions, lastLeftOffset);
const lastLeftAfter = segmentPoint(leaningPositions, lastLeftOffset);
assert.ok(firstLeftAfter.x < firstLeftBefore.x);
assert.ok(lastLeftAfter.x > lastLeftBefore.x);
assert.ok(
  near(
    firstLeftAfter.x - firstLeftBefore.x,
    firstRightAfter.x - firstRightBefore.x,
  ),
);
assert.ok(near(firstLeftAfter.y, firstLeftBefore.y));
assert.ok(near(lastLeftAfter.y, lastLeftBefore.y));
const trunk = leggedSource.chain.sections.trunk;
const leanShift = ((trunk.chunks - 1) * trunk.spacing * 0.2) / 2;
assert.ok(near(firstLeftBefore.x - firstLeftAfter.x, leanShift));
assert.ok(near(lastLeftAfter.x - lastLeftBefore.x, leanShift));
checks += 7;
leaningLegs.destroy();

// Lean spans the leg section, so limb length must not scale it.
const straighterSource = copy(bentLeggedSource);
straighterSource.legs.fold = 0.15;
const straighterLegs = new Beefwife(straighterSource, { random: () => 0.5 });
const straighterPositions = straighterLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const straighterLeaningSource = copy(straighterSource);
straighterLeaningSource.legs.jointLean = 0.2;
const straighterLeaningLegs = new Beefwife(straighterLeaningSource, {
  random: () => 0.5,
});
const straighterLeaningPositions = straighterLeaningLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(
  near(
    segmentPoint(straighterPositions, 4).x -
      segmentPoint(straighterLeaningPositions, 4).x,
    leanShift,
  ),
);
checks++;
straighterLegs.destroy();
straighterLeaningLegs.destroy();
baselineLegs.destroy();

const invalidPaint = copy(source);
invalidPaint.definitions.paints.shell.fill = "BAD";
assert.throws(() => beefwife.setDescriptor(invalidPaint), /shell\.fill/);
assert.equal(
  beefwife.descriptor.definitions.paints.shell.fill,
  source.definitions.paints.shell.fill,
);
checks += 2;

const recolored = copy(source);
recolored.definitions.paints.shell.fill = "#123456";
beefwife.setDescriptor(recolored);
assert.equal(beefwife.descriptor.definitions.paints.shell.fill, "#123456");
assert.ok(children.every((child) => child.destroyed));
assert.ok(beefwife.children.every((child) => !child.destroyed));
checks += 3;

const owned = [...beefwife.children];
beefwife.destroy();
assert.equal(beefwife.destroyed, true);
assert.ok(owned.every((child) => child.destroyed));
checks += 2;

console.log(`beefwife graphics: ${checks} retained-scene checks passed`);
