/**
 * Does compilation own its input and resolve every schema-v1 boundary once?
 * The canonical example is the control. Fails on mutable output, incorrect
 * section/link invariants, unstable placement or draw order, or accepted bad
 * input.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Model = require("../../beefwife/src/model.mjs");

const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;

const model = Model.compile(source);
assert.equal(model.chunks.length, 27);
assert.deepEqual(
  Object.fromEntries(
    Object.entries(model.sections).map(([name, section]) => [
      name,
      [section.start, section.end],
    ]),
  ),
  { head: [0, 2], trunk: [2, 18], tail: [18, 27] },
);
assert.equal(model.restLength, 312);
assert.equal(model.skin.plates.length, 27);
assert.equal(model.links[0].phaseDistance, 6);
assert.deepEqual(
  [
    model.skin.platesTailFirst[0].chunk,
    model.skin.platesTailFirst.at(-1).chunk,
  ],
  [26, 0],
);
assert.deepEqual(
  model.skin.ornaments.map(({ chunk, side }) => [chunk, side]),
  [
    [1, "left"],
    [1, "right"],
  ],
);
assert.equal(model.skin.ribbonPaint, model.paints.ribbon);
assert.deepEqual(model.paints.ribbon, {
  fill: "#7a1414",
  stroke: null,
  strokeWidth: 0,
});
/* Every stroked paint in the example has a null stroke, so a width carried
   from the descriptor and a hard-coded zero are indistinguishable without
   one that is actually drawn. */
const strokedSource = copy(source);
strokedSource.definitions.paints.ribbon.stroke = {
  colour: "#0a0b0c",
  width: 7,
};
const strokedModel = Model.compile(strokedSource);
assert.deepEqual(strokedModel.paints.ribbon, {
  fill: "#7a1414",
  stroke: "#0a0b0c",
  strokeWidth: 7,
});
checks += 1;

/* Compiled per-chunk and per-link scales, and the three skin values the
   renderer reads. Each of these was replaceable by a constant. */
/* Bend is an angle, so a widely spaced chunk must swing further to trace the
   same curve: bendScale is that ratio against trunk spacing, and it is 1
   everywhere in a uniformly spaced creature like the example. */
const middle = Math.floor(model.chunks.length / 2);
assert.equal(model.chunks[middle].bendScale, 1);
const spread = copy(source);
spread.chain.sections.head.spacing = 24;
spread.chain.sections.head.chunks = 4;
const spreadModel = Model.compile(spread);
// Chunk 2 has a head link on both sides; chunk 3 straddles the seam.
assert.equal(spreadModel.chunks[2].bendScale, 2);
assert.ok(spreadModel.chunks[3].bendScale < 2);
assert.equal(spreadModel.chunks.at(-3).bendScale, 1);
/* A link gathers by what the chunks at its ends are willing to gather. */
const uneven = copy(source);
uneven.chain.sections.head.motionScale.gather = 0;
uneven.chain.sections.trunk.motionScale.gather = 1;
const unevenModel = Model.compile(uneven);
const seam = unevenModel.links.find(
  (link) =>
    unevenModel.chunks[link.from].section !==
    unevenModel.chunks[link.to].section,
);
assert.equal(
  seam.gatherScale,
  (unevenModel.chunks[seam.from].motionScale.gather +
    unevenModel.chunks[seam.to].motionScale.gather) /
    2,
);
assert.ok(seam.gatherScale > 0 && seam.gatherScale < 1);
assert.equal(model.skin.loadScale, source.chain.skin.loadScale);
assert.equal(
  model.legs.skin.foot.plantedScale,
  source.legs.skin.foot.plantedScale,
);
assert.equal(model.skin.hasRibbon, true);
const bald = copy(source);
for (const section of Object.values(bald.chain.sections))
  section.profile.ribbonWidth = { start: 0, end: 0 };
