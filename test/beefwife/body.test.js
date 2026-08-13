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
const { Beefwife } = require("../../beefwife/src/beefwife.mjs");
const Model = require("../../beefwife/src/model.mjs");
const { Gait } = require("../../beefwife/src/drive.mjs");
const { Body, MAX_LINK_STRETCH } = require("../../beefwife/src/body.mjs");

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

const model = Model.compile(source);
const gait = new Gait(model.gait);
const body = new Body(model, gait);
body.place({ x: 0, y: 0 }, { x: 1, y: 0 });
const start = poseOf(body);
let maximumLinkError = 0;

const runBody = (frames, direction, throttle = 1) => {
  for (let frame = 0; frame < frames; frame++) {
    body.step(1 / 60, throttle, direction);
    model.links.forEach((link) => {
      const { x, y } = body.chain;
      const actual = Math.hypot(
        x[link.to] - x[link.from],
        y[link.to] - y[link.from],
      );
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
assert.ok(Math.max(...body.chain.idle) < 1e-6);
checks++;

const selectionGait = new Gait(model.gait);
const selectionBody = new Body(model, selectionGait);
selectionBody.place({ x: 0, y: 0 }, { x: 1, y: 0 });
selectionBody.refreshContacts(0.75);
selectionBody.chain.gain.forEach((_, index) => {
  selectionBody.chain.gain[index] = (index % 7) - 3;
});
const lifted = Math.round(
  model.physics.autoLift.share * selectionBody.chain.count,
);
const expectedLifted = Array.from(selectionBody.chain.gain)
  .map((gain, index) => ({ gain, index }))
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
selectionBody.chain.contact.forEach((contact, index) => {
  assert.ok(
    Math.abs(
      contact -
        Math.max(
          0,
          Math.min(
            1,
            selectionBody.chain.gaitContact[index] *
              (1 -
                model.physics.autoLift.amount *
                  selectionBody.chain.idle[index] *
                  0.75),
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
const breathingModel = Model.compile(breathingSource);
const offsetBreath = new Body(
  breathingModel,
  new Gait(breathingModel.gait),
  Math.PI / 2,
);
offsetBreath.place({ x: 0, y: 0 }, { x: 1, y: 0 });
assert.equal(offsetBreath.breathingPhase, Math.PI / 2);
const restingBreath = new Body(breathingModel, new Gait(breathingModel.gait));
const movingBreath = new Body(breathingModel, new Gait(breathingModel.gait));
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
const quieterModel = Model.compile(quieterBreathing);
restingBreath.reconfigure(
  quieterModel,
  new Gait(quieterModel.gait, restingBreath.gait.phase),
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

/* Bend displaces chunks and a soft link pulls back only a `linkCorrection`
   share, so every material pairing has to stay bounded. Without the stretch
   ceiling the whole lower half of this range reaches NaN within seconds.
   A creature must never draw as more than three times its own length: that is
   the requirement `MAX_LINK_STRETCH` serves, so it is stated here as a number
   rather than read from the constant, which would pass at any ceiling. */
const MAX_DRAWN_LENGTH = 3;
let worstStretch = 0;
let ceilingReached = 0;
for (const linkCorrection of [0.001, 0.05, 0.2, 0.5, 1])
  for (const jointCorrection of [0, 0.5, 1]) {
    const material = copy(source);
    material.definitions.materials.body.linkCorrection = linkCorrection;
    material.definitions.materials.body.jointCorrection = jointCorrection;
    const model = Model.compile(material);
    const gait = new Gait(model.gait, 0);
    const loose = new Body(model, gait);
    loose.place({ x: 0, y: 0 }, { x: 1, y: 0 });
    for (let frame = 0; frame < 20 * 60; frame++)
      loose.step(
        1 / 60,
        1,
        { x: Math.cos(frame / 300), y: Math.sin(frame / 300) },
        () => {},
      );
    const label = `linkCorrection ${linkCorrection}, jointCorrection ${jointCorrection}`;
    let arc = 0;
    let rest = 0;
    for (let index = 0; index < model.links.length; index++) {
      const link = model.links[index];
      const { x, y } = loose.chain;
      const span = Math.hypot(
        x[link.to] - x[link.from],
        y[link.to] - y[link.from],
      );
      assert.ok(Number.isFinite(span), `${label} reached a non-finite pose`);
      const stretch = span / loose.linkTargets[index];
      if (stretch > worstStretch) worstStretch = stretch;
      if (stretch > MAX_LINK_STRETCH * 0.999) ceilingReached++;
      arc += span;
      rest += loose.linkTargets[index];
    }
    assert.ok(
      arc < rest * MAX_DRAWN_LENGTH,
      `${label} drew ${(arc / rest).toFixed(2)} times its own length`,
    );
    checks++;
  }
/* No link may pass the ceiling, and the softest materials must reach it, or
   the clamp is dead code and this whole sweep proves nothing. */
assert.ok(
  worstStretch <= MAX_LINK_STRETCH * (1 + 1e-9),
  `a link stretched to ${worstStretch}`,
);
assert.ok(ceilingReached > 0, "no link ever reached the ceiling");
checks += 2;

/* Growing a section seeds the chunks the old chain never had. A middle
   section interpolates between its surviving neighbours; growing past the tail
   extrapolates along the chain's own direction. Both are silent when wrong:
   the creature simply settles from the wrong place, so check the seeded pose
   directly rather than the pose it converges to. */
const grown = (edit) => {
  const before = copy(source);
  before.chain.sections.head.chunks = 2;
  before.chain.sections.trunk.chunks = 6;
  before.chain.sections.tail.chunks = 3;
  const model = Model.compile(before);
  const gait = new Gait(model.gait, 0);
  const settled = new Body(model, gait);
  settled.place({ x: 0, y: 0 }, { x: 1, y: 0 });
  for (let frame = 0; frame < 120; frame++)
    settled.step(1 / 60, 1, { x: 1, y: 0 }, () => {});
  const after = copy(before);
  edit(after);
  const nextModel = Model.compile(after);
  const next = new Body(nextModel, new Gait(nextModel.gait, 0));
  next.adopt(settled);
  return { settled, next, model, nextModel };
};

const midGrown = grown((d) => (d.chain.sections.trunk.chunks = 8));
/* trunk:6 and tail:0.. survive, so the two added trunk chunks sit between
   trunk:5 and the first tail chunk and must land on the segment joining them. */
const seededMiddle = midGrown.nextModel.chunks
  .map((spec, index) => ({ spec, index }))
  .filter(({ spec }) => spec.section === "trunk" && spec.localIndex >= 6);
assert.equal(seededMiddle.length, 2);
for (const { index } of seededMiddle) {
  const chain = midGrown.next.chain;
  const at = (which) => ({ x: chain.x[which], y: chain.y[which] });
  const chunk = at(index);
  const start = at(index - 1);
  const end = at(seededMiddle.at(-1).index + 1);
  const along = Math.hypot(chunk.x - start.x, chunk.y - start.y);
  const span = Math.hypot(end.x - start.x, end.y - start.y);
  const off =
    Math.abs(
      (end.x - start.x) * (start.y - chunk.y) -
        (start.x - chunk.x) * (end.y - start.y),
    ) / span;
  assert.ok(off < 1e-9, `seeded chunk sits ${off}px off the segment`);
  assert.ok(along > 0 && along < span, "seeded chunk is outside the gap");
  // An interpolated chunk inherits the motion around it, never a dead stop.
  assert.ok(
    Math.hypot(chunk.x - chain.px[index], chunk.y - chain.py[index]) > 1e-9,
    "seeded chunk was given no velocity",
  );
  checks += 3;
}

const tailGrown = grown((d) => (d.chain.sections.tail.chunks = 5));
const tailChain = tailGrown.next.chain;
const lastOld = tailGrown.model.chunks.length - 1;
const headward = {
  x: tailChain.x[lastOld - 1] - tailChain.x[lastOld],
  y: tailChain.y[lastOld - 1] - tailChain.y[lastOld],
};
for (
  let index = tailGrown.model.chunks.length;
  index < tailGrown.nextModel.chunks.length;
  index++
) {
  const away = {
    x: tailChain.x[index] - tailChain.x[lastOld],
    y: tailChain.y[index] - tailChain.y[lastOld],
  };
  assert.ok(
    away.x * headward.x + away.y * headward.y < 0,
    "a chunk added past the tail was placed on the head side",
  );
  assert.equal(tailChain.px[index], tailChain.x[index]);
  assert.equal(tailChain.py[index], tailChain.y[index]);
  checks += 3;
}

/* selectLowest is a hand-rolled quickselect whose comparator breaks ties on
   index; ties are where a partition goes wrong, so the gains are randomized
   over a spread narrow enough to force them and every lift share is tried. */
let selectionSeed = 20260810;
const nextSample = () => {
  selectionSeed = (selectionSeed * 1103515245 + 12345) % 2147483648;
  return selectionSeed / 2147483648;
};
for (const share of [0, 0.1, 0.33, 0.5, 0.9, 1]) {
  const shared = copy(source);
  shared.chain.physics.autoLift.share = share;
  const shareModel = Model.compile(shared);
  const selection = new Body(shareModel, new Gait(shareModel.gait));
  selection.place({ x: 0, y: 0 }, { x: 1, y: 0 });
  selection.refreshContacts(0.75);
  const lifted = Math.round(share * selection.chain.count);
  for (let trial = 0; trial < 40; trial++) {
    const spread = 1 + Math.floor(nextSample() * 8);
    selection.chain.gain.forEach((_, index) => {
      selection.chain.gain[index] =
        Math.floor(nextSample() * spread) - spread / 2;
    });
    const expected = Array.from(selection.chain.gain)
      .map((gain, index) => ({ gain, index }))
      .sort(
        (before, after) =>
          before.gain - after.gain || before.index - after.index,
      )
      .slice(0, lifted)
      .map(({ index }) => index)
      .sort((before, after) => before - after);
    selection._applyAutoLift(1 / 120, 0.75);
    const actual = Array.from(selection.liftTargets)
      .flatMap((target, index) => (target ? [index] : []))
      .sort((before, after) => before - after);
    assert.deepEqual(actual, expected, `share ${share}, spread ${spread}`);
  }
  checks++;
}

console.log(
  `beefwife body: ${checks} motion checks passed, ${(maximumLinkError * 100).toFixed(1)}% maximum link error`,
);
