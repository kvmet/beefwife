/**
 * Does compilation own its input and resolve every schema-v1 boundary once?
 * The canonical example is the control. Fails on mutable output, incorrect
 * section/link invariants, unstable placement or draw order, or accepted bad
 * input.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const BeefwifeModel = require("../../beefwife/beefwife-model.js");

const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;

const model = BeefwifeModel.compile(source);
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
  model.descriptor.legs.swingCycles /
    model.descriptor.gait.cyclesPerSecond,
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
assert.equal(model.descriptor.name, "undulating");
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
const boundaryModel = BeefwifeModel.compile(boundaries);
assert.equal(boundaryModel.links[1].restLength, 15);
assert.equal(boundaryModel.links[17].restLength, 25);
assert.equal(boundaryModel.links[17].linkCorrection, 0.4);
checks += 3;

const breathing = copy(model.descriptor);
breathing.chain.breathing = 1;
const breathingModel = BeefwifeModel.compile(breathing);
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
  BeefwifeModel.compile(largerBreather).breathing.cyclesPerSecond <
    breathingModel.breathing.cyclesPerSecond,
);
const widerBreather = copy(breathing);
widerBreather.chain.sections.trunk.spacing *= 4;
assert.equal(
  BeefwifeModel.compile(widerBreather).breathing.cyclesPerSecond,
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
const singletonModel = BeefwifeModel.compile(singleton);
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
  BeefwifeModel.compile(tailward).skin.ornaments.map(({ chunk }) => chunk),
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
  BeefwifeModel.compile(chainTailward).skin.ornaments.map(({ chunk }) => chunk),
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
  BeefwifeModel.compile(overlapOrder).skin.ornaments.map(
    ({ id, side, layer }) => [id, side, layer],
  ),
  [
    ["eyes", "left", "over"],
    ["eyes", "right", "over"],
    ["under-eye", "left", "under"],
  ],
);
checks++;

const emptyTail = copy(model.descriptor);
emptyTail.chain.sections.tail.chunks = 0;
const emptyTailModel = BeefwifeModel.compile(emptyTail);
assert.equal(emptyTailModel.sections.tail.start, 18);
assert.equal(emptyTailModel.sections.tail.end, 18);
assert.equal(emptyTailModel.chunks.length, 18);
checks += 3;

const invalid = copy(model.descriptor);
invalid.chain.sections.trunk.material = "missing";
assert.throws(() => BeefwifeModel.compile(invalid), /references missing/);
checks++;

const castDir = path.join(__dirname, "..", "fixtures", "beefwives");
fs.readdirSync(castDir)
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .forEach((name) => {
    BeefwifeModel.compile(
      JSON.parse(fs.readFileSync(path.join(castDir, name), "utf8")),
    );
    checks++;
  });

const browser = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife-descriptor.js"),
    "utf8",
  ),
  browser,
);
vm.runInContext(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife-model.js"),
    "utf8",
  ),
  browser,
);
assert.equal(
  vm.runInContext(
    `BeefwifeModel.compile(${JSON.stringify(model.descriptor)}).chunks.length`,
    browser,
  ),
  27,
);
checks++;

console.log(`beefwife model: ${checks} contract checks passed`);
