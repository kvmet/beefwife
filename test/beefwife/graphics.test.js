/**
 * Does Beefwife own one retained Pixi scene with the promised overlap order?
 * A minimal Pixi implementation is the control. The shapes draw as particles
 * out of a baked atlas, so what is held here is the scene: the order of the
 * bands, which placement each particle answers to, and the transform written
 * onto it. What a frame is drawn from belongs to `atlas.test.js`. Fails if
 * feet cover limbs, meshes rebuild instead of updating, a replacement
 * discards a display object it could have kept, an invalid resource mutates
 * the instance, or destruction leaves owned display objects alive.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { PIXI, pointsOf } = require("./pixi.js");
const { Container, Mesh, ParticleContainer } = PIXI;
const { Beefwife } = require("../../beefwife/src/beefwife.mjs");
const Model = require("../../beefwife/src/model.mjs");
const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
// The creature's own parts, which are one container down from the Beefwife.
const partsOf = (beefwife) => beefwife.children[0].children;
const bandsOf = (beefwife) =>
  new Map(
    partsOf(beefwife)
      .filter((child) => child instanceof ParticleContainer)
      .map((child) => [child.label, child]),
  );
const particlesOf = (beefwife, label) =>
  bandsOf(beefwife).get(label)?.particleChildren ?? [];
/* Baking is the only step that wants a GPU, and it rasterises what the plan
   already decided. Standing in for the renderer leaves the whole scene under
   test. */
const stubRenderer = { render() {} };
const draw = (beefwife) => beefwife.onRender(stubRenderer);
let checks = 0;

const legged = copy(source);
legged.legs.pairs = 3;
const beefwife = new Beefwife(legged, { random: () => 0.5 });
assert.ok(beefwife instanceof Container);
assert.equal(beefwife.label, legged.name);
assert.equal(typeof beefwife.onRender, "function");
checks += 3;

/* Frames come from a renderer, and the first one arrives with Pixi's own
   render callback, so a creature that has never been drawn holds its meshes
   and no shapes at all. */
assert.equal(bandsOf(beefwife).size, 0);
assert.equal(partsOf(beefwife).filter((child) => child instanceof Mesh).length, 2);
draw(beefwife);
checks += 2;

const footCount = legged.legs.pairs * 2;
const skinOf = (descriptor) => Model.compile(descriptor).skin;
assert.equal(particlesOf(beefwife, "feet").length, footCount);
assert.equal(
  particlesOf(beefwife, "plates").length,
  skinOf(legged).platesTailFirst.length,
);
const meshIndexes = partsOf(beefwife)
  .map((child, index) => (child instanceof Mesh ? index : -1))
  .filter((index) => index >= 0);
// One band of feet stands ahead of the limb mesh, whatever the pair count.
assert.equal(meshIndexes[0], 1);
assert.equal(meshIndexes.length, 2);
assert.ok(meshIndexes[1] > meshIndexes[0]);
checks += 4;

const meshes = partsOf(beefwife).filter((child) => child instanceof Mesh);
const buffers = meshes.map((mesh) => mesh.positionBuffer);
/* Pixi counts buffer uploads in `_updateID`. Exactly one per render pass says
   the vertices reach the GPU once, neither skipped nor written twice. */
const uploads = buffers.map((buffer) => buffer._updateID);
const children = [...partsOf(beefwife)];
beefwife.step(1 / 60);
draw(beefwife);
assert.deepEqual(partsOf(beefwife), children);
assert.deepEqual(
  buffers.map((buffer) => buffer._updateID),
  uploads.map((id) => id + 1),
);
checks += 2;

/* A foot plants at `plantedScale` and swings at 1, and its frame is baked at
   the larger, so the particle scales down to draw and never up. Mirroring is
   the sign on the vertical, as it was on the child's own scale. */
const feet = particlesOf(beefwife, "feet");
assert.ok(feet.every((foot) => Math.abs(foot.scaleX) <= 1 + 1e-9));
assert.ok(feet.every((foot) => Math.abs(foot.scaleY) === foot.scaleX));
assert.ok(feet.some((foot) => foot.scaleY < 0));
assert.ok(feet.every((foot) => Number.isFinite(foot.rotation)));
checks += 4;

const invalidPaint = copy(legged);
invalidPaint.definitions.paints.shell.fill = "notacolor";
assert.throws(() => beefwife.setDescriptor(invalidPaint), /shell\.fill/);
assert.equal(
  beefwife.descriptor.definitions.paints.shell.fill,
  legged.definitions.paints.shell.fill,
);
checks += 2;

/* Colour is baked into a frame rather than tinted onto a particle, because one
   tint cannot recolour a fill and an outline apart. Repainting therefore
   re-bakes, and what has to survive is the body: the meshes stay, and so does
   every particle's placement. */
const recolored = copy(legged);
recolored.definitions.paints.shell.fill = "#123456";
beefwife.setDescriptor(recolored);
draw(beefwife);
assert.equal(beefwife.descriptor.definitions.paints.shell.fill, "#123456");
assert.ok(meshes.every((mesh) => !mesh.destroyed));
assert.equal(particlesOf(beefwife, "feet").length, footCount);
assert.equal(
  particlesOf(beefwife, "plates").length,
  skinOf(recolored).platesTailFirst.length,
);
checks += 4;

/* Changing what the scene is made of keeps every part that still fits, so a
   chunk count edit replaces the ribbon mesh and leaves the limbs. */
const meshesOf = () =>
  partsOf(beefwife).filter((child) => child instanceof Mesh);
