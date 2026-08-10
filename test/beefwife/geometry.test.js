/**
 * Does a Beefwife's vertex math reach the scene intact? A minimal Pixi
 * implementation is the control. Fails if knee projection moves planted
 * endpoints, pulls any knee toward view center, leans end joints away from the
 * leg section middle, scales the lean by the section's length, leaves a gap
 * where a limb bends, takes limb thickness from the paint instead of
 * limbWidth, or a paint asking for both fill and stroke loses the outline or
 * draws it off the vertices the fill uses.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { Graphics, Mesh } = require("./pixi-mock.js");
const Beefwife = require("../../beefwife/beefwife.js");
const { limbLength } = require("../../beefwife/beefwife-legs.js");
const copy = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;

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

/* A limb paint that asks for both gets two children over one set of vertices:
   the mesh tints the triangles, the path traces the outline they came from. */
const limbCount = bentLeggedSource.legs.pairs * 2;
const strokedSource = copy(bentLeggedSource);
strokedSource.definitions.paints.leg.stroke = { colour: "#ffffff", width: 2 };
const strokedLegs = new Beefwife(strokedSource, { random: () => 0.5 });
const strokedFill = strokedLegs.children[limbCount];
const strokedOutline = strokedLegs.children[limbCount + 1];
assert.ok(strokedFill instanceof Mesh);
assert.equal(strokedFill.tint, strokedSource.definitions.paints.leg.fill);
assert.ok(strokedOutline instanceof Graphics);
assert.deepEqual(strokedOutline.fills, []);
assert.equal(strokedOutline.strokes.length, 1);
assert.equal(strokedOutline.strokes[0].color, "#ffffff");
assert.equal(strokedOutline.strokes[0].width, 2);
assert.equal(strokedOutline.points.length, limbCount * 6);
assert.deepEqual(
  strokedOutline.points.flat(),
  Array.from(strokedFill.dynamicPositions),
);
checks += 8;
strokedLegs.destroy();

/* No width is no limb, whichever way it draws; the feet stand on their own. */
const barefootSource = copy(strokedSource);
barefootSource.legs.skin.limbWidth = 0;
const barefootLegs = new Beefwife(barefootSource, { random: () => 0.5 });
assert.deepEqual(barefootLegs.children[limbCount + 1].points, []);
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

/* The ribbon splits the same way, and its stroke invents nothing: it walks the
   mesh's own edge and rim vertices, skipping each cap's hub and the two rim
   points that are already edge vertices. */
const CAP_SEGMENTS = 12;
const CAP_VERTICES = CAP_SEGMENTS + 2;
const ribbonStrokeSource = copy(bentLeggedSource);
ribbonStrokeSource.definitions.paints.ribbon.stroke = {
  colour: "#00ff00",
  width: 3,
};
const ribbonStroked = new Beefwife(ribbonStrokeSource, { random: () => 0.5 });
const ribbonMeshes = ribbonStroked.children.filter(
  (child) => child instanceof Mesh,
);
const ribbonFill = ribbonMeshes[ribbonMeshes.length - 1];
const ribbonOutline =
  ribbonStroked.children[ribbonStroked.children.indexOf(ribbonFill) + 1];
assert.ok(ribbonOutline instanceof Graphics);
assert.deepEqual(ribbonOutline.fills, []);
assert.equal(ribbonOutline.strokes[0].color, "#00ff00");
const ribbonChunks =
  (ribbonFill.dynamicPositions.length / 2 - CAP_VERTICES * 2) / 2;
assert.equal(
  ribbonOutline.points.length,
  ribbonChunks * 2 + (CAP_SEGMENTS - 1) * 2,
);
const meshVertices = new Set();
for (let at = 0; at < ribbonFill.dynamicPositions.length; at += 2)
  meshVertices.add(
    `${ribbonFill.dynamicPositions[at]},${ribbonFill.dynamicPositions[at + 1]}`,
  );
assert.ok(
  ribbonOutline.points.every(([x, y]) => meshVertices.has(`${x},${y}`)),
);
checks += 5;
ribbonStroked.destroy();

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

console.log(`beefwife geometry: ${checks} vertex checks passed`);
