/**
 * Does Beefwife own one retained Pixi scene with the promised overlap order?
 * A minimal Pixi implementation is the control. Fails if feet cover limbs,
 * meshes rebuild instead of updating, a replacement discards a display object
 * it could have kept, an invalid resource mutates the instance, or destruction
 * leaves owned display objects alive.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PIXI,
  fillsOf,
  pointsOf,
  colourNumber,
  colourText,
  drawnWidthOf,
  pathWidthOf,
} = require("./pixi.js");
const { Container, Mesh } = PIXI;
const { Beefwife } = require("../../beefwife/src/beefwife.mjs");
const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
// The creature's own parts, which are one container down from the Beefwife.
const partsOf = (beefwife) => beefwife.children[0].children;
let checks = 0;

const beefwife = new Beefwife(source, { random: () => 0.5 });
assert.ok(beefwife instanceof Container);
assert.equal(beefwife.label, source.name);
assert.equal(typeof beefwife.onRender, "function");
checks += 3;

const footCount = source.legs.pairs * 2;
const meshIndexes = partsOf(beefwife)
  .map((child, index) => (child instanceof Mesh ? index : -1))
  .filter((index) => index >= 0);
assert.equal(meshIndexes[0], footCount);
assert.equal(meshIndexes.length, 2);
assert.ok(meshIndexes[1] > meshIndexes[0]);
checks += 3;

const meshes = partsOf(beefwife).filter((child) => child instanceof Mesh);
const buffers = meshes.map((mesh) => mesh.positionBuffer);
/* Pixi counts buffer uploads in `_updateID`. Exactly one per render pass says
   the vertices reach the GPU once, neither skipped nor written twice. */
const uploads = buffers.map((buffer) => buffer._updateID);
const children = [...partsOf(beefwife)];
beefwife.step(1 / 60);
beefwife.onRender();
assert.deepEqual(partsOf(beefwife), children);
assert.deepEqual(
  buffers.map((buffer) => buffer._updateID),
  uploads.map((id) => id + 1),
);
checks += 2;

const invalidPaint = copy(source);
invalidPaint.definitions.paints.shell.fill = "notacolor";
assert.throws(() => beefwife.setDescriptor(invalidPaint), /shell\.fill/);
assert.equal(
  beefwife.descriptor.definitions.paints.shell.fill,
  source.definitions.paints.shell.fill,
);
checks += 2;

/* A scene that still needs the same display objects keeps them and repaints
   in place, so editing a colour cannot restart the creature. */
const recolored = copy(source);
recolored.definitions.paints.shell.fill = "#123456";
beefwife.setDescriptor(recolored);
assert.equal(beefwife.descriptor.definitions.paints.shell.fill, "#123456");
assert.ok(children.every((child) => !child.destroyed));
assert.ok(partsOf(beefwife).every((child, index) => child === children[index]));
assert.ok(
  partsOf(beefwife)
    .filter((child) => child.context)
    .flatMap((child) => fillsOf(child.context))
    .includes(colourNumber("#123456")),
);
checks += 4;

/* Changing what the scene is made of keeps every part that still fits, so a
   chunk count edit replaces the ribbon mesh and leaves the limbs and feet. */
const meshesOf = () =>
  partsOf(beefwife).filter((child) => child instanceof Mesh);
const feet = children.slice(0, footCount);
const restructured = copy(recolored);
restructured.chain.sections.tail.chunks += 1;
restructured.chain.skin.plates[1].repeat.count = null;
beefwife.setDescriptor(restructured);
assert.ok(
  feet.every((foot) => !foot.destroyed && foot.parent === beefwife.children[0]),
);
assert.equal(meshesOf()[0], meshes[0]);
assert.ok(meshes[1].destroyed);
assert.equal(partsOf(beefwife).indexOf(meshes[1]), -1);
assert.ok(partsOf(beefwife).every((child) => !child.destroyed));
assert.equal(partsOf(beefwife).indexOf(meshesOf()[0]), footCount);
checks += 6;

