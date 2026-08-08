/**
 * Does Beefwife own one retained Pixi scene with the promised overlap order?
 * A minimal Pixi implementation is the control. Fails if feet cover limbs,
 * meshes rebuild instead of updating, invalid resources mutate the instance,
 * knee projection moves planted endpoints, pulls any knee toward view center,
 * leans end joints away from the leg section middle, scales the lean by the
 * section's length, leaves a gap where a limb bends, takes limb thickness
 * from the paint instead of limbWidth, drops the outline a stroked limb paint
 * asks for, or destruction leaves owned display objects alive.
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
    this.points = [];
    this.fills = [];
    this.strokes = [];
  }

  clear() {
    this.points = [];
    this.fills = [];
    this.strokes = [];
    return this;
  }
  moveTo(x, y) {
    this.points.push([x, y]);
    return this;
  }
  lineTo(x, y) {
    this.points.push([x, y]);
    return this;
  }
  arc() {
    return this;
  }
  closePath() {
    return this;
  }
  fill(value) {
    this.fills.push(value);
    return this;
  }
  stroke(value) {
    this.strokes.push(value);
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
const { limbLength } = require("../../beefwife/beefwife-legs.js");
const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
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
/* One limb is six vertices wound hip, knee, foot, foot, knee, hip, so a
   skeleton point is the midpoint of the pair that faces each other. */
const LIMB_FLOATS = 12;
const LIMB_PAIRS = { hip: [0, 10], knee: [2, 8], foot: [4, 6] };
const limbPoint = (positions, leg, part) => {
  const base = leg * LIMB_FLOATS;
  const [first, second] = LIMB_PAIRS[part];
  return {
    x: (positions[base + first] + positions[base + second]) / 2,
    y: (positions[base + first + 1] + positions[base + second + 1]) / 2,
  };
};
/* Mesh positions are float32, so a coordinate a few hundred px from the origin
   resolves to about 3e-5; anything tighter than this tests the storage. */
const near = (before, after) => Math.abs(before - after) < 1e-4;
const baselineHip = limbPoint(baselinePositions, 0, "hip");
const baselineKnee = limbPoint(baselinePositions, 0, "knee");
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
for (const part of ["hip", "foot"]) {
  const baselinePoint = limbPoint(baselinePositions, 0, part);
  const projectedPoint = limbPoint(projectedPositions, 0, part);
  assert.ok(near(baselinePoint.x, projectedPoint.x));
  assert.ok(near(baselinePoint.y, projectedPoint.y));
  checks += 2;
}
const projectedKnee = limbPoint(projectedPositions, 0, "knee");
const baselineFoot = limbPoint(baselinePositions, 0, "foot");
const elbowHeight = Math.hypot(
  baselineKnee.x - (baselineHip.x + baselineFoot.x) / 2,
  baselineKnee.y - (baselineHip.y + baselineFoot.y) / 2,
);
assert.ok(near(projectedKnee.x, baselineKnee.x + elbowHeight));
assert.ok(near(projectedKnee.y, baselineKnee.y));
/* The outline's knee corner stands half a width off both bones at once. That
   is what leaves no wedge between them where the leg bends, and it can only
   hold if the corner reaches past a plain perpendicular offset. */
