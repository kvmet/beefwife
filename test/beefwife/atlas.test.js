/**
 * Does the atlas name, size and place a frame for every shape a Beefwife
 * draws? Naming and packing are the halves that need no renderer, so this is
 * where the drawn scale, the outline width and the packing are held. Fails if
 * a frame is baked below the largest a part reaches, if a shape's origin lands
 * off its frame, if two frames overlap, if a population re-bakes what it could
 * share, or if two renderers are handed one texture between them.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PIXI,
  fillsOf,
  strokesOf,
  colourNumber,
  drawnWidthOf,
  pathWidthOf,
} = require("./pixi.js");
const Model = require("../../beefwife/src/model.mjs");
const {
  planAtlas,
  packAtlas,
  acquireAtlas,
  releaseAtlas,
  BAKE_SUPERSAMPLE,
  ATLAS_TEXEL_LIMIT,
} = require("../../beefwife/src/atlas.mjs");

const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
/* Baking is the only step that needs a GPU, and it draws what the plan already
   decided. Standing in for the renderer leaves every frame, rect and anchor
   under test and skips only the rasterising. */
const stubRenderer = () => {
  const drawn = [];
  return {
    drawn,
    render({ container, target, clear, transform }) {
      drawn.push({ container, target, clear, x: transform.tx, y: transform.ty });
    },
  };
};
let checks = 0;

// The canonical example walks on nothing, so the feet come from a legged copy.
const legged = copy(source);
legged.legs.pairs = 2;
const model = Model.compile(legged);
const plan = planAtlas(model, 0.5);
const sheet = packAtlas(plan);
assert.equal(plan.resolution, 0.5 * BAKE_SUPERSAMPLE);
assert.equal(plan.plates.length, model.skin.platesTailFirst.length);
assert.equal(plan.ornaments.length, model.skin.ornaments.length);
assert.equal(typeof plan.feet, "string");
checks += 4;

/* Naming a frame is what a whole population repeats, so a plan carries no
   context: measuring is the packing's job, and a creature joining a bake that
   already exists never reaches it. */
assert.ok(plan.frames.every((frame) => frame.context === undefined));
checks += 1;

/* One entry per distinct drawn shape, and every placement points at one. Two
   plates on chunks that profile alike share a frame; a shape drawn at two
   sizes does not. */
const keys = new Set(sheet.entries.map((entry) => entry.key));
assert.equal(keys.size, sheet.entries.length);
assert.equal(keys.size, plan.frames.length);
for (const key of [plan.feet, ...plan.plates, ...plan.ornaments])
  if (key !== null) assert.ok(keys.has(key), `${key} has no frame`);
checks += 2;

/* A frame is baked at the largest its placement ever draws, so a live particle
   only ever scales down. The foot plants at `plantedScale`, and a plate rides
   the load to `1 + loadScale`. */
const footEntry = sheet.entries.find((entry) => entry.key === plan.feet);
const foot = legged.legs.skin.foot;
assert.equal(footEntry.scale, foot.scale * foot.plantedScale);
const plateScaleOf = (key) =>
  sheet.entries.find((entry) => entry.key === key).scale;
const plates = model.skin.platesTailFirst;
plates.forEach((plate, index) => {
  if (plan.plates[index] === null) return;
  const load = 1 + Math.max(0, model.skin.loadScale);
  assert.ok(
    Math.abs(
      plateScaleOf(plan.plates[index]) /
        (plate.scale * model.chunks[plate.chunk].plateScale * load) -
        1,
    ) < 1e-9,
    "a plate frame was not baked at the load it reaches",
  );
});
checks += 2;

/* The origin the particle anchors on has to sit inside the frame, with the
   drawn shape and its outline clear of every edge. */
for (const entry of sheet.entries) {
  assert.ok(entry.originX >= entry.pad && entry.originY >= entry.pad);
  assert.ok(entry.originX <= entry.width - entry.pad);
  assert.ok(entry.originY <= entry.height - entry.pad);
  assert.ok(Number.isInteger(entry.width) && Number.isInteger(entry.height));
}
checks += 1;

