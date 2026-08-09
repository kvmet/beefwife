/**
 * Does BeefwifeDescriptor.scale resize the pose trace and nothing else?
 * chevron-guy at 1x is the control: it drives thrust, legs, ornaments, and
 * plates at once. Fails if any chunk of the 2.5x body leaves 2.5x the
 * control's trace, if timing (gait phase, breathing rate) shifts with size,
 * or if ornament deflection depends on absolute px.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const BeefwifeDescriptor = require("../../beefwife/beefwife-descriptor.js");
const BeefwifeModel = require("../../beefwife/beefwife-model.js");
const { BeefwifeGait } = require("../../beefwife/beefwife-drive.js");
const { BeefwifeBody } = require("../../beefwife/beefwife-body.js");
const { BeefwifeLegs } = require("../../beefwife/beefwife-legs.js");
const { BeefwifeSkin } = require("../../beefwife/beefwife-skin.js");

const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "chevron-guy.json"),
    "utf8",
  ),
);
const K = 2.5;
let checks = 0;

const runtimeFor = (descriptor) => {
  const model = BeefwifeModel.compile(descriptor);
  const gait = new BeefwifeGait(model.gait, 0);
  const body = new BeefwifeBody(model, gait);
  body.place({ x: 0, y: 0 }, { x: 1, y: 0 });
  const legs = new BeefwifeLegs(model, body, gait, () => 0.5);
  const skin = new BeefwifeSkin(model, body, legs);
  return { model, gait, body, legs, skin };
};

const base = runtimeFor(source);
const scaled = runtimeFor(BeefwifeDescriptor.scale(source, K));

assert.equal(scaled.model.restLength, base.model.restLength * K);
assert.equal(
  scaled.model.breathing.cyclesPerSecond,
  base.model.breathing.cyclesPerSecond,
);
assert.equal(
  scaled.model.skin.lateralRate,
  base.model.skin.lateralRate * K,
);
checks += 3;

/* Identical steering and throttle sequences; a turn and a throttle drop keep
   thrust, steering, auto-lift, and contact all exercised. */
const step = (runtime, throttle, direction) => {
  runtime.body.step(1 / 60, throttle, direction, (seconds) => {
    runtime.legs.update(seconds, throttle);
    runtime.skin.update(seconds);
  });
};
let worstDrift = 0;
let worstAngle = 0;
for (let frame = 0; frame < 240; frame++) {
  const angle = Math.sin(frame / 30) * 0.8;
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const throttle = frame < 120 ? 1 : 0.4;
  step(base, throttle, direction);
  step(scaled, throttle, direction);
  base.body.chunks.forEach((chunk, index) => {
    const other = scaled.body.chunks[index];
    worstDrift = Math.max(
      worstDrift,
      Math.hypot(other.x - chunk.x * K, other.y - chunk.y * K),
    );
  });
  base.skin.ornaments.forEach((ornament, index) => {
    worstAngle = Math.max(
      worstAngle,
      Math.abs(scaled.skin.ornaments[index].angle - ornament.angle),
    );
  });
}
assert.equal(scaled.gait.phase, base.gait.phase);
assert.equal(scaled.body.breathingPhase, base.body.breathingPhase);
/* A missed px field would drift by whole pixels; these bounds only leave
   room for float noise from the k-scaled precomputes. */
assert.ok(worstDrift < 0.001 * K, `pose trace drift ${worstDrift}px`);
assert.ok(worstAngle < 1e-6, `ornament angle drift ${worstAngle}rad`);
checks += 4;

console.log(`beefwife scale: ${checks} covariance checks passed`);
