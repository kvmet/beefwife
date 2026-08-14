/**
 * Does the bend a descriptor asks for arrive at the joint it names? Each joint
 * is driven by a sinusoid the gait states outright, so the turn it makes can
 * be correlated against that sinusoid directly: how much of it arrives, how
 * far behind it runs, and how much of the joint's motion is neither. A single
 * joint left alone reaches its target exactly; a chain of them used to cancel
 * each other down to a twentieth of that, so these are the numbers that catch
 * it. Fails if the solver rescales the wave, delays it, or buries it.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { compile } = require("../../beefwife/src/model.mjs");
const { Body } = require("../../beefwife/src/body.mjs");
const { Gait } = require("../../beefwife/src/drive.mjs");

let checks = 0;
const degrees = (radians) => (radians * 180) / Math.PI;
const fixture = (name) =>
  compile(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "..", "beefwife", "samples", `${name}.json`),
        "utf8",
      ),
    ),
  );
const turnAt = ({ x, y }, index) => {
  const ax = x[index] - x[index - 1];
  const ay = y[index] - y[index - 1];
  const bx = x[index + 1] - x[index];
  const by = y[index + 1] - y[index];
  return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
};

/* Correlating the turn against the command and against the same wave a
   quarter cycle later reads off the size and the delay together: the pair is
   the response as a vector, and whatever length is left once it is removed is
   motion the command does not account for. */
const respond = (model, seconds) => {
  const body = new Body(model, new Gait(model.gait, 0));
  body.place({ x: 0, y: 0 }, { x: 1, y: 0 });
  const count = model.chunks.length;
  const tables = body.tables;
  const square = new Float64Array(count);
  const together = new Float64Array(count);
  const behind = new Float64Array(count);
  const total = new Float64Array(count);
  let samples = 0;
  const sample = () => {
    const channel = model.gait.bend;
    const phase = channel.harmonic * body.gait.phase;
    const phaseSine = Math.sin(phase);
    const phaseCosine = Math.cos(phase);
    for (let index = 1; index < count - 1; index++) {
      const turn = turnAt(body.chain, index);
      const scale =
        channel.amplitude * tables.motionBend[index] * tables.bendScale[index];
      const command =
        scale *
        (phaseSine * tables.bendPhaseCosine[index] +
          phaseCosine * tables.bendPhaseSine[index]);
      const quarter =
        scale *
        (phaseSine * tables.bendPhaseSine[index] -
          phaseCosine * tables.bendPhaseCosine[index]);
      square[index] += command * command;
      together[index] += turn * command;
      behind[index] += turn * quarter;
      total[index] += turn * turn;
    }
    samples++;
  };
  /* Eight seconds of settling first, so a creature still unfolding from its
     placed pose is not measured mid-transient. */
  for (let tick = 0; tick < 60 * 8; tick++) body.step(1 / 60, 1, { x: 1, y: 0 });
  for (let tick = 0; tick < 60 * seconds; tick++)
    body.step(1 / 60, 1, { x: 1, y: 0 }, sample);

  const joints = [];
  for (let index = 1; index < count - 1; index++) {
    const driven = square[index] / samples;
    // A joint the gait never drives has no wave to be judged against.
    if (driven < 1e-12) continue;
    const along = together[index] / square[index];
    const across = behind[index] / square[index];
    joints.push({
      index,
      amplitude: Math.hypot(along, across),
      lag: degrees(Math.atan2(-across, along)),
      loose: Math.sqrt(
        Math.max(0, total[index] / samples - (along * along + across * across) * driven) /
          driven,
      ),
    });
  }
  return joints;
};

const summarise = (joints) => {
  let lag = 0;
  let gain = 0;
  let loose = 0;
  for (const joint of joints) {
    if (Math.abs(joint.lag) > Math.abs(lag)) lag = joint.lag;
    gain += joint.amplitude;
    loose = Math.max(loose, joint.loose);
  }
  return { lag, gain: gain / joints.length, loose, joints };
};

/* Ten seconds covers several cycles of every shipped gait, so a joint that
   drifts in and out of step is caught rather than sampled at its best. */
const undulating = summarise(respond(fixture("undulating"), 10));
assert.ok(undulating.joints.length > 20, "the fixture should drive most of its chain");
assert.ok(
  undulating.gain > 0.82,
  `joints turned ${undulating.gain.toFixed(2)} of what they were asked for`,
);
assert.ok(
  Math.abs(undulating.lag) < 40,
  `a joint ran ${undulating.lag.toFixed(0)} degrees behind its command`,
);
assert.ok(
  undulating.loose < 0.5,
  `a joint carried ${undulating.loose.toFixed(2)} of off-wave motion`,
);
checks += 4;

/* A short chain the solver can satisfy outright, so the response should be
   almost exactly what the descriptor wrote. */
const reticulating = summarise(respond(fixture("reticulating"), 10));
assert.ok(
  reticulating.gain > 0.95 && reticulating.gain < 1.05,
  `joints turned ${reticulating.gain.toFixed(2)} of what they were asked for`,
);
assert.ok(
  Math.abs(reticulating.lag) < 25,
  `a joint ran ${reticulating.lag.toFixed(0)} degrees behind its command`,
);
checks += 2;

/* Long chains used to lose the wave entirely and thrash instead, which shows
   up as motion no phase of the command explains. */
for (const name of ["long-girl", "slow-guy"]) {
  const chain = summarise(respond(fixture(name), 10));
  assert.ok(
    chain.loose < 2,
    `${name} carried ${chain.loose.toFixed(2)} of off-wave motion`,
  );
  checks++;
}

/* The correlation above can only see joints the gait drives. This drives the
   solver directly with a fixed smooth curve instead, which is the case a
   chain of angular constraints is worst at: neighbouring joints cancel, and a
   single sweep used to deliver a twentieth of it. */
const still = fixture("undulating");
const body = new Body(still, new Gait(still.gait, 0));
body.place({ x: 0, y: 0 }, { x: 1, y: 0 });
const count = still.chunks.length;
const wanted = new Float64Array(count);
for (let index = 1; index < count - 1; index++)
  wanted[index] = 0.3 * Math.sin(index * 0.5);
body._updateLinkTargets(1);
let heading = 0;
for (let index = 0; index < count - 1; index++) {
  heading += wanted[index];
  body.bend.wantedX[index + 1] =
    body.bend.wantedX[index] + Math.cos(heading) * body.linkTargets[index];
  body.bend.wantedY[index + 1] =
    body.bend.wantedY[index] + Math.sin(heading) * body.linkTargets[index];
}
for (let pass = 0; pass < 64; pass++) {
  body.bend.relax(body.chain, body.tables.jointCorrectionHalf);
  body._relaxLinks();
}
let reached = 0;
let driven = 0;
for (let index = 1; index < count - 1; index++) {
  if (Math.abs(wanted[index]) < 1e-9) continue;
  reached += turnAt(body.chain, index) / wanted[index];
  driven++;
}
reached /= driven;
assert.ok(
  reached > 0.85 && reached < 1.15,
  `a smooth commanded curve came out at ${reached.toFixed(3)} of itself`,
);
checks++;

console.log(`beefwife bend: ${checks} wave delivery checks passed`);