// Shelf packing may not overlap, and everything must land inside the sheet.
for (const entry of sheet.entries) {
  assert.ok(entry.x >= 0 && entry.y >= 0);
  assert.ok(entry.x + entry.width <= sheet.width);
  assert.ok(entry.y + entry.height <= sheet.height);
}
for (const entry of sheet.entries)
  for (const other of sheet.entries) {
    if (entry === other) continue;
    const apart =
      entry.x + entry.width <= other.x ||
      other.x + other.width <= entry.x ||
      entry.y + entry.height <= other.y ||
      other.y + other.height <= entry.y;
    assert.ok(apart, `${entry.key} overlaps ${other.key}`);
  }
checks += 2;

/* Pixi bakes the draw scale into the path rather than keeping it on the child,
   so the width the context drew is the only place the scale is observable.
   Every drawable scale the schema admits must reach the path transform. */
const tinyPlate = copy(source);
tinyPlate.chain.skin.loadScale = 0;
tinyPlate.chain.skin.plates = [tinyPlate.chain.skin.plates[0]];
tinyPlate.chain.skin.plates[0].scale = 0.002;
tinyPlate.chain.sections.head.profile.plateScale = { start: 1, end: 1 };
const tinyPlan = planAtlas(Model.compile(tinyPlate), 1);
const tinySheet = packAtlas(tinyPlan);
const plateShape =
  tinyPlate.definitions.shapes[tinyPlate.chain.skin.plates[0].shape];
const drawnScales = tinyPlan.plates.map(
  (key) =>
    drawnWidthOf(tinySheet.entries.find((entry) => entry.key === key).context) /
    pathWidthOf(plateShape.path),
);
assert.ok(drawnScales.every((scale) => scale > 0));
assert.ok(drawnScales.some((scale) => Math.abs(scale / 0.002 - 1) < 0.02));
checks += 2;

/* An outline is a length, so a shape drawn at a fraction of its size wears a
   fraction of its stroke. Held at descriptor width, a plate at the schema's
   smallest scale disappears under an outline hundreds of times its own width. */
const outlined = copy(tinyPlate);
outlined.chain.skin.plates[0].scale = 0.5;
outlined.definitions.paints.shell.stroke = { colour: "#00ff00", width: 3 };
const outlinedSheet = packAtlas(planAtlas(Model.compile(outlined), 1));
const widthsOf = (colour) =>
  outlinedSheet.entries
    .flatMap((entry) => strokesOf(entry.context))
    .filter(({ color }) => color === colourNumber(colour))
    .map(({ width }) => width);
const plateWidths = widthsOf("#00ff00");
// The eye rides at scale 1, so it is the control that says 3 became 1.5 by
// halving rather than by some blanket factor.
const eyeWidths = widthsOf(outlined.definitions.paints.eye.stroke.colour);
assert.ok(plateWidths.length > 0 && eyeWidths.length > 0);
assert.ok(
  plateWidths.every((width) => Math.abs(width / 1.5 - 1) < 0.02),
  `half-scale outlines drew at ${plateWidths}, wanted 1.5`,
);
assert.ok(
  eyeWidths.every(
    (width) => width === outlined.definitions.paints.eye.stroke.width,
  ),
  `full-scale outlines drew at ${eyeWidths}, wanted 3.1`,
);
checks += 3;

// A plate a profile scales to nothing draws nothing, and asks for no frame.
const flattened = copy(tinyPlate);
flattened.chain.sections.head.profile.plateScale = { start: 0, end: 0 };
const flatPlan = planAtlas(Model.compile(flattened), 1);
assert.ok(flatPlan.plates.every((key) => key === null));
assert.ok(flatPlan.frames.every((frame) => frame.scale > 0));
checks += 2;

/* Colour is baked, not tinted, because one particle tint cannot recolour a
   fill and an outline apart. Repainting therefore names a different frame. */
const repainted = copy(legged);
repainted.definitions.paints.shell.fill = "#123456";
const repaintedPlan = planAtlas(Model.compile(repainted), 0.5);
assert.notEqual(repaintedPlan.key, plan.key);
assert.ok(
  packAtlas(repaintedPlan)
    .entries.flatMap((entry) => fillsOf(entry.context))
    .includes(colourNumber("#123456")),
);
checks += 2;

/* Resolution is part of what a frame is, so a renderer that changes scale
   cannot go on drawing frames baked for the old one. */
