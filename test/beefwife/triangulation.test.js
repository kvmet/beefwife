/**
 * Does a Beefwife's triangle list cover its outline exactly once? Total area
 * is the control: it catches a missing, doubled, or misdirected triangle
 * without restating the index list. Fails if a limb or a ribbon fills more or
 * less than the shape its own stroke walks.
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
const Geometry = require("../../beefwife/src/geometry.mjs");
const copy = (value) => JSON.parse(JSON.stringify(value));
// The creature's own parts, which are one container down from the Beefwife.
const partsOf = (beefwife) => beefwife.children[0].children;
/* Mesh positions are float32, so a coordinate a few hundred px from the origin
   comes back a fraction off what was written. */
const near = (before, after) => Math.abs(before - after) < 1e-4;
let checks = 0;

const bentLeggedSource = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "long-girl.json"),
    "utf8",
  ),
);
bentLeggedSource.legs.fold = 0.75;
bentLeggedSource.legs.jointLean = 0;

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

console.log(`beefwife triangulation: ${checks} coverage checks passed`);