/* A leg pair is one strip of the limb mesh, so adding one replaces that mesh
   and the ribbon it draws over survives. */
const morePairs = copy(restructured);
morePairs.legs.pairs += 1;
const keptRibbon = meshesOf()[1];
beefwife.setDescriptor(morePairs);
assert.ok(!keptRibbon.destroyed);
assert.equal(meshesOf()[1], keptRibbon);
assert.ok(meshes[0].destroyed);
assert.equal(
  partsOf(beefwife).indexOf(meshesOf()[0]),
  morePairs.legs.pairs * 2,
);
checks += 4;

/* Overlap order is the whole promise of the retained scene, and half of it is
   invisible in a scene with no stroke and no under-layer ornament. This one
   carries every kind at once, each in its own colour, so a swap anywhere in
   `_arrange` moves a colour and fails. */
const layered = copy(source);
layered.legs.pairs = 2;
layered.definitions.paints.leg.stroke = { colour: "#aa0001", width: 1 };
layered.definitions.paints.ribbon.stroke = { colour: "#aa0002", width: 1 };
layered.definitions.paints.under = { fill: "#c00001", stroke: null };
layered.definitions.paints.over = { fill: "#c00002", stroke: null };
layered.definitions.paints.plate = { fill: "#c00003", stroke: null };
layered.chain.skin.plates = [
  {
    ...source.chain.skin.plates[0],
    paint: "plate",
    repeat: { count: 1, step: 1 },
  },
];
const oneOrnament = { ...source.chain.skin.ornaments[0], side: "left" };
layered.chain.skin.ornaments = [
  { ...oneOrnament, id: "beneath", paint: "under", layer: "under" },
  { ...oneOrnament, id: "above", paint: "over", layer: "over" },
];
const foot = layered.definitions.paints.foot.fill;
const stack = new Beefwife(layered, { random: () => 0.5 });
stack.step(1 / 60);
stack.onRender();
const kindOf = (child) =>
  child instanceof Mesh
    ? "mesh"
    : pointsOf(child).length
      ? "path"
      : fillsOf(child.context).map(colourText).join();
assert.deepEqual(partsOf(stack).map(kindOf), [
  foot,
  foot,
  foot,
  foot,
  "mesh",
  "path",
  "#c00001",
  "mesh",
  "path",
  "#c00003",
  "#c00002",
]);
checks += 1;

/* The order has to survive an edit that changes the cast, not just the first
   build: `_arrange` runs again and must put everything back. */
const restacked = copy(layered);
restacked.legs.pairs = 3;
stack.setDescriptor(restacked);
stack.onRender();
assert.deepEqual(partsOf(stack).map(kindOf), [
  foot,
  foot,
  foot,
  foot,
  foot,
  foot,
  "mesh",
  "path",
  "#c00001",
  "mesh",
  "path",
  "#c00003",
  "#c00002",
]);
checks += 1;

/* Moving an ornament between layers changes the order without changing the
   cast, so the order has to be re-settled on the layer list alone. */
const flipped = copy(restacked);
flipped.chain.skin.ornaments[0].layer = "over";
stack.setDescriptor(flipped);
stack.onRender();
assert.deepEqual(partsOf(stack).map(kindOf).slice(-5), [
  "mesh",
  "path",
  "#c00003",
  "#c00001",
  "#c00002",
]);
checks += 1;

/* A dropped child must be destroyed, not merely unparented: the scene is
   retained, so anything left alive is a leak nothing will ever collect. */
const fewer = copy(flipped);
fewer.chain.skin.ornaments = [flipped.chain.skin.ornaments[1]];
const before = [...partsOf(stack)];
stack.setDescriptor(fewer);
const dropped = before.filter((child) => !partsOf(stack).includes(child));
assert.equal(dropped.length, 1);
assert.ok(dropped[0].destroyed);
assert.equal(partsOf(stack).length, before.length - 1);
checks += 3;