assert.notEqual(planAtlas(model, 1).key, plan.key);
checks += 1;

/* Every creature compiles its own model, so a population's shapes are all
   separate objects. Frames named by what they draw is what lets one bake
   serve the whole population, and lets the last creature take it away. */
const first = planAtlas(Model.compile(legged), 0.5);
const second = planAtlas(Model.compile(legged), 0.5);
assert.equal(first.key, second.key);
const renderer = stubRenderer();
const atlasA = acquireAtlas(first, renderer);
const bakes = renderer.drawn.length;
const atlasB = acquireAtlas(second, renderer);
assert.equal(atlasA, atlasB);
assert.equal(renderer.drawn.length, bakes, "a shared plan baked twice");
assert.equal(bakes, first.frames.length);
assert.ok(renderer.drawn[0].clear && !renderer.drawn[1].clear);
checks += 5;

/* The frames a bake hands back have to agree with the packing: one texture per
   entry, cut where the sheet placed it, anchored on the shape's own origin. */
for (const entry of packAtlas(first).entries) {
  const frame = atlasA.frames.get(entry.key);
  const texel = 1 / first.resolution;
  assert.ok(frame, `${entry.key} was never baked`);
  assert.equal(frame.scale, entry.scale);
  assert.equal(frame.texture.frame.x, entry.x * texel);
  assert.equal(frame.texture.frame.width, entry.width * texel);
  assert.ok(Math.abs(frame.anchorX - entry.originX / entry.width) < 1e-12);
  assert.equal(frame.texture.source, atlasA.target.source);
}
assert.equal(atlasA.target.source.resolution, first.resolution);
checks += 2;

const shared = atlasA.target.source;
releaseAtlas(atlasA);
assert.equal(shared.destroyed, false, "an atlas went while a creature held it");
releaseAtlas(atlasB);
assert.equal(shared.destroyed, true, "the last release left the atlas behind");
// A third comer bakes afresh rather than handing back the destroyed sheet.
const revived = acquireAtlas(planAtlas(Model.compile(legged), 0.5), renderer);
assert.notEqual(revived.target.source, shared);
releaseAtlas(revived);
checks += 3;

/* A creature with nothing to place holds no atlas at all, rather than an
   empty texture nothing can sample. */
const bare = copy(legged);
bare.chain.skin.plates = [];
bare.chain.skin.ornaments = [];
bare.legs.pairs = 0;
const barePlan = planAtlas(Model.compile(bare), 0.5);
assert.equal(barePlan.plates.length, 0);
assert.equal(barePlan.ornaments.length, 0);
assert.equal(barePlan.frames.length, 0);
assert.equal(acquireAtlas(barePlan, stubRenderer()), null);
checks += 3;

/* A page mounting two canvases gives each its own renderer, and a texture
   belongs to the one that made it. Frames named alike must still bake twice,
   and the release that empties one must leave the other's sheet standing. */
const left = stubRenderer();
const right = stubRenderer();
const sharedPlan = planAtlas(Model.compile(legged), 0.5);
const onLeft = acquireAtlas(sharedPlan, left);
const onRight = acquireAtlas(planAtlas(Model.compile(legged), 0.5), right);
assert.notEqual(onLeft, onRight, "two renderers were handed one atlas");
assert.notEqual(onLeft.target.source, onRight.target.source);
assert.equal(left.drawn.length, right.drawn.length);
const leftSheet = onLeft.target.source;
const rightSheet = onRight.target.source;
releaseAtlas(onLeft);
assert.equal(leftSheet.destroyed, true);
assert.equal(
  rightSheet.destroyed,
  false,
  "releasing one renderer's atlas took the other's",
);
releaseAtlas(onRight);
checks += 5;

/* Wrapping bounds the sheet's width, and nothing bounds its height, so a
   resolution high enough runs it off the end. A texture past what the GPU
   takes comes back blank rather than refused, so this has to say so. */
assert.throws(
  () => packAtlas(planAtlas(model, ATLAS_TEXEL_LIMIT)),
  /past the 2048 limit/,
);
checks += 1;

assert.ok(PIXI.ParticleContainer, "the renderer has no particle container");
checks += 1;

console.log(`beefwife atlas: ${checks} frame and packing checks passed`);
