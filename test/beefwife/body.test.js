/**
 * Does schema-v1 body motion depend on gait, steering, and material response?
 * Zero motion scales and zero velocity retention are controls. Fails if the
 * tuned body is inert, cannot turn, stretches links over 20%, stays lifted, or
 * breathing depends on throttle, ignores its starting phase, varies across the
 * trunk, or drives travel.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Beefwife = require("../../beefwife/beefwife.js");
const BeefwifeModel = require("../../beefwife/beefwife-model.js");
const { BeefwifeGait } = require("../../beefwife/beefwife-drive.js");
const { BeefwifeBody } = require("../../beefwife/beefwife-body.js");

const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
const poseOf = (body) =>
  body.getPose({
    head: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    direction: { x: 0, y: 0 },
  });
const distance = (before, after) =>
  Math.hypot(after.x - before.x, after.y - before.y);
let checks = 0;

const model = BeefwifeModel.compile(source);
const gait = new BeefwifeGait(model.gait);
const body = new BeefwifeBody(model, gait);
body.place({ x: 0, y: 0 }, { x: 1, y: 0 });
const start = poseOf(body);
let maximumLinkError = 0;

const runBody = (frames, direction, throttle = 1) => {
  for (let frame = 0; frame < frames; frame++) {
    body.step(1 / 60, throttle, direction);
    model.links.forEach((link) => {
      const before = body.chunks[link.from];
      const after = body.chunks[link.to];
      const actual = Math.hypot(after.x - before.x, after.y - before.y);
      const phaseDistance =
        (model.chunks[link.from].restDistance +
          model.chunks[link.to].restDistance) /
        2;
      const wanted =
        link.restLength *
        gait.restAt(phaseDistance, throttle, link.gatherScale);
      maximumLinkError = Math.max(
        maximumLinkError,
        Math.abs(actual - wanted) / wanted,
      );
    });
  }
};

runBody(600, { x: 1, y: 0 });
const straight = poseOf(body);
assert.ok(straight.center.x - start.center.x > 300);
assert.ok(Math.abs(straight.center.y - start.center.y) < 50);
runBody(600, { x: 0, y: 1 });
const turned = poseOf(body);
assert.ok(turned.center.y - straight.center.y > 300);
assert.ok(maximumLinkError < 0.2);
checks += 4;

runBody(600, { x: 0, y: 1 }, 0);
assert.ok(Math.max(...body.chunks.map((chunk) => chunk.idle)) < 1e-6);
checks++;

const selectionGait = new BeefwifeGait(model.gait);
const selectionBody = new BeefwifeBody(model, selectionGait);
selectionBody.place({ x: 0, y: 0 }, { x: 1, y: 0 });
selectionBody.refreshContacts(0.75);
selectionBody.chunks.forEach((chunk, index) => {
  chunk.gain = (index % 7) - 3;
});
const lifted = Math.round(
  model.physics.autoLift.share * selectionBody.chunks.length,
);
const expectedLifted = selectionBody.chunks
  .map((chunk, index) => ({ gain: chunk.gain, index }))
  .sort(
    (before, after) => before.gain - after.gain || before.index - after.index,
  )
  .slice(0, lifted)
  .map(({ index }) => index)
  .sort((before, after) => before - after);
selectionBody._applyAutoLift(1 / 120, 0.75);
const actualLifted = Array.from(selectionBody.liftTargets)
  .flatMap((target, index) => (target ? [index] : []))
  .sort((before, after) => before - after);
assert.deepEqual(actualLifted, expectedLifted);
selectionBody.chunks.forEach((chunk) => {
  assert.ok(
    Math.abs(
      chunk.contact -
        Math.max(
          0,
          Math.min(
            1,
            chunk.gaitContact *
              (1 - model.physics.autoLift.amount * chunk.idle * 0.75),
          ),
        ),
    ) < 1e-15,
  );
});
checks += 2;

const withoutMotion = copy(source);
["head", "trunk", "tail"].forEach((section) => {
  ["bend", "thrust", "gather", "contact"].forEach((channel) => {
    withoutMotion.chain.sections[section].motionScale[channel] = 0;
  });
});

const breathingSource = copy(withoutMotion);
breathingSource.chain.breathing = 1;
const breathingModel = BeefwifeModel.compile(breathingSource);
const offsetBreath = new BeefwifeBody(
  breathingModel,
  new BeefwifeGait(breathingModel.gait),
  Math.PI / 2,
);
offsetBreath.place({ x: 0, y: 0 }, { x: 1, y: 0 });
assert.equal(offsetBreath.breathingPhase, Math.PI / 2);
const restingBreath = new BeefwifeBody(
  breathingModel,
  new BeefwifeGait(breathingModel.gait),
);
const movingBreath = new BeefwifeBody(
  breathingModel,
  new BeefwifeGait(breathingModel.gait),
);
for (const breathingBody of [restingBreath, movingBreath])
  breathingBody.place({ x: 0, y: 0 }, { x: 1, y: 0 });
const breathingStart = poseOf(restingBreath);
for (let frame = 0; frame < 60; frame++) {
  restingBreath.step(1 / 60, 0, { x: 1, y: 0 });
  movingBreath.step(1 / 60, 1, { x: 1, y: 0 });
}
assert.ok(
  Math.abs(restingBreath.breathingPhase - movingBreath.breathingPhase) < 1e-12,
);
assert.deepEqual(restingBreath.linkTargets, movingBreath.linkTargets);
const breathingStrains = breathingModel.links
  .map((link, index) =>
    link.breathingScale
      ? restingBreath.linkTargets[index] / link.restLength - 1
      : null,
  )
  .filter((strain) => strain !== null);
assert.ok(
  Math.max(...breathingStrains) - Math.min(...breathingStrains) < 1e-12,
);
assert.ok(Math.max(...breathingStrains.map(Math.abs)) <= 0.1);
breathingModel.links.forEach((link, index) => {
  if (!link.breathingScale)
    assert.ok(
      Math.abs(restingBreath.linkTargets[index] - link.restLength) < 1e-12,
    );
});
for (let frame = 60; frame < 600; frame++)
  restingBreath.step(1 / 60, 0, { x: 1, y: 0 });
const breathingDrift = distance(
  breathingStart.center,
  poseOf(restingBreath).center,
);
assert.ok(breathingDrift < 0.1, `breathing drifted ${breathingDrift}px`);
const breathingPhase = restingBreath.breathingPhase;
const quieterBreathing = copy(breathingSource);
quieterBreathing.chain.breathing = 0.5;
const quieterModel = BeefwifeModel.compile(quieterBreathing);
restingBreath.reconfigure(
  quieterModel,
  new BeefwifeGait(quieterModel.gait, restingBreath.gait.phase),
  0,
);
assert.equal(restingBreath.breathingPhase, breathingPhase);
checks += 8;

const still = new Beefwife(withoutMotion);
const stillStart = { ...still.getPose().center };
for (let frame = 0; frame < 600; frame++) still.step(1 / 60);
assert.ok(distance(stillStart, still.getPose().center) < 1e-9);
checks++;

const withoutRetention = copy(source);
withoutRetention.definitions.materials.body.velocityRetention = 0;
const damped = new Beefwife(withoutRetention);
const dampedStart = { ...damped.getPose().center };
for (let frame = 0; frame < 300; frame++) damped.step(1 / 60);
const dampedTravel = distance(dampedStart, damped.getPose().center);
const tuned = new Beefwife(source);
const tunedStart = { ...tuned.getPose().center };
for (let frame = 0; frame < 300; frame++) tuned.step(1 / 60);
const tunedTravel = distance(tunedStart, tuned.getPose().center);
assert.ok(tunedTravel > 100);
assert.ok(dampedTravel < tunedTravel * 0.1);
checks += 2;

console.log(
  `beefwife body: ${checks} motion checks passed, ${(maximumLinkError * 100).toFixed(1)}% maximum link error`,
);