const restructured = copy(recolored);
restructured.chain.sections.tail.chunks += 1;
restructured.chain.skin.plates[1].repeat.count = null;
beefwife.setDescriptor(restructured);
draw(beefwife);
assert.equal(meshesOf()[0], meshes[0]);
assert.ok(meshes[1].destroyed);
assert.equal(partsOf(beefwife).indexOf(meshes[1]), -1);
assert.ok(partsOf(beefwife).every((child) => !child.destroyed));
checks += 4;

/* A leg pair is one strip of the limb mesh, so adding one replaces that mesh
   and the ribbon it draws over survives. The feet follow the pair count. */
const morePairs = copy(restructured);
morePairs.legs.pairs += 1;
const keptRibbon = meshesOf()[1];
beefwife.setDescriptor(morePairs);
draw(beefwife);
assert.ok(!keptRibbon.destroyed);
assert.equal(meshesOf()[1], keptRibbon);
assert.ok(meshes[0].destroyed);
assert.equal(particlesOf(beefwife, "feet").length, morePairs.legs.pairs * 2);
checks += 4;

/* Overlap order is the whole promise of the retained scene, and half of it is
   invisible in a scene with no stroke and no under-layer ornament. This one
   carries every kind at once, so a swap anywhere in `_arrange` moves a band
   and fails. */
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
const stack = new Beefwife(layered, { random: () => 0.5 });
stack.step(1 / 60);
draw(stack);
const kindOf = (child) =>
  child instanceof Mesh
    ? "mesh"
    : child instanceof ParticleContainer
      ? child.label
      : pointsOf(child).length
        ? "path"
        : "?";
const ORDER = [
  "feet",
  "mesh",
  "path",
  "ornaments-under",
  "mesh",
  "path",
  "plates",
  "ornaments-over",
];
assert.deepEqual(partsOf(stack).map(kindOf), ORDER);
assert.equal(particlesOf(stack, "ornaments-under").length, 1);
assert.equal(particlesOf(stack, "ornaments-over").length, 1);
checks += 3;

/* The order has to survive an edit that changes the cast, not just the first
   build: `_arrange` runs again and must put everything back. */
const restacked = copy(layered);
restacked.legs.pairs = 3;
stack.setDescriptor(restacked);
draw(stack);
assert.deepEqual(partsOf(stack).map(kindOf), ORDER);
assert.equal(particlesOf(stack, "feet").length, 6);
checks += 2;

/* Moving an ornament between layers changes the order without changing the
   cast, so an emptied band has to go rather than linger as a broken batch. */
const flipped = copy(restacked);
flipped.chain.skin.ornaments[0].layer = "over";
stack.setDescriptor(flipped);
draw(stack);
assert.deepEqual(partsOf(stack).map(kindOf), [
  "feet",
  "mesh",
  "path",
  "mesh",
  "path",
  "plates",
  "ornaments-over",
]);
assert.equal(particlesOf(stack, "ornaments-over").length, 2);
checks += 2;

/* A dropped band must be destroyed, not merely unparented: the scene is
   retained, so anything left alive is a leak nothing will ever collect. It
   leaves the scene on the draw that replaces it and is destroyed on the next
   one, because the draw that replaces it is running inside a pass already
   holding it. Destroying it there strands the rest of the pass on a texture
   with no source. */
const fewer = copy(flipped);
fewer.chain.skin.ornaments = [];
const before = [...partsOf(stack)];
stack.setDescriptor(fewer);
draw(stack);
const dropped = before.filter((child) => !partsOf(stack).includes(child));
assert.ok(dropped.length > 0);
assert.ok(
  dropped.every((child) => !child.destroyed),
  "a replaced band was destroyed inside the pass still drawing it",
);
assert.equal(bandsOf(stack).has("ornaments-over"), false);
draw(stack);
assert.ok(
  dropped.every((child) => child.destroyed),
  "a replaced band outlived the pass that held it",
);
checks += 4;

/* A host may add its own children to a Beefwife, and settling the parts' draw
   order re-adds every one of them, which would move each past a marker that
   was already there. The parts hold a container of their own so that the
   marker keeps the place the host gave it. */
const marker = stack.addChild(new Container());
const markerIndex = stack.children.indexOf(marker);
const recast = copy(fewer);
recast.legs.pairs = 4;
stack.setDescriptor(recast);
draw(stack);
assert.equal(stack.children.indexOf(marker), markerIndex);
assert.equal(marker.parent, stack);
checks += 2;
stack.destroy();

/* A mesh rebuilt for a new vertex count must take its geometry with it: Pixi
   drops the reference without destroying it, and the renderer holds the
   buffers until an idle sweep. */
const regeometried = copy(morePairs);
regeometried.chain.sections.tail.chunks += 2;
const oldGeometry = partsOf(beefwife)
  .filter((child) => child instanceof Mesh)
  .at(-1).geometry;
assert.ok(oldGeometry);
beefwife.setDescriptor(regeometried);
// Geometry carries no destroyed flag; a destroyed one has dropped its buffers.
assert.equal(
  oldGeometry.buffers,
  null,
  "a replaced mesh left its geometry behind",
);
checks += 2;

/* The last creature drawing a set of frames takes the texture with it, which
   is what keeps a lab session editing a descriptor from stacking up sheets. */
draw(beefwife);
const sheet = bandsOf(beefwife).get("feet").particleChildren[0].texture.source;
assert.equal(sheet.destroyed, false);
const owned = [...partsOf(beefwife)];
beefwife.destroy();
assert.equal(beefwife.destroyed, true);
assert.ok(owned.every((child) => child.destroyed));
assert.equal(sheet.destroyed, true, "the last creature left its atlas behind");
checks += 4;

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
