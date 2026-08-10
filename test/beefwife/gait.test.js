/**
 * Do schema-v1 harmonics, duty cycles, offsets, and throttle share one clock?
 * Hand-computable phases are controls. Fails if channel timing or bounds drift.
 */

const assert = require("node:assert/strict");
const { Gait } = require("../../beefwife/src/drive.mjs");

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
    amplitude: 0.8,
    harmonic: 1,
    phaseOffset: 0,
    dutyCycle: 0.5,
  },
};
let checks = 0;

const gait = new Gait(gaitSpec, Math.PI / 2);
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

/* A wavelength apart is the same value in either direction, so that check
   alone cannot see which way the wave travels. A positive lag must put the
   distant chunk behind the head: the value there is the one the head held
   earlier, so the wave runs head to tail and the creature swims forwards. */
const lagged = new Gait(gaitSpec, 0);
const quarterWave = TAU / 4 / gaitSpec.phaseLagRadiansPerPixel;
lagged.phase = 0;
const headNow = lagged.bendAt(0, 1, 1);
const downstreamNow = lagged.bendAt(quarterWave, 1, 1);
lagged.phase = -TAU / 4;
assert.ok(
  Math.abs(lagged.bendAt(0, 1, 1) - downstreamNow) < 1e-12,
  "the travelling wave runs tail to head",
);
assert.ok(Math.abs(headNow - downstreamNow) > 0.1, "the lag had no effect");
checks += 2;

console.log(`beefwife gait: ${checks} channel checks passed`);
