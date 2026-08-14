/**
 * Does the substep rate stay a cost knob rather than a motion knob? Grip,
 * jointCorrection and linkCorrection each take a share of a gap per
 * application, so running the solver more or less often would change how much
 * correction lands in a second unless the shares are rescaled for it. Fails if
 * any of the three drifts across substep rates or pass counts, or if the rates
 * this build ships with move a share off the number the descriptor states.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { compile } = require("../../beefwife/src/model.mjs");
const { ChainTables } = require("../../beefwife/src/tables.mjs");
const { PHYSICS_STEP } = require("../../beefwife/src/body.mjs");

let checks = 0;
const SHIPPED_PASSES = 8;
const descriptor = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "samples", "chevron-guy.json"),
    "utf8",
  ),
);
const model = compile(descriptor);
const tablesAt = (substep, passes) =>
  new ChainTables(model, model.gait, substep, passes);

/* Half a tenth of a second, long enough for a share to compound many times at
   every rate under test and short enough that the strong ones have not yet
   run the gap to nothing, where any two rates would agree for the wrong
   reason. */
const WINDOW = 0.05;
const remaining = (share, rate) => Math.pow(1 - share, rate * WINDOW);

const RATES = [
  [1 / 30, 4],
  [1 / 60, 8],
  [1 / 90, 12],
  [1 / 120, 8],
  [1 / 120, 16],
  [1 / 240, 32],
];

const reference = tablesAt(...RATES[1]);
for (const [substep, passes] of RATES) {
  const tables = tablesAt(substep, passes);
  const substepRate = 1 / substep;
  const linkRate = passes / substep;
  for (let index = 0; index < model.chunks.length; index++) {
    for (const field of ["gripForward", "gripBackward", "gripLateral"])
      assert.ok(
        Math.abs(
          remaining(tables[field][index], substepRate) -
            remaining(reference[field][index], 1 / RATES[1][0]),
        ) < 1e-12,
        `${field} on chunk ${index} drifted at ${substepRate}Hz`,
      );
    assert.ok(
      Math.abs(
        remaining(tables.jointCorrectionHalf[index] * 2, substepRate) -
          remaining(reference.jointCorrectionHalf[index] * 2, 1 / RATES[1][0]),
      ) < 1e-12,
      `jointCorrection on chunk ${index} drifted at ${substepRate}Hz`,
    );
  }
  for (let index = 0; index < model.links.length; index++)
    assert.ok(
      Math.abs(
        remaining(tables.linkCorrectionHalf[index] * 2, linkRate) -
          remaining(
            reference.linkCorrectionHalf[index] * 2,
            RATES[1][1] / RATES[1][0],
          ),
      ) < 1e-12,
      `linkCorrection on link ${index} drifted at ${linkRate} solves/s`,
    );
}
checks += 3;

/* The rates the solver actually runs are the rates the shares are stated at,
   so the rescale is identity here. A change to either constant that forgot the
   other would show up as a descriptor's grip no longer being its own number. */
const shipped = tablesAt(PHYSICS_STEP, SHIPPED_PASSES);
for (let index = 0; index < model.chunks.length; index++) {
  const material = model.chunks[index].material;
  assert.equal(shipped.gripForward[index], material.grip.forward);
  assert.equal(shipped.gripBackward[index], material.grip.backward);
  assert.equal(shipped.gripLateral[index], material.grip.lateral);
  assert.equal(
    shipped.jointCorrectionHalf[index],
    material.jointCorrection * 0.5,
  );
}
for (let index = 0; index < model.links.length; index++)
  assert.equal(
    shipped.linkCorrectionHalf[index],
    model.links[index].linkCorrection * 0.5,
  );
checks += 2;

// A share of 0 never corrects and a share of 1 closes in one go, at any rate.
for (const [substep, passes] of RATES) {
  const materials = descriptor.definitions.materials;
  const [first] = Object.keys(materials);
  const edges = compile({
    ...descriptor,
    definitions: {
      ...descriptor.definitions,
      materials: {
        ...materials,
        [first]: {
          ...materials[first],
          grip: { forward: 0, backward: 0, lateral: 1 },
        },
      },
    },
  });
  const tables = new ChainTables(edges, edges.gait, substep, passes);
  assert.equal(tables.gripForward[0], 0);
  assert.equal(tables.gripLateral[0], 1);
}
checks += 1;

console.log(`beefwife rates: ${checks} invariance checks passed`);
