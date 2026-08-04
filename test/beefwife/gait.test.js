/**
 * Do schema-v1 harmonics, duty cycles, offsets, and throttle share one clock?
 * Hand-computable phases are controls. Fails if channel timing or bounds drift.
 */

const assert = require("node:assert/strict");
const { BeefwifeGait } = require("../../beefwife/beefwife-drive.js");

const TAU = Math.PI * 2;
const gaitSpec = {
  cyclesPerSecond: 2,
  phaseLagRadiansPerPixel: 0.1,
  bend: { amplitude: 2, harmonic: 1, phaseOffset: 0 },
  thrust: {
    acceleration: 100,
    harmonic: 2,
    phaseOffset: 0,
    dutyCycle: 0.25,
  },
  gather: { amplitude: 0.2, harmonic: 2, phaseOffset: Math.PI },
  contact: {
    lift: 0.8,
    harmonic: 1,
    phaseOffset: 0,
    dutyCycle: 0.5,
  },
};
let checks = 0;

const gait = new BeefwifeGait(gaitSpec, Math.PI / 2);
assert.ok(Math.abs(gait.bendAt(0, 0.5, 0.25) - 0.25) < 1e-12);
assert.ok(Math.abs(gait.restAt(0, 1, 0.5) - 1.1) < 1e-12);
assert.ok(Math.abs(gait.contactAt(0, 1, 1) - 0.2) < 1e-12);
checks += 3;

gait.phase = Math.PI / 8;
assert.ok(Math.abs(gait.thrustAt(0, 1, 1) - 100) < 1e-12);
gait.phase = Math.PI / 4;
assert.equal(gait.thrustAt(0, 1, 1), 0);
checks += 2;

gait.phase = 0;
gait.advance(0.25, 0.5);
assert.ok(Math.abs(gait.phase - Math.PI / 2) < 1e-12);
gait.advance(1, 0);
assert.ok(Math.abs(gait.phase - Math.PI / 2) < 1e-12);
checks += 2;

gait.phase = 0.1;
const here = gait.bendAt(0, 1, 1);
const wavelengthAway = gait.bendAt(TAU / 0.1, 1, 1);
assert.ok(Math.abs(here - wavelengthAway) < 1e-12);
checks++;

console.log(`beefwife gait: ${checks} channel checks passed`);
