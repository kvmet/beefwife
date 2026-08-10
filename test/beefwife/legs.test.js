/**
 * Are schema-v1 legs deterministic, section-bound, alternating, and stateful?
 * Zero jitter and equal seeds are controls. Fails on bad anchors, random leaks,
 * asymmetric pairs, frame dependence, or descriptor-update ownership mistakes.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Beefwife } = require("../../beefwife/src/beefwife.mjs");
const BeefwifeModel = require("../../beefwife/src/model.mjs");
const { Gait: BeefwifeGait } = require("../../beefwife/src/drive.mjs");
const { Body: BeefwifeBody } = require("../../beefwife/src/body.mjs");
const { Legs: BeefwifeLegs } = require("../../beefwife/src/legs.mjs");

const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "long-girl.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const build = (descriptor, random = seeded(1)) => {
  const model = BeefwifeModel.compile(descriptor);
  const gait = new BeefwifeGait(model.gait);
  const body = new BeefwifeBody(model, gait);
  body.place({ x: 0, y: 0 }, { x: 1, y: 0 });
  const legs = new BeefwifeLegs(model, body, gait, random);
  return { model, gait, body, legs };
};
let checks = 0;

const first = build(source, seeded(42));
const second = build(source, seeded(42));
assert.deepEqual(first.legs.legs, second.legs.legs);
const leftAnchors = first.legs.legs
  .filter((leg) => leg.side === "left")
  .map((leg) => leg.anchor);
assert.equal(leftAnchors.length, source.legs.pairs);
assert.equal(leftAnchors[0], first.model.legs.start);
assert.equal(leftAnchors.at(-1), first.model.legs.end - 1);
assert.ok(
  leftAnchors.every(
    (anchor, index) => !index || anchor > leftAnchors[index - 1],
  ),
);
checks += 5;

const exact = copy(source);
exact.legs.pairs = 1;
exact.legs.jitter = 0;
const paired = build(exact, seeded(7));
const [left, right] = paired.legs.legs;
const firstDistance = paired.model.chunks[paired.model.legs.start].restDistance;
const lastDistance =
  paired.model.chunks[paired.model.legs.end - 1].restDistance;
const midpoint = (firstDistance + lastDistance) / 2;
assert.equal(left.anchor, right.anchor);
assert.ok(
  Math.abs(paired.model.chunks[left.anchor].restDistance - midpoint) <=
    exact.chain.sections.trunk.spacing / 2,
);
const hip = paired.body.chunks[left.anchor];
assert.ok(Math.abs(left.foot.x - right.foot.x) < 1e-12);
assert.ok(Math.abs(left.foot.y + right.foot.y - hip.y * 2) < 1e-12);
checks += 4;

const crowded = copy(exact);
crowded.legs.pairs = crowded.chain.sections.trunk.chunks + 4;
const crowdedAnchors = build(crowded, seeded(3))
  .legs.legs.filter((leg) => leg.side === "left")
  .map((leg) => leg.anchor);
assert.equal(crowdedAnchors.length, crowded.legs.pairs);
assert.ok(
  crowdedAnchors.some(
    (anchor, index) => index > 0 && anchor === crowdedAnchors[index - 1],
  ),
);
assert.ok(
  crowdedAnchors.every(
    (anchor, index) => !index || anchor >= crowdedAnchors[index - 1],
  ),
);
checks += 3;

const emptyTail = copy(source);
emptyTail.chain.sections.tail.chunks = 0;
emptyTail.legs.section = "tail";
emptyTail.legs.pairs = 0;
const leglessTail = build(emptyTail, seeded(4));
assert.equal(leglessTail.model.legs.start, leglessTail.model.legs.end);
assert.equal(leglessTail.legs.legs.length, 0);
checks += 2;

const tiny = copy(exact);
tiny.legs.reach = 0.000001;
tiny.legs.spread = 0;
tiny.legs.jitter = 1;
const tinyLegs = build(tiny, () => 0.999999).legs.legs;
assert.ok(
  tinyLegs.every(
    (leg) => Math.hypot(leg.scatter.x, leg.scatter.y) < 0.00000015,
  ),
);
checks++;

const alternating = copy(exact);
alternating.gait.contact = {
  amplitude: 1,
  harmonic: 1,
  phaseOffset: 0,
  dutyCycle: 0.5,
};
alternating.legs.sidePhase = 1;
const phased = build(alternating, () => 0.5);
const [phasedLeft, phasedRight] = phased.legs.legs;
phased.gait.phase =
  phased.model.chunks[phasedLeft.anchor].restDistance *
    phased.model.gait.phaseLagRadiansPerPixel +
  Math.PI / 2;
assert.ok(phased.legs.contactFor(phasedLeft, 1) < 1e-12);
assert.ok(phased.legs.contactFor(phasedRight, 1) > 1 - 1e-12);
phased.legs.update(1 / 120, 1);
assert.equal(phasedLeft.progress, 0);
assert.equal(phasedRight.progress, 1);
checks += 4;

const retrigger = copy(alternating);
retrigger.legs.reach = 1;
retrigger.legs.spread = 0;
retrigger.legs.lead = 1;
retrigger.legs.jitter = 1;
retrigger.legs.swingCycles = 0.001;
const hostileSamples = [0.5, 0, 0.5, 0.999999, 0.5, 0.5, 0.999999, 0.5];
let hostileAt = 0;
const hostile = build(
  retrigger,
  () => hostileSamples[hostileAt++ % hostileSamples.length],
);
const hostileLeft = hostile.legs.legs[0];
hostile.gait.phase =
  hostile.model.chunks[hostileLeft.anchor].restDistance *
    hostile.model.gait.phaseLagRadiansPerPixel +
  Math.PI / 2;
hostile.legs.update(1 / 120, 1);
assert.equal(hostileLeft.progress, 0);
hostile.legs.update(1 / 120, 1);
assert.equal(hostileLeft.progress, 1);
for (let step = 0; step < 8; step++) hostile.legs.update(1 / 120, 1);
assert.equal(hostileLeft.progress, 1);
checks += 3;

const beforeTranslate = phased.legs.legs.map((leg) => ({ ...leg.foot }));
phased.legs.translate({ x: 7, y: -3 });
phased.legs.legs.forEach((leg, index) => {
  assert.equal(leg.foot.x, beforeTranslate[index].x + 7);
  assert.equal(leg.foot.y, beforeTranslate[index].y - 3);
  checks += 2;
});

const runFrames = (frameSeconds, frames) => {
  const runtime = build(source, seeded(99));
  for (let frame = 0; frame < frames; frame++)
    runtime.body.step(frameSeconds, 1, { x: 1, y: 0 }, (seconds) =>
      runtime.legs.update(seconds, 1),
    );
  return runtime.legs.legs;
};
assert.deepEqual(runFrames(1 / 60, 60), runFrames(1 / 120, 120));
checks++;

/* The body hands legs a fixed substep, so equal frame counts above prove only
   that the body divides time. Drive `update` directly to see whether a swing
   advances on the seconds it is given or on the number of calls. */
