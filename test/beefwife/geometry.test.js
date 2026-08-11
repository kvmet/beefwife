/**
 * Does a Beefwife's vertex math reach the scene intact? A minimal Pixi
 * implementation is the control. Fails if knee projection moves planted
 * endpoints, pulls any knee toward view center, leans end joints away from the
 * leg section middle, scales the lean by the section's length, leaves a gap or
 * a spike where a limb bends, takes limb thickness from the paint instead of
 * limbWidth, or a paint asking for both fill and stroke loses the outline or
 * draws it off the vertices the fill uses.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PIXI,
  fillsOf,
  pointsOf,
  strokesOf,
  colourNumber,
} = require("./pixi.js");
const { Graphics, Mesh } = PIXI;
const { Beefwife } = require("../../beefwife/src/beefwife.mjs");
const { limbLength } = require("../../beefwife/src/legs.mjs");
const Geometry = require("../../beefwife/src/geometry.mjs");
const copy = (value) => JSON.parse(JSON.stringify(value));
// The creature's own parts, which are one container down from the Beefwife.
const partsOf = (beefwife) => beefwife.children[0].children;
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
const baselinePositions = partsOf(baselineLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
/* One limb is fourteen vertices wound hip, five knee points, foot down one
   side and foot, five knee points, hip back up the other, so a hip or a foot
   is the midpoint of the pair that faces each other. The outside of the bend
   sweeps its five points around the joint; the inside stacks all five on the
   one corner where its edges cross. */
const KNEE_POINTS = 5;
const LIMB_VERTICES = (KNEE_POINTS + 2) * 2;
const LIMB_FLOATS = LIMB_VERTICES * 2;
const LIMB_PAIRS = {
  hip: [0, LIMB_FLOATS - 2],
  foot: [(KNEE_POINTS + 1) * 2, (KNEE_POINTS + 2) * 2],
};
const limbPoint = (positions, leg, part) => {
  const base = leg * LIMB_FLOATS;
  const [first, second] = LIMB_PAIRS[part];
  return {
    x: (positions[base + first] + positions[base + second]) / 2,
    y: (positions[base + first + 1] + positions[base + second + 1]) / 2,
  };
};
const limbVertex = (positions, leg, vertex) => ({
  x: positions[leg * LIMB_FLOATS + vertex * 2],
  y: positions[leg * LIMB_FLOATS + vertex * 2 + 1],
});
/* The swept side leaves the hip and reaches the joint on the same offset, so
   the step from one to the other is the thigh itself. A straight limb sweeps
   nothing and either side answers. */
const limbKnee = (positions, leg) => {
  const first = limbVertex(positions, leg, 1);
  const last = limbVertex(positions, leg, KNEE_POINTS);
  const swept = first.x !== last.x || first.y !== last.y;
  const hipVertex = swept ? 0 : LIMB_VERTICES - 1;
  const kneeVertex = swept ? 1 : LIMB_VERTICES - 2;
  const hip = limbPoint(positions, leg, "hip");
  const offset = limbVertex(positions, leg, hipVertex);
  const knee = limbVertex(positions, leg, kneeVertex);
  return { x: hip.x + knee.x - offset.x, y: hip.y + knee.y - offset.y };
};
/* Mesh positions are float32, so a coordinate a few hundred px from the origin
   resolves to about 3e-5; anything tighter than this tests the storage. */
