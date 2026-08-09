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
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
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

/* An ornament deflects about its root by a spring chasing a drive-scaled
   target, and each control owns one axis: source the drive mix, react the
   size, recover the tempo, wobble the shape. A scripted single-chunk body
   isolates each drive, and traces read the deviation angle directly so the
   scaling contracts hold exactly. */
const probeSkin = (fields) => {
  const source = JSON.parse(JSON.stringify(descriptor));
  source.chain.skin.ornaments = [
    {
      ...source.chain.skin.ornaments[0],
      id: "probe",
      at: { scope: "chain", section: null, from: "head", offset: 0 },
      repeat: { count: 1, step: 1 },
      side: "right",
      offset: { forward: 0, outward: 0 },
      angleDegrees: 0,
      source: 0,
      react: 1,
      recover: 20,
      wobble: 0,
      ...fields,
    },
  ];
  const model = BeefwifeModel.compile(source);
  const chunk = { x: 0, y: 0, dx: 1, dy: 0 };
  return {
    chunk,
    skin: new BeefwifeSkin(model, { chunks: [chunk] }, { legs: [] }),
  };
};
const turnTrace = (fields, rate, driveSteps, settleSteps, dt) => {
  const { chunk, skin } = probeSkin(fields);
  const trace = [];
  let heading = 0;
  for (let step = 0; step < driveSteps + settleSteps; step++) {
    if (step < driveSteps) heading += rate * dt;
    chunk.dx = Math.cos(heading);
    chunk.dy = Math.sin(heading);
    skin.update(dt);
    trace.push(skin.ornaments[0].angle);
  }
  return trace;
};
const slideTrace = (fields, rate, driveSteps, settleSteps, dt) => {
  const { chunk, skin } = probeSkin(fields);
  const trace = [];
  for (let step = 0; step < driveSteps + settleSteps; step++) {
    if (step < driveSteps) chunk.y += rate * dt;
    skin.update(dt);
    trace.push(skin.ornaments[0].angle);
  }
  return trace;
};

/* react owns size: doubling react doubles the trace and negating react
   negates it, sample for sample. Power-of-two reacts keep the float scaling
   exact. */
const unit = turnTrace({ react: 0.5 }, 0.8, 30, 60, 1 / 60);
const doubled = turnTrace({ react: 1 }, 0.8, 30, 60, 1 / 60);
const negated = turnTrace({ react: -0.5 }, 0.8, 30, 60, 1 / 60);
assert.ok(unit.some((angle) => Math.abs(angle) > 1e-3));
unit.forEach((angle, index) => {
  assert.equal(doubled[index], 2 * angle);
  assert.equal(negated[index], -angle);
  checks += 2;
});

/* recover owns time: doubling recover at half the step, against per-step
   deltas from the same rates, walks the same samples in half the wall time.
   Only atan2 rounding of the scripted headings separates the runs. */
const paced = turnTrace({ recover: 15, wobble: 0.6 }, 0.8, 30, 60, 1 / 60);
const hurried = turnTrace({ recover: 30, wobble: 0.6 }, 0.8, 30, 60, 1 / 120);
paced.forEach((angle, index) => {
  assert.ok(near(hurried[index], angle, 1e-9));
  checks++;
});

/* wobble owns shape: released from a deflection with no drive, wobble 0
   settles without crossing zero and more wobble undershoots deeper. */
const release = (wobble) => {
  const { skin } = probeSkin({ wobble, recover: 12 });
  skin.ornaments[0].angle = 0.4;
  const trace = [];
  for (let step = 0; step < 240; step++) {
    skin.update(1 / 60);
    trace.push(skin.ornaments[0].angle);
  }
  return trace;
};
const settled = release(0);
settled.forEach((angle, index) => {
  assert.ok(angle >= 0, "wobble 0 overshoot");
  if (index) assert.ok(angle <= settled[index - 1] + 1e-12, "wobble 0 order");
  checks += index ? 2 : 1;
});
const undershoots = [0, 0.5, 1].map((wobble) => Math.min(...release(wobble)));
assert.ok(undershoots[1] < -1e-4);
assert.ok(undershoots[2] < undershoots[1]);
checks += 2;

/* wobble leaves size alone: a held drive settles to the same deflection
   whatever the wobble. */
const held = [0, 0.5, 1].map((wobble) =>
  turnTrace({ wobble, recover: 25 }, 0.8, 1200, 0, 1 / 120).at(-1),
);
assert.ok(Math.abs(held[0]) > 1e-3);
held.forEach((angle) => {
  assert.ok(near(angle, held[0], 1e-3));
  checks++;
});

/* source owns the mix: each end hears only its own drive, and the middle is
   the linear blend. */
const wave = turnTrace({ source: 0 }, 0.8, 30, 30, 1 / 60);
const mixed = turnTrace({ source: 0.5 }, 0.8, 30, 30, 1 / 60);
assert.ok(wave.some((angle) => Math.abs(angle) > 1e-3));
wave.forEach((angle, index) => {
  assert.equal(mixed[index], angle / 2);
  checks++;
});
turnTrace({ source: 1 }, 0.8, 30, 30, 1 / 60).forEach((angle) => {
  assert.equal(angle, 0);
  checks++;
});
const slide = slideTrace({ source: 1 }, 40, 30, 30, 1 / 60);
assert.ok(slide.some((angle) => Math.abs(angle) > 1e-3));
checks++;
slideTrace({ source: 0 }, 40, 30, 30, 1 / 60).forEach((angle) => {
  assert.equal(angle, 0);
  checks++;
});

/* Each leg carries its own lean travel, taken from where its anchor sits in
   the leg section. Body lengths never scale it. */
const legged = JSON.parse(JSON.stringify(descriptor));
legged.legs.pairs = 6;
const leanDistances = (source) => {
  const state = runtimeFor(source).skin.writeRenderState();
  const stride = state.layout.legStride;
  const distances = [];
  for (let offset = 0; offset < state.legs.length; offset += stride)
    distances.push(state.legs[offset + 10]);
  return distances;
};
const seatedLean = leanDistances(legged);
assert.ok(finite(seatedLean) && seatedLean.some((distance) => distance !== 0));
checks++;
for (const [section, key, value] of [
  ["head", "chunks", 9],
  ["head", "spacing", 40],
  ["tail", "chunks", 30],
  ["tail", "spacing", 40],
  ["trunk", "spacing", 40],
]) {
  const edited = JSON.parse(JSON.stringify(legged));
  edited.chain.sections[section][key] = value;
  assert.deepEqual(leanDistances(edited), seatedLean);
  checks++;
}

console.log(`beefwife skin: ${checks} renderer-neutral state checks passed`);
