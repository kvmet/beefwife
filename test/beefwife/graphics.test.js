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

const { Container, Mesh } = require("./pixi-mock.js");
const Beefwife = require("../../beefwife/beefwife.js");
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

const invalidPaint = copy(source);
invalidPaint.definitions.paints.shell.fill = "BAD";
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
assert.ok(beefwife.children.every((child, index) => child === children[index]));
assert.ok(
  beefwife.children
    .filter((child) => child.context)
    .flatMap((child) => child.context.fills)
    .includes("#123456"),
);
checks += 4;

/* Changing what the scene is made of keeps every part that still fits, so a
   chunk count edit replaces the ribbon mesh and leaves the limbs and feet. */
const meshesOf = () =>
  beefwife.children.filter((child) => child instanceof Mesh);
const feet = children.slice(0, footCount);
const restructured = copy(recolored);
restructured.chain.sections.tail.chunks += 1;
restructured.chain.skin.plates[1].repeat.count = null;
beefwife.setDescriptor(restructured);
assert.ok(feet.every((foot) => !foot.destroyed && foot.parent === beefwife));
assert.equal(meshesOf()[0], meshes[0]);
assert.ok(meshes[1].destroyed);
assert.equal(beefwife.children.indexOf(meshes[1]), -1);
assert.ok(beefwife.children.every((child) => !child.destroyed));
assert.equal(beefwife.children.indexOf(meshesOf()[0]), footCount);
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
  beefwife.children.indexOf(meshesOf()[0]),
  morePairs.legs.pairs * 2,
);
checks += 4;

// Every drawable scale the schema admits must reach the path transform.
const tinyPlate = copy(source);
tinyPlate.chain.skin.loadScale = 0;
tinyPlate.chain.skin.plates = [tinyPlate.chain.skin.plates[0]];
tinyPlate.chain.skin.plates[0].scale = 0.002;
tinyPlate.chain.sections.head.profile.plateScale = { start: 1, end: 1 };
const tiny = new Beefwife(tinyPlate, { random: () => 0.5 });
const drawnScales = tiny.children
  .filter((child) => child.context?.drawnPath)
  .map((child) => child.context.drawnPath.matrix.a);
assert.ok(drawnScales.every((scale) => scale > 0));
assert.ok(drawnScales.some((scale) => Math.abs(scale / 0.002 - 1) < 0.02));
tiny.destroy();
checks += 2;

const owned = [...beefwife.children];
beefwife.destroy();
assert.equal(beefwife.destroyed, true);
assert.ok(owned.every((child) => child.destroyed));
checks += 2;

console.log(`beefwife graphics: ${checks} retained-scene checks passed`);