const walked = () => {
  const runtime = build(source, seeded(7));
  for (let frame = 0; frame < 90; frame++)
    runtime.body.step(1 / 60, 1, { x: 1, y: 0 }, (seconds) =>
      runtime.legs.update(seconds, 1),
    );
  return runtime;
};
const swungWhole = walked();
const swungHalves = walked();
swungWhole.legs.update(1 / 60, 1);
swungHalves.legs.update(1 / 120, 1);
swungHalves.legs.update(1 / 120, 1);
const midSwing = swungWhole.legs.legs.filter(
  (leg, index) => leg.progress < 1 && swungHalves.legs.legs[index].progress < 1,
);
assert.ok(midSwing.length > 0, "no leg was mid-swing, so nothing advanced");
swungWhole.legs.legs.forEach((leg, index) => {
  // Two halves accumulate one rounding step more than one whole.
  assert.ok(
    Math.abs(leg.progress - swungHalves.legs.legs[index].progress) < 1e-12,
    `leg ${index} advanced on calls, not seconds`,
  );
});
checks += 2;

assert.throws(() => new Beefwife(source, { random: () => 1 }), /from 0 to 1/);
assert.throws(() => new Beefwife(source, { random: () => NaN }), /finite/);
checks += 2;

let randomCalls = 0;
const live = new Beefwife(source, {
  random: () => {
    randomCalls++;
    return 0.5;
  },
});
const afterBuild = randomCalls;
const recolored = copy(source);
recolored.definitions.paints.shell.fill = "#123456";
live.setDescriptor(recolored);
assert.equal(randomCalls, afterBuild);
const leaning = copy(recolored);
leaning.legs.jointLean = 0.25;
live.setDescriptor(leaning);
assert.equal(randomCalls, afterBuild);
/* Moving the leg section has to move the hips onto it. Counting random draws
   proves only that no pair was rebuilt, not that the survivors were re-aimed,
   so check where the anchors actually point. */
const anchored = build(source, seeded(3));
const trunkAnchors = anchored.legs.legs.map((leg) => leg.anchor);
const toTail = copy(source);
toTail.legs.section = "tail";
const tailModel = BeefwifeModel.compile(toTail);
anchored.legs.reconfigure(tailModel, anchored.body, anchored.gait);
const tailAnchors = anchored.legs.legs.map((leg) => leg.anchor);
assert.notDeepEqual(tailAnchors, trunkAnchors);
assert.ok(
  tailAnchors.every((anchor) => tailModel.chunks[anchor].section === "tail"),
  "a leg still hangs off the old section",
);
checks += 2;

/* Stance is read from the model every step, so editing it re-anchors the
   existing pairs rather than sampling a new set of proportions. */
const changedStance = copy(leaning);
changedStance.legs.lead += 0.01;
changedStance.legs.reach += 3;
changedStance.legs.section = "tail";
live.setDescriptor(changedStance);
assert.equal(randomCalls, afterBuild);
const changedCount = copy(changedStance);
changedCount.legs.pairs += 1;
live.setDescriptor(changedCount);
assert.ok(randomCalls > afterBuild);
const afterLegEdit = randomCalls;
live.reset();
assert.ok(randomCalls > afterLegEdit);
checks += 4;

console.log(`beefwife legs: ${checks} gait and ownership checks passed`);