const near = (before, after) => Math.abs(before - after) < 1e-4;
const baselineHip = limbPoint(baselinePositions, 0, "hip");
const baselineKnee = limbKnee(baselinePositions, 0);
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
const projectedPositions = partsOf(projectedLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
for (const part of ["hip", "foot"]) {
  const baselinePoint = limbPoint(baselinePositions, 0, part);
  const projectedPoint = limbPoint(projectedPositions, 0, part);
  assert.ok(near(baselinePoint.x, projectedPoint.x));
  assert.ok(near(baselinePoint.y, projectedPoint.y));
  checks += 2;
}
const projectedKnee = limbKnee(projectedPositions, 0);
const baselineFoot = limbPoint(baselinePositions, 0, "foot");
const elbowHeight = Math.hypot(
  baselineKnee.x - (baselineHip.x + baselineFoot.x) / 2,
  baselineKnee.y - (baselineHip.y + baselineFoot.y) / 2,
);
assert.ok(near(projectedKnee.x, baselineKnee.x + elbowHeight));
assert.ok(near(projectedKnee.y, baselineKnee.y));
const offsetFromBone = (point, from, to) => {
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  return Math.abs(
    ((point.x - from.x) * runY - (point.y - from.y) * runX) /
      Math.hypot(runX, runY),
  );
};
const halfWidth = bentLeggedSource.legs.skin.limbWidth / 2;
/* A bend puts one side of the knee outside it and one side in, whichever way
   this leg happens to fold. */
const kneeSide = (positions, leg, hipFirst) =>
  Array.from({ length: KNEE_POINTS }, (_, point) =>
    limbVertex(
      positions,
      leg,
      hipFirst ? 1 + point : LIMB_VERTICES - 2 - point,
    ),
  );
const stacked = (side) =>
  side.every((point) => point.x === side[0].x && point.y === side[0].y);
const firstSide = kneeSide(baselinePositions, 0, true);
const secondSide = kneeSide(baselinePositions, 0, false);
assert.ok(stacked(firstSide) !== stacked(secondSide));
const sweptKnee = stacked(firstSide) ? secondSide : firstSide;
const kneeCorner = stacked(firstSide) ? firstSide[0] : secondSide[0];
/* Outside the bend every knee point stands half a width from the joint and
   nothing stands further, which is what leaves no wedge between the bones and
   no spike on a limb the walk has folded. Both ends of the sweep are a bone's
   own offset, so it meets each one square. */
assert.ok(
  sweptKnee.every((point) =>
    near(
      Math.hypot(point.x - baselineKnee.x, point.y - baselineKnee.y),
      halfWidth,
    ),
  ),
);
assert.ok(
  near(offsetFromBone(sweptKnee[0], baselineHip, baselineKnee), halfWidth),
);
assert.ok(
  near(
    offsetFromBone(sweptKnee[KNEE_POINTS - 1], baselineKnee, baselineFoot),
    halfWidth,
  ),
);
/* Inside the bend the one corner the five points share is where the offset
   edges cross, which stands off both bones at once and so reaches past a
   plain perpendicular offset. */
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
checks += 9;
for (let leg = 0; leg * LIMB_FLOATS < baselinePositions.length; leg++) {
  const before = limbKnee(baselinePositions, leg);
  const after = limbKnee(projectedPositions, leg);
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
const roundedMeshes = partsOf(roundedLegs).filter(
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
const reducedPositions = partsOf(reducedLegs).find(
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
const centeredPositions = partsOf(centeredLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const centeredKnee = limbKnee(centeredPositions, 0);
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
const cappedPositions = partsOf(cappedLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const cappedKnee = limbKnee(cappedPositions, 0);
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
const leaningPositions = partsOf(leaningLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const legCount = baselinePositions.length / LIMB_FLOATS;
const firstLeftBefore = limbKnee(baselinePositions, 0);
const firstLeftAfter = limbKnee(leaningPositions, 0);
const firstRightBefore = limbKnee(baselinePositions, 1);
const firstRightAfter = limbKnee(leaningPositions, 1);
const lastLeftBefore = limbKnee(baselinePositions, legCount - 2);
const lastLeftAfter = limbKnee(leaningPositions, legCount - 2);
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
const longTrunkPositions = partsOf(longTrunkLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const longTrunkLeaningSource = copy(longTrunkSource);
longTrunkLeaningSource.legs.jointLean = 0.2;
const longTrunkLeaningLegs = new Beefwife(longTrunkLeaningSource, {
  random: () => 0.5,
});
const longTrunkLeaningPositions = partsOf(longTrunkLeaningLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(
  near(
    limbKnee(longTrunkPositions, 0).x -
      limbKnee(longTrunkLeaningPositions, 0).x,
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
const offsetCenterPositions = partsOf(offsetCenterLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(near(limbKnee(offsetCenterPositions, 0).x, firstLeftBefore.x));
assert.ok(
  near(
    limbKnee(offsetCenterPositions, legCount - 2).x - lastLeftBefore.x,
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
const widePositions = partsOf(wideLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(
  near(
    edgeWidth(widePositions, 0, "hip"),
    edgeWidth(baselinePositions, 0, "hip") * 2,
  ),
);
assert.equal(
  partsOf(baselineLegs).find((child) => child instanceof Mesh).tint,
  colourNumber(bentLeggedSource.definitions.paints.leg.fill),
);
checks += 3;
wideLegs.destroy();

/* A limb paint that asks for both gets two children over one set of vertices:
   the mesh tints the triangles, the path traces the outline they came from. */
const limbCount = bentLeggedSource.legs.pairs * 2;
const strokedSource = copy(bentLeggedSource);
strokedSource.definitions.paints.leg.stroke = { colour: "#ffffff", width: 2 };
const strokedLegs = new Beefwife(strokedSource, { random: () => 0.5 });
const strokedFill = partsOf(strokedLegs)[limbCount];
const strokedOutline = partsOf(strokedLegs)[limbCount + 1];
assert.ok(strokedFill instanceof Mesh);
assert.equal(
  strokedFill.tint,
  colourNumber(strokedSource.definitions.paints.leg.fill),
);
assert.ok(strokedOutline instanceof Graphics);
assert.deepEqual(fillsOf(strokedOutline.context), []);
assert.equal(strokesOf(strokedOutline.context).length, 1);
assert.equal(
  strokesOf(strokedOutline.context)[0].color,
  colourNumber("#ffffff"),
);
assert.equal(strokesOf(strokedOutline.context)[0].width, 2);
/* The outline walks the mesh's own vertices in the mesh's own order. It drops
   the repeats the stacked side of a knee leaves behind, because a stroke
   divides by the length of every segment it is handed. */
const withoutRepeats = (points) =>
  points.filter(
    (point, index) =>
      index === 0 ||
      point[0] !== points[index - 1][0] ||
      point[1] !== points[index - 1][1],
  );
const filledOutlines = [];
for (let leg = 0; leg < limbCount; leg++)
  filledOutlines.push(
    withoutRepeats(
      Array.from({ length: LIMB_VERTICES }, (_, vertex) => {
        const point = limbVertex(strokedFill.dynamicPositions, leg, vertex);
        return [point.x, point.y];
      }),
    ),
  );
assert.deepEqual(pointsOf(strokedOutline), filledOutlines.flat());
assert.equal(
  pointsOf(strokedOutline).length,
  limbCount * (LIMB_VERTICES - KNEE_POINTS + 1),
);
checks += 8;
strokedLegs.destroy();

/* No width is no limb, whichever way it draws; the feet stand on their own. */
const barefootSource = copy(strokedSource);
barefootSource.legs.skin.limbWidth = 0;
const barefootLegs = new Beefwife(barefootSource, { random: () => 0.5 });
assert.deepEqual(pointsOf(partsOf(barefootLegs)[limbCount + 1]), []);
const hiddenSource = copy(bentLeggedSource);
hiddenSource.legs.skin.limbWidth = 0;
const hiddenLegs = new Beefwife(hiddenSource, { random: () => 0.5 });
assert.ok(
  Array.from(
    partsOf(hiddenLegs).find((child) => child instanceof Mesh).dynamicPositions,
  ).every((value) => value === 0),
);
checks += 2;
barefootLegs.destroy();
hiddenLegs.destroy();

/* A triangle list is right when its triangles cover the outline exactly once.
   Total area catches a missing, doubled, or misdirected triangle without
   restating the index list. Winding is deliberately not checked: the meshes
   render unculled, and a cap fanned from a hub at one end necessarily runs
   opposite to the ring direction at the other. */
const signedArea = (positions, indices) => {
  let total = 0;
  for (let at = 0; at < indices.length; at += 3) {
    const [a, b, c] = [indices[at], indices[at + 1], indices[at + 2]];
    total +=
      ((positions[b * 2] - positions[a * 2]) *
        (positions[c * 2 + 1] - positions[a * 2 + 1]) -
        (positions[c * 2] - positions[a * 2]) *
          (positions[b * 2 + 1] - positions[a * 2 + 1])) /
      2;
  }
  return total;
};
const unsignedArea = (positions, indices) => {
  let total = 0;
  for (let at = 0; at < indices.length; at += 3)
    total += Math.abs(signedArea(positions, indices.subarray(at, at + 3)));
  return total;
};
const shoelace = (points) => {
  let total = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    total += x1 * y2 - x2 * y1;
  }
  return Math.abs(total) / 2;
};

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
const ribbonMeshes = partsOf(ribbonStroked).filter(
  (child) => child instanceof Mesh,
);
const ribbonFill = ribbonMeshes[ribbonMeshes.length - 1];
const ribbonOutline =
  partsOf(ribbonStroked)[partsOf(ribbonStroked).indexOf(ribbonFill) + 1];
assert.ok(ribbonOutline instanceof Graphics);
assert.deepEqual(fillsOf(ribbonOutline.context), []);
assert.equal(
  strokesOf(ribbonOutline.context)[0].color,
  colourNumber("#00ff00"),
);
const ribbonChunks =
  (ribbonFill.dynamicPositions.length / 2 - CAP_VERTICES * 2) / 2;
assert.equal(
  pointsOf(ribbonOutline).length,
  ribbonChunks * 2 + (CAP_SEGMENTS - 1) * 2,
);
const meshVertices = new Set();
for (let at = 0; at < ribbonFill.dynamicPositions.length; at += 2)
  meshVertices.add(
    `${ribbonFill.dynamicPositions[at]},${ribbonFill.dynamicPositions[at + 1]}`,
  );
assert.ok(
  pointsOf(ribbonOutline).every(([x, y]) => meshVertices.has(`${x},${y}`)),
);
/* Walking the same vertices is not the same as covering the same area: the
   triangle list must enclose exactly what the outline encloses, and wind one
   way throughout, or the fill shows a hole the stroke does not. */
const ribbonTriangles = Geometry.ribbonIndicesFor(ribbonChunks);
const ribbonFilled = unsignedArea(ribbonFill.dynamicPositions, ribbonTriangles);
/* The outline walks the mesh's own vertices, so this is exact bar float
   error; a loose tolerance here hides a dropped quad at the tapered tail. */
assert.ok(
  Math.abs(ribbonFilled / shoelace(pointsOf(ribbonOutline)) - 1) < 1e-9,
  `fill covers ${ribbonFilled}, stroke encloses ${shoelace(pointsOf(ribbonOutline))}`,
);
checks += 6;
ribbonStroked.destroy();

/* Everything under legs.skin is drawn, never simulated, so editing it leaves
   the walked limbs exactly where they were; a leg rebuild would replant them. */
const plantedLegs = new Beefwife(bentLeggedSource, { random: () => 0.5 });
for (let frame = 0; frame < 30; frame++) plantedLegs.step(1 / 60);
plantedLegs.onRender();
const walkedLimbs = [
  ...partsOf(plantedLegs).find((child) => child instanceof Mesh)
    .dynamicPositions,
];
const rescaledFoot = copy(bentLeggedSource);
rescaledFoot.legs.skin.foot.scale *= 2;
plantedLegs.setDescriptor(rescaledFoot);
plantedLegs.onRender();
assert.deepEqual(
  [
    ...partsOf(plantedLegs).find((child) => child instanceof Mesh)
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
const straightPositions = partsOf(straightLegs).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
const straightKnee = limbKnee(straightPositions, 0);
const straightHip = limbPoint(straightPositions, 0, "hip");
const straightFoot = limbPoint(straightPositions, 0, "foot");
assert.ok(near(straightKnee.x, (straightHip.x + straightFoot.x) / 2));
assert.ok(near(straightKnee.y, (straightHip.y + straightFoot.y) / 2));

const mirroredSource = copy(bentLeggedSource);
mirroredSource.legs.jointBend = -1;
const mirroredLegs = new Beefwife(mirroredSource, { random: () => 0.5 });
const mirroredKnee = limbKnee(
  partsOf(mirroredLegs).find((child) => child instanceof Mesh).dynamicPositions,
  0,
);
assert.ok(near(mirroredKnee.x, 2 * straightKnee.x - baselineKnee.x));
assert.ok(near(mirroredKnee.y, 2 * straightKnee.y - baselineKnee.y));
checks += 4;
straightLegs.destroy();
mirroredLegs.destroy();
baselineLegs.destroy();

/* Hip, the knee swept outside the bend, foot down one side and foot, the one
   corner inside it, hip back up the other. */
const outline = [
  [0, 1],
  [1, 1.5],
  [1.3, 1.45],
  [1.55, 1.3],
  [1.7, 1.05],
  [1.75, 0.8],
  [2.2, 0.2],
  [1.4, -0.3],
  [1.2, 0.4],
  [1.2, 0.4],
  [1.2, 0.4],
  [1.2, 0.4],
  [1.2, 0.4],
  [0, -1],
];
const limbPositions = new Float32Array(outline.flat());
const limbIndices = Geometry.limbIndicesFor(1);
assert.equal(limbIndices.length, (outline.length / 2 - 1) * 6);
assert.ok(
  near(unsignedArea(limbPositions, limbIndices), shoelace(outline)),
  "limb triangles do not cover the outline exactly once",
);
checks += 2;

/* The projection object stays live so a host can follow its viewport, which
   means it can hold anything after construction validated it. An uncapped
   offset is the one that turns knees into infinities. */
const liveProjection = { centerX: 0, centerY: 0, perspective: 0.002 };
const projected = new Beefwife(bentLeggedSource, {
  random: () => 0.5,
  render: { kneeProjection: liveProjection },
});
liveProjection.perspective = 1e300;
projected.step(1 / 60);
projected.onRender();
const projectedVertices = partsOf(projected).find(
  (child) => child instanceof Mesh,
).dynamicPositions;
assert.ok(
  [...projectedVertices].every(Number.isFinite),
  "a live projection change produced non-finite vertices",
);
liveProjection.centerX = 1e300;
projected.onRender();
assert.ok([...projectedVertices].every(Number.isFinite));
projected.destroy();
checks += 2;

console.log(`beefwife geometry: ${checks} vertex checks passed`);