/* A host may add its own children to a Beefwife, and settling the parts' draw
   order re-adds every one of them, which would move each past a marker that
   was already there. The parts hold a container of their own so that the
   marker keeps the place the host gave it. */
const marker = stack.addChild(new Container());
const markerIndex = stack.children.indexOf(marker);
const recast = copy(fewer);
recast.legs.pairs = 4;
stack.setDescriptor(recast);
assert.equal(stack.children.indexOf(marker), markerIndex);
assert.equal(marker.parent, stack);
checks += 2;
stack.destroy();

// Every drawable scale the schema admits must reach the path transform.
const tinyPlate = copy(source);
tinyPlate.chain.skin.loadScale = 0;
tinyPlate.chain.skin.plates = [tinyPlate.chain.skin.plates[0]];
tinyPlate.chain.skin.plates[0].scale = 0.002;
tinyPlate.chain.sections.head.profile.plateScale = { start: 1, end: 1 };
const tiny = new Beefwife(tinyPlate, { random: () => 0.5 });
/* Pixi bakes the draw scale into the path rather than keeping it on the child,
   so the width it drew is the only place the scale is observable. */
const plateShape =
  tinyPlate.definitions.shapes[tinyPlate.chain.skin.plates[0].shape];
const drawnScales = partsOf(tiny)
  .filter((child) => child.context)
  .map((child) => drawnWidthOf(child.context) / pathWidthOf(plateShape.path));
assert.ok(drawnScales.every((scale) => scale > 0));
assert.ok(drawnScales.some((scale) => Math.abs(scale / 0.002 - 1) < 0.02));
tiny.destroy();
checks += 2;

/* A mesh rebuilt for a new vertex count must take its geometry with it: Pixi
   drops the reference without destroying it, and the renderer holds the
   buffers until an idle sweep. */
const regeometried = copy(source);
regeometried.chain.sections.tail.chunks += 2;
const oldGeometry = partsOf(beefwife).find((child) => child instanceof Mesh)
  ? partsOf(beefwife)
      .filter((child) => child instanceof Mesh)
      .at(-1).geometry
  : null;
assert.ok(oldGeometry);
beefwife.setDescriptor(regeometried);
// Geometry carries no destroyed flag; a destroyed one has dropped its buffers.
assert.equal(
  oldGeometry.buffers,
  null,
  "a replaced mesh left its geometry behind",
);
checks += 2;

const owned = [...partsOf(beefwife)];
const painted = new Map();
for (const child of owned)
  if (child.context)
    painted.set(child.context, (painted.get(child.context) ?? 0) + 1);
const subscribed = new Map(
  [...painted.keys()].map((context) => [
    context,
    context.listenerCount("update"),
  ]),
);
beefwife.destroy();
assert.equal(beefwife.destroyed, true);
assert.ok(owned.every((child) => child.destroyed));
/* Pixi's context setter subscribes a Graphics to its context and `destroy`
   never unsubscribes, so a shared context would hold every child it ever
   painted alive for as long as the shape and paint live. Each context has to
   shed exactly the children that just died. */
for (const [context, children] of painted)
  assert.equal(
    context.listenerCount("update"),
    subscribed.get(context) - children,
    "a destroyed child is still subscribed to a shared context",
  );
checks += 3;

/* A destroyed beefwife has no scene to keep in step with, and setDescriptor
   would build a second one under the dead container. */
for (const [act, reason] of [
  [() => beefwife.step(1 / 60), /destroyed beefwife/],
  [() => beefwife.setDescriptor(source), /destroyed beefwife/],
  [() => beefwife.reset(), /destroyed beefwife/],
  [() => beefwife.translate({ x: 1, y: 0 }), /destroyed beefwife/],
]) {
  assert.throws(act, reason);
  checks++;
}
assert.equal(beefwife.children.length, 0);
checks++;

console.log(`beefwife graphics: ${checks} retained-scene checks passed`);
