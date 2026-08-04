/**
 * Does skin state stay renderer-neutral and coherent with body motion?
 * Equivalent clocks and translated snapshots are controls. Fails on unstable
 * snapshot storage, non-finite geometry, translation drift, or ornament motion
 * that materially changes with the host frame rate.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const BeefwifeModel = require("../../beefwife/beefwife-model.js");
const { BeefwifeGait } = require("../../beefwife/beefwife-drive.js");
const { BeefwifeBody } = require("../../beefwife/beefwife-body.js");
const { BeefwifeLegs } = require("../../beefwife/beefwife-legs.js");
const { BeefwifeSkin } = require("../../beefwife/beefwife-skin.js");

const descriptor = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"), "utf8"),
);
const finite = (values) => values.every(Number.isFinite);
const near = (before, after, tolerance = 1e-6) =>
  Math.abs(before - after) <= tolerance;

const runtimeFor = (source) => {
  const model = BeefwifeModel.compile(source);
  const gait = new BeefwifeGait(model.gait, 0);
  const body = new BeefwifeBody(model, gait);
  body.place({ x: 20, y: 30 }, { x: 1, y: 0 });
  const legs = new BeefwifeLegs(model, body, gait, () => 0.5);
  const skin = new BeefwifeSkin(model, body, legs);
  return { model, gait, body, legs, skin };
};

const advance = (runtime, frames, dt) => {
  for (let frame = 0; frame < frames; frame++) {
    runtime.body.step(dt, 1, { x: 1, y: 0 }, (seconds) => {
      runtime.legs.update(seconds, 1);
      runtime.skin.update(seconds);
    });
  }
};

let checks = 0;
const runtime = runtimeFor(descriptor);
const state = runtime.skin.writeRenderState();
assert.equal(
  state.chunks.length,
  runtime.body.chunks.length * state.layout.chunkStride,
);
assert.equal(
  state.legs.length,
  runtime.legs.legs.length * state.layout.legStride,
);
assert.equal(
  state.ornaments.length,
  runtime.model.skin.ornaments.length * state.layout.ornamentStride,
);
assert.equal(
  state.plates.length,
  runtime.model.skin.platesTailFirst.length * state.layout.plateStride,
);
assert.ok(
  [state.chunks, state.legs, state.ornaments, state.plates].every(finite),
);
checks += 5;

const chunkStorage = state.chunks;
const legStorage = state.legs;
advance(runtime, 30, 1 / 60);
assert.equal(runtime.skin.writeRenderState(state), state);
assert.equal(state.chunks, chunkStorage);
assert.equal(state.legs, legStorage);
assert.ok(finite(state.chunks) && finite(state.legs));
checks += 4;

const beforeTranslation = runtime.skin.writeRenderState();
runtime.body.translate({ x: 7, y: -11 });
runtime.legs.translate({ x: 7, y: -11 });
runtime.skin.translate({ x: 7, y: -11 });
const afterTranslation = runtime.skin.writeRenderState();
for (let offset = 0; offset < state.chunks.length; offset += 4) {
  assert.ok(
    near(afterTranslation.chunks[offset], beforeTranslation.chunks[offset] + 7),
  );
  assert.ok(
    near(
      afterTranslation.chunks[offset + 1],
      beforeTranslation.chunks[offset + 1] - 11,
    ),
  );
  checks += 2;
}
for (let offset = 0; offset < state.ornaments.length; offset += 6) {
  assert.ok(
    near(
      afterTranslation.ornaments[offset],
      beforeTranslation.ornaments[offset] + 7,
    ),
  );
  assert.ok(
    near(
      afterTranslation.ornaments[offset + 1],
      beforeTranslation.ornaments[offset + 1] - 11,
    ),
  );
  checks += 2;
}

const sixty = runtimeFor(descriptor);
const oneTwenty = runtimeFor(descriptor);
advance(sixty, 60, 1 / 60);
advance(oneTwenty, 120, 1 / 120);
const sixtyState = sixty.skin.writeRenderState();
const oneTwentyState = oneTwenty.skin.writeRenderState();
for (let index = 0; index < sixtyState.ornaments.length; index++) {
  assert.ok(
    near(sixtyState.ornaments[index], oneTwentyState.ornaments[index], 0.1),
  );
  checks++;
}

console.log(`beefwife skin: ${checks} renderer-neutral state checks passed`);
