/**
 * Does Beefwife own one retained Pixi scene with the promised overlap order?
 * A minimal Pixi implementation is the control. Fails if feet cover limbs,
 * meshes rebuild instead of updating, an invalid resource mutates the
 * instance, or destruction leaves owned display objects alive.
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