assert.equal(Model.compile(bald).skin.hasRibbon, false);
checks += 10;
assert.equal(
  model.skin.plates[0].shape,
  model.descriptor.definitions.shapes.headPlate,
);
assert.equal(model.skin.ornaments[0].paint, model.paints.eye);
assert.deepEqual(
  model.skin.ornaments.map(({ sideSign }) => sideSign),
  [-1, 1],
);
assert.ok(Math.abs(model.skin.ornaments[0].waveGain - 0.6) < 1e-12);
assert.ok(Math.abs(model.skin.ornaments[0].physGain - 0.4) < 1e-12);
assert.equal(model.skin.ornaments[0].recover, 30);
assert.equal(model.skin.ornaments[0].wobble, 0.85);
assert.ok(
  Math.abs(
    model.skin.ornaments[0].angleSine + model.skin.ornaments[1].angleSine,
  ) < 1e-12,
);
assert.equal(
  model.legs.skin.foot.shape,
  model.descriptor.definitions.shapes.foot,
);
assert.deepEqual([model.legs.start, model.legs.end], [2, 18]);
assert.equal(model.legs.jointLean, 0);
assert.equal(
  model.legs.spread,
  model.descriptor.legs.spread * model.descriptor.legs.reach,
);
assert.equal(
  model.legs.swingArc,
  model.descriptor.legs.swingArc * model.descriptor.legs.reach,
);
assert.equal(
  model.legs.swingSeconds,
  model.descriptor.legs.swingCycles / model.descriptor.gait.cyclesPerSecond,
);
assert.equal(model.breathing.strain, 0);
assert.ok(model.breathing.cyclesPerSecond >= 0.1);
assert.ok(model.breathing.cyclesPerSecond <= 0.4);
assert.equal(model.skin.lateralRate, 14 * model.sections.trunk.spacing);
const bendChannel = model.gait.bend;
assert.equal(bendChannel.phaseOffset, 0);
const bendChunk = model.chunks[10];
const bendAngle =
  bendChannel.phaseOffset -
  bendChannel.harmonic *
    bendChunk.restDistance *
    model.gait.phaseLagRadiansPerPixel;
assert.ok(Math.abs(bendChunk.bendPhaseSine - Math.sin(bendAngle)) < 1e-15);
const gatherChannel = model.gait.gather;
const gatherLink = model.links[10];
const gatherAngle =
  gatherChannel.phaseOffset -
  gatherChannel.harmonic *
    gatherLink.phaseDistance *
    model.gait.phaseLagRadiansPerPixel;
assert.ok(
  Math.abs(gatherLink.gatherPhaseCosine - Math.cos(gatherAngle)) < 1e-15,
);
checks += 27;

source.name = "caller mutation";
source.chain.sections.head.spacing = 99;
source.definitions.shapes.eye.path = "M 0 0";
source.chain.skin.ornaments[0].id = "changed";
assert.equal(model.descriptor.name, "beefwife");
assert.equal(model.sections.head.spacing, 12);
assert.notEqual(model.skin.ornaments[0].id, "changed");
assert.notEqual(model.skin.ornaments[0].shape.path, "M 0 0");
assert.ok(Object.isFrozen(model));
assert.ok(Object.isFrozen(model.descriptor));
assert.ok(Object.isFrozen(model.skin.ornaments[0].paint));
assert.throws(() => {
  model.chunks.push({});
}, TypeError);
const originalForward = model.skin.ornaments[0].offset.forward;
model.skin.ornaments[0].offset.forward = 99;
assert.equal(model.skin.ornaments[0].offset.forward, originalForward);
checks += 10;

const boundaries = copy(model.descriptor);
boundaries.chain.sections.head.spacing = 10;
boundaries.chain.sections.trunk.spacing = 20;
boundaries.chain.sections.tail.spacing = 30;
boundaries.definitions.materials.tail = {
  ...boundaries.definitions.materials.body,
  linkCorrection: 0.2,
};
boundaries.chain.sections.tail.material = "tail";
const boundaryModel = Model.compile(boundaries);
assert.equal(boundaryModel.links[1].restLength, 15);
assert.equal(boundaryModel.links[17].restLength, 25);
assert.equal(boundaryModel.links[17].linkCorrection, 0.4);
checks += 3;

