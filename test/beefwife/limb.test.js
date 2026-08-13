/**
 * Does a limb outline stay on the limb however far the knee folds? The bend
 * angle is swept both ways, because the armpit vertex is the one that can run
 * off the end of a bone, and it reaches for a different side each way. Fails
 * if any vertex leaves the leg's own reach, if the two bend directions do not
 * mirror each other, or if a vertex is not finite.
 */

const assert = require("node:assert/strict");

const { LIMB_FLOATS, writeLimb } = require("../../beefwife/src/geometry.mjs");

let checks = 0;
const BONE = 30;
const WIDTH = 9.4;
const HALF = WIDTH / 2;
/* A vertex belongs to a leg of two bones and a half width of padding. Past
   that it is over open ground, which is what a spike looks like. */
const REACH = BONE + HALF;

const positions = new Float32Array(LIMB_FLOATS);
const outlineAt = (degrees) => {
  const turn = (degrees * Math.PI) / 180;
  writeLimb(
    positions,
    0,
    -BONE,
    0,
    0,
    0,
    BONE * Math.cos(turn),
    BONE * Math.sin(turn),
    WIDTH,
    0,
    0,
  );
  let furthest = 0;
  for (let index = 0; index < LIMB_FLOATS; index += 2)
    furthest = Math.max(
      furthest,
      Math.hypot(positions[index], positions[index + 1]),
    );
  return { furthest, vertices: Array.from(positions) };
};

/* Every whole degree, so a fold that only misbehaves near the fully closed end
   cannot sit between two samples. */
for (let degrees = -179; degrees <= 179; degrees++) {
  const { furthest, vertices } = outlineAt(degrees);
  assert.ok(
    vertices.every(Number.isFinite),
    `a ${degrees} degree bend produced a non-finite vertex`,
  );
  assert.ok(
    furthest <= REACH + 1e-6,
    `a ${degrees} degree bend put a vertex ${furthest.toFixed(2)} from the knee, past the leg's ${REACH} reach`,
  );
}
checks += 2;

/* The armpit leans back along the thigh by the same amount whichever way the
   knee folds, so one direction clamping and the other not shows up here as a
   pair that no longer mirror. */
for (let degrees = 1; degrees <= 179; degrees++) {
  const opened = outlineAt(degrees).furthest;
  const folded = outlineAt(-degrees).furthest;
  assert.ok(
    Math.abs(opened - folded) < 1e-4,
    `a ${degrees} degree bend reached ${opened.toFixed(2)} one way and ${folded.toFixed(2)} the other`,
  );
}
checks += 1;

/* A straight leg has no crossing to place, so its furthest vertex is a hip
   corner: a bone out and half a width across. */
const straight = outlineAt(0);
assert.ok(Math.abs(straight.furthest - Math.hypot(BONE, HALF)) < 1e-6);
checks += 1;

console.log(`beefwife limb: ${checks} outline checks passed`);