const offsetFromBone = (point, from, to) => {
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  return Math.abs(
    ((point.x - from.x) * runY - (point.y - from.y) * runX) /
      Math.hypot(runX, runY),
  );
};
const halfWidth = bentLeggedSource.legs.skin.limbWidth / 2;
const kneeCorner = { x: baselinePositions[2], y: baselinePositions[3] };
assert.ok(
  near(offsetFromBone(kneeCorner, baselineHip, baselineKnee), halfWidth),
);
assert.ok(
  near(offsetFromBone(kneeCorner, baselineKnee, baselineFoot), halfWidth),
);
assert.ok(
  Math.hypot(kneeCorner.x - baselineKnee.x, kneeCorner.y - baselineKnee.y) >
    halfWidth,
);
checks += 5;
for (let leg = 0; leg * LIMB_FLOATS < baselinePositions.length; leg++) {
  const before = limbPoint(baselinePositions, leg, "knee");
  const after = limbPoint(projectedPositions, leg, "knee");
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
const centeredKnee = limbPoint(centeredPositions, 0, "knee");
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
const cappedKnee = limbPoint(cappedPositions, 0, "knee");
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
const legCount = baselinePositions.length / LIMB_FLOATS;
const firstLeftBefore = limbPoint(baselinePositions, 0, "knee");
const firstLeftAfter = limbPoint(leaningPositions, 0, "knee");
const firstRightBefore = limbPoint(baselinePositions, 1, "knee");
const firstRightAfter = limbPoint(leaningPositions, 1, "knee");
const lastLeftBefore = limbPoint(baselinePositions, legCount - 2, "knee");
const lastLeftAfter = limbPoint(leaningPositions, legCount - 2, "knee");
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
const leanShift =
  limbLength(bentLeggedSource.legs.reach, 1, bentLeggedSource.legs.fold) * 0.2;
assert.ok(near(firstLeftBefore.x - firstLeftAfter.x, leanShift));
assert.ok(near(lastLeftAfter.x - lastLeftBefore.x, leanShift));
checks += 7;
leaningLegs.destroy();

// The lean reaches one limb length at the ends of the leg section, so
// stretching that section must not change it.
const longTrunkSource = copy(bentLeggedSource);
longTrunkSource.chain.sections.trunk.spacing *= 3;
const longTrunkLegs = new Beefwife(longTrunkSource, { random: () => 0.5 });
const longTrunkPositions = longTrunkLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const longTrunkLeaningSource = copy(longTrunkSource);
longTrunkLeaningSource.legs.jointLean = 0.2;
const longTrunkLeaningLegs = new Beefwife(longTrunkLeaningSource, {
  random: () => 0.5,
});
const longTrunkLeaningPositions = longTrunkLeaningLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(
  near(
    limbPoint(longTrunkPositions, 0, "knee").x -
      limbPoint(longTrunkLeaningPositions, 0, "knee").x,
    leanShift,
  ),
);
checks++;
longTrunkLegs.destroy();
longTrunkLeaningLegs.destroy();

/* The lean crosses zero at its center, so moving the center to one end
   leaves that end alone and doubles the travel at the other. */
const offsetCenterSource = copy(bentLeggedSource);
offsetCenterSource.legs.jointLean = 0.2;
offsetCenterSource.legs.jointLeanCenter = -1;
const offsetCenterLegs = new Beefwife(offsetCenterSource, {
  random: () => 0.5,
});
const offsetCenterPositions = offsetCenterLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(
  near(limbPoint(offsetCenterPositions, 0, "knee").x, firstLeftBefore.x),
);
assert.ok(
  near(
    limbPoint(offsetCenterPositions, legCount - 2, "knee").x - lastLeftBefore.x,
    leanShift * 2,
  ),
);
checks += 2;
offsetCenterLegs.destroy();

/* Thickness comes from limbWidth and colour from the paint's fill, so nothing
   about the paint's stroke may reach the limb quads. */
const edgeWidth = (positions, leg, part) => {
  const base = leg * LIMB_FLOATS;
  const [first, second] = LIMB_PAIRS[part];
  return Math.hypot(
    positions[base + first] - positions[base + second],
    positions[base + first + 1] - positions[base + second + 1],
  );
};
assert.ok(
  near(
    edgeWidth(baselinePositions, 0, "hip"),
    bentLeggedSource.legs.skin.limbWidth,
  ),
);
const wideSource = copy(bentLeggedSource);
wideSource.legs.skin.limbWidth *= 2;
const wideLegs = new Beefwife(wideSource, { random: () => 0.5 });
const widePositions = wideLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(
  near(
    edgeWidth(widePositions, 0, "hip"),
    edgeWidth(baselinePositions, 0, "hip") * 2,
  ),
);
assert.equal(
  baselineLegs.children.find((child) => child instanceof Mesh).tint,
  bentLeggedSource.definitions.paints.leg.fill,
);
checks += 3;
wideLegs.destroy();

/* A tinted mesh carries no outline, so a limb paint that asks for both draws
   through Graphics instead, and both passes reach the same closed outline. */
const limbCount = bentLeggedSource.legs.pairs * 2;
const strokedSource = copy(bentLeggedSource);
strokedSource.definitions.paints.leg.stroke = "#ffffff";
strokedSource.definitions.paints.leg.strokeWidth = 2;
const strokedLegs = new Beefwife(strokedSource, { random: () => 0.5 });
const strokedLimbs = strokedLegs.children[limbCount];
assert.ok(strokedLimbs instanceof Graphics);
assert.equal(strokedLimbs.points.length, limbCount * 6);
assert.deepEqual(strokedLimbs.fills, [
  strokedSource.definitions.paints.leg.fill,
]);
assert.equal(strokedLimbs.strokes.length, 1);
assert.equal(strokedLimbs.strokes[0].color, "#ffffff");
assert.equal(strokedLimbs.strokes[0].width, 2);
const [strokedHipLeft, , , , , strokedHipRight] = strokedLimbs.points;
assert.ok(
  near(
    Math.hypot(
      strokedHipLeft[0] - strokedHipRight[0],
      strokedHipLeft[1] - strokedHipRight[1],
    ),
    strokedSource.legs.skin.limbWidth,
  ),
);
checks += 7;
strokedLegs.destroy();

/* No width is no limb, whichever way it draws; the feet stand on their own. */
const barefootSource = copy(strokedSource);
barefootSource.legs.skin.limbWidth = 0;
const barefootLegs = new Beefwife(barefootSource, { random: () => 0.5 });
assert.deepEqual(barefootLegs.children[limbCount].points, []);
const hiddenSource = copy(bentLeggedSource);
hiddenSource.legs.skin.limbWidth = 0;
const hiddenLegs = new Beefwife(hiddenSource, { random: () => 0.5 });
assert.ok(
  Array.from(
    hiddenLegs.children.find((child) => child instanceof Mesh).dynamicPositions,
  ).every((value) => value === 0),
);
checks += 2;
barefootLegs.destroy();
hiddenLegs.destroy();

/* Everything under legs.skin is drawn, never simulated, so editing it leaves
   the walked limbs exactly where they were; a leg rebuild would replant them. */
const plantedLegs = new Beefwife(bentLeggedSource, { random: () => 0.5 });
for (let frame = 0; frame < 30; frame++) plantedLegs.step(1 / 60);
plantedLegs.onRender();
const walkedLimbs = [
  ...plantedLegs.children.find((child) => child instanceof Mesh)
    .dynamicPositions,
];
const rescaledFoot = copy(bentLeggedSource);
rescaledFoot.legs.skin.foot.scale *= 2;
plantedLegs.setDescriptor(rescaledFoot);
plantedLegs.onRender();
assert.deepEqual(
  [
    ...plantedLegs.children.find((child) => child instanceof Mesh)
      .dynamicPositions,
  ],
  walkedLimbs,
);
checks++;
plantedLegs.destroy();

/* Bend places the joint off the hip-foot line: zero puts it on the line and
   a negative value mirrors it. */
const straightSource = copy(bentLeggedSource);
straightSource.legs.jointBend = 0;
const straightLegs = new Beefwife(straightSource, { random: () => 0.5 });
const straightPositions = straightLegs.children.find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const straightKnee = limbPoint(straightPositions, 0, "knee");
const straightHip = limbPoint(straightPositions, 0, "hip");
const straightFoot = limbPoint(straightPositions, 0, "foot");
assert.ok(near(straightKnee.x, (straightHip.x + straightFoot.x) / 2));
assert.ok(near(straightKnee.y, (straightHip.y + straightFoot.y) / 2));

const mirroredSource = copy(bentLeggedSource);
mirroredSource.legs.jointBend = -1;
const mirroredLegs = new Beefwife(mirroredSource, { random: () => 0.5 });
const mirroredKnee = limbPoint(
  mirroredLegs.children.find((child) => child instanceof Mesh).dynamicPositions,
  0,
  "knee",
);
assert.ok(near(mirroredKnee.x, 2 * straightKnee.x - baselineKnee.x));
assert.ok(near(mirroredKnee.y, 2 * straightKnee.y - baselineKnee.y));
checks += 4;
straightLegs.destroy();
mirroredLegs.destroy();
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