const breathing = copy(model.descriptor);
breathing.chain.breathing = 1;
const breathingModel = Model.compile(breathing);
const breathingLinks = breathingModel.links.filter(
  (link) => link.breathingScale > 0,
);
assert.equal(breathingLinks.length, breathingModel.sections.trunk.count - 1);
assert.ok(breathingLinks.every((link) => link.breathingScale === 0.1));
assert.ok(
  breathingModel.links
    .filter((link) => link.breathingScale === 0)
    .every(
      (link) =>
        breathingModel.chunks[link.from].section !== "trunk" ||
        breathingModel.chunks[link.to].section !== "trunk",
    ),
);
const largerBreather = copy(breathing);
largerBreather.chain.sections.trunk.chunks *= 4;
assert.ok(
  Model.compile(largerBreather).breathing.cyclesPerSecond <
    breathingModel.breathing.cyclesPerSecond,
);
const widerBreather = copy(breathing);
widerBreather.chain.sections.trunk.spacing *= 4;
assert.equal(
  Model.compile(widerBreather).breathing.cyclesPerSecond,
  breathingModel.breathing.cyclesPerSecond,
);
checks += 5;

const singleton = copy(model.descriptor);
singleton.chain.sections.head.chunks = 1;
singleton.chain.sections.head.profile.ribbonWidth = { start: 2, end: 6 };
singleton.chain.sections.head.profile.plateScale = { start: 1, end: 3 };
singleton.chain.skin.plates[0].repeat.count = null;
singleton.chain.skin.plates[1].at.offset = 1;
singleton.chain.skin.ornaments[0].at.offset = 0;
const singletonModel = Model.compile(singleton);
assert.equal(singletonModel.chunks[0].ribbonWidth, 4);
assert.equal(singletonModel.chunks[0].plateScale, 2);
checks += 2;

const tailward = copy(model.descriptor);
tailward.chain.skin.ornaments[0].at = {
  section: "tail",
  from: "tail",
  offset: 0,
};
tailward.chain.skin.ornaments[0].repeat = { count: 3, step: 2 };
tailward.chain.skin.ornaments[0].side = "right";
assert.deepEqual(
  Model.compile(tailward).skin.ornaments.map(({ chunk }) => chunk),
  [26, 24, 22],
);
checks++;

const chainTailward = copy(model.descriptor);
chainTailward.chain.skin.ornaments[0].at = {
  section: null,
  from: "tail",
  offset: 1,
};
chainTailward.chain.skin.ornaments[0].repeat = { count: null, step: 5 };
chainTailward.chain.skin.ornaments[0].side = "left";
assert.deepEqual(
  Model.compile(chainTailward).skin.ornaments.map(({ chunk }) => chunk),
  [25, 20, 15, 10, 5, 0],
);
checks++;

const overlapOrder = copy(model.descriptor);
const under = copy(overlapOrder.chain.skin.ornaments[0]);
under.id = "under-eye";
under.layer = "under";
under.side = "left";
overlapOrder.chain.skin.ornaments.push(under);
assert.deepEqual(
  Model.compile(overlapOrder).skin.ornaments.map(({ id, side, layer }) => [
    id,
    side,
    layer,
  ]),
  [
    ["eyes", "left", "over"],
    ["eyes", "right", "over"],
    ["under-eye", "left", "under"],
  ],
);
checks++;

const emptyTail = copy(model.descriptor);
emptyTail.chain.sections.tail.chunks = 0;
const emptyTailModel = Model.compile(emptyTail);
assert.equal(emptyTailModel.sections.tail.start, 18);
assert.equal(emptyTailModel.sections.tail.end, 18);
assert.equal(emptyTailModel.chunks.length, 18);
checks += 3;

const invalid = copy(model.descriptor);
invalid.chain.sections.trunk.material = "missing";
assert.throws(() => Model.compile(invalid), /references missing/);
checks++;

const castDir = path.join(__dirname, "..", "fixtures", "beefwives");
fs.readdirSync(castDir)
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .forEach((name) => {
    Model.compile(
      JSON.parse(fs.readFileSync(path.join(castDir, name), "utf8")),
    );
    checks++;
  });

console.log(`beefwife model: ${checks} contract checks passed`);
