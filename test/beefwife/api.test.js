/**
 * Does one Beefwife instance enforce the public lifecycle without leaking state?
 * Equivalent clocks and cloned instances are controls. Fails on non-atomic
 * input, frame dependence, unsafe hitches, topology loss, pose writes affecting
 * simulation, or collisions with host-owned classic-script helpers.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { PIXI } = require("./pixi.js");
const { Beefwife } = require("../../beefwife/src/beefwife.mjs");

const example = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
const finitePose = (pose) =>
  Object.values(pose).every(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;
const samePose = (a, b, tolerance = 1e-9) =>
  Object.keys(a).every(
    (key) =>
      near(a[key].x, b[key].x, tolerance) &&
      near(a[key].y, b[key].y, tolerance),
  );
let checks = 0;

const input = copy(example);
const beefwife = new Beefwife(input, {
  position: { x: 20, y: 30 },
  direction: { x: 4, y: 0 },
});
assert.deepEqual(beefwife.getPose().head, { x: 20, y: 30 });
assert.deepEqual(beefwife.getPose().direction, { x: 1, y: 0 });
input.name = "mutated";
input.definitions.shapes.eye.path = "M 0 0";
assert.equal(beefwife.descriptor.name, "beefwife");
assert.notEqual(beefwife.descriptor.definitions.shapes.eye.path, "M 0 0");
assert.ok(Object.isFrozen(beefwife.descriptor));
// Freezing only the root would leave every nested object writable.
assert.ok(Object.isFrozen(beefwife.descriptor.chain.sections.head));
assert.ok(Object.isFrozen(beefwife.descriptor.chain.skin.plates[0].at));
checks += 7;

const borrowedPose = beefwife.getPose();
assert.equal(beefwife.getPose(), borrowedPose);
borrowedPose.head.x = -100;
assert.equal(beefwife.getPose().head.x, -100);
beefwife.translate({ x: 0, y: 0 });
assert.equal(beefwife.getPose(), borrowedPose);
assert.equal(borrowedPose.head.x, 20);
checks += 4;

assert.equal(beefwife.draw, undefined);
assert.equal(beefwife.getRenderState, undefined);
assert.equal(beefwife.sync, undefined);
checks += 3;

/* Each case names the reason it must be rejected: a bare `assert.throws` here
   passes for a method that throws on everything. */
[
  [
    () => new Beefwife(example, { unknown: true }),
    /options\.unknown is unknown/,
  ],
  [
    () => new Beefwife(example, { position: { x: 0, y: 0, z: 0 } }),
    /options\.position\.z is unknown/,
  ],
  [
    () => new Beefwife(example, { direction: { x: 0, y: 0 } }),
    /options\.direction must be nonzero/,
  ],
  [
    () => new Beefwife(example, { position: { x: Number.MAX_VALUE, y: 0 } }),
    /options\.position coordinates must be from/,
  ],
  [
    () => new Beefwife(example, { phase: Infinity }),
    /options\.phase must be a finite number/,
  ],
  [
    () => new Beefwife(example, { random: 1 }),
    /options\.random must be a function/,
  ],
  [
    () => new Beefwife(example, { render: { unknown: true } }),
    /options\.render\.unknown is unknown/,
  ],
  [
    () => new Beefwife(example, { render: { roundVertices: 1 } }),
    /options\.render\.roundVertices must be a boolean/,
  ],
  [
    () => new Beefwife(example, { render: { pixelResolution: 0 } }),
    /options\.render\.pixelResolution must be positive/,
  ],
  [
    () => new Beefwife(example, { render: { pixelResolution: Infinity } }),
    /options\.render\.pixelResolution must be a finite number/,
  ],
  [
    () =>
      new Beefwife(example, {
        render: {
          kneeProjection: { centerX: 0, centerY: 0, perspective: -1 },
        },
      }),
    /options\.render\.kneeProjection\.perspective must be nonnegative/,
  ],
  [
    () =>
      new Beefwife(example, {
        render: {
          kneeProjection: {
            centerX: 0,
            centerY: 0,
            perspective: 1,
            extra: true,
          },
        },
      }),
    /options\.render\.kneeProjection\.extra is unknown/,
  ],
  [() => beefwife.step(-1), /dt must be nonnegative/],
  [() => beefwife.step(NaN), /dt must be a finite number/],
  [
    () => beefwife.step(0.01, { throttle: 1.1 }),
    /controls\.throttle must be from 0 to 1/,
  ],
  [
    () => beefwife.step(0.01, { direction: { x: 0, y: 0 } }),
    /controls\.direction must be nonzero/,
  ],
  [() => beefwife.step(0.01, { extra: true }), /controls\.extra is unknown/],
  [
    () => beefwife.translate({ x: 1, y: Infinity }),
    /offset\.y must be a finite number/,
  ],
  [() => beefwife.translate(), /offset is required/],
  /* null is what an emptied number input hands back, and `??` would take it
     as an omitted field rather than a bad one. */
  [
    () => beefwife.step(0.01, { throttle: null }),
    /controls\.throttle must be a finite number/,
  ],
  [
    () => new Beefwife(example, { phase: null }),
    /options\.phase must be a finite number/,
  ],
  [
    () => beefwife.reset({ phase: null }),
    /options\.phase must be a finite number/,
  ],
  /* Finite but absurd render policy turns finite vertices into infinities, so
     these are rejected on the same terms as an out-of-world position. */
  [
    () =>
      new Beefwife(example, {
        render: { pixelResolution: Number.MAX_VALUE },
      }),
    /options\.render\.pixelResolution must be from/,
  ],
  [
    () => new Beefwife(example, { render: { pixelResolution: 5e-324 } }),
    /options\.render\.pixelResolution must be from/,
  ],
  [
    () =>
      new Beefwife(example, {
        render: {
          kneeProjection: { centerX: 0, centerY: 0, perspective: 1e300 },
        },
      }),
    /options\.render\.kneeProjection\.perspective must be at most/,
  ],
  [
    () =>
      new Beefwife(example, {
        render: {
          kneeProjection: { centerX: 1e300, centerY: 0, perspective: 0.002 },
        },
      }),
    /options\.render\.kneeProjection\.center coordinates must be from/,
  ],
  [
    () =>
      new Beefwife(example, {
        render: {
          kneeProjection: {
            centerX: 0,
            centerY: 0,
            perspective: 0.002,
            maxOffset: 1e300,
          },
        },
      }),
    /options\.render\.kneeProjection\.maxOffset must be at most/,
  ],
].forEach(([act, reason]) => {
  assert.throws(act, reason);
  checks++;
});

const maximalDirection = new Beefwife(example, {
  direction: { x: Number.MAX_VALUE, y: Number.MAX_VALUE },
});
const retainedMaximalPose = maximalDirection.getPose();
assert.ok(near(maximalDirection.getPose().direction.x, Math.SQRT1_2));
assert.ok(near(maximalDirection.getPose().direction.y, Math.SQRT1_2));
maximalDirection.step(0.01, {
  direction: { x: Number.MAX_VALUE, y: -Number.MAX_VALUE },
});
assert.equal(maximalDirection.getPose(), retainedMaximalPose);
maximalDirection.reset({
  direction: { x: -Number.MAX_VALUE, y: Number.MAX_VALUE },
});
assert.equal(maximalDirection.getPose(), retainedMaximalPose);
assert.ok(finitePose(maximalDirection.getPose()));
assert.ok(
  near(
    Math.hypot(
      maximalDirection.getPose().direction.x,
      maximalDirection.getPose().direction.y,
    ),
    1,
  ),
);
checks += 6;

const nearBoundary = new Beefwife(example, {
  position: { x: Beefwife.MAX_WORLD_COORDINATE - 1, y: 0 },
});
const beforeRejectedTranslation = copy(nearBoundary.getPose());
assert.throws(
  () => nearBoundary.translate({ x: 2, y: 0 }),
  /outside the world/,
);
assert.ok(samePose(nearBoundary.getPose(), beforeRejectedTranslation));
assert.throws(
  () =>
    new Beefwife(example, {
      position: { x: Beefwife.MAX_WORLD_COORDINATE, y: 0 },
      direction: { x: -1, y: 0 },
    }),
  /outside the world/,
);
assert.ok(finitePose(nearBoundary.getPose()));
checks += 4;

const boundaryDescriptor = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "long-girl.json"),
    "utf8",
  ),
);
const boundaryWalker = new Beefwife(boundaryDescriptor, {
  position: { x: Beefwife.MAX_WORLD_COORDINATE - 1, y: 0 },
  direction: { x: 1, y: 0 },
  random: () => 0.5,
});
for (let frame = 0; frame < 4; frame++) boundaryWalker.step(0.05);
const boundaryPose = boundaryWalker.getPose();
assert.ok(finitePose(boundaryPose));
assert.ok(boundaryPose.head.x <= Beefwife.MAX_WORLD_COORDINATE);
boundaryWalker.translate({ x: 0, y: 0 });
boundaryWalker.reset();
assert.ok(finitePose(boundaryWalker.getPose()));
checks += 4;

const differentialThrust = copy(example);
Object.assign(differentialThrust.definitions.materials.body, {
  velocityRetention: 1,
  jointCorrection: 0,
  linkCorrection: 0.001,
  grip: { forward: 0, backward: 0, lateral: 0 },
});
differentialThrust.gait.bend.amplitude = 0;
differentialThrust.gait.gather.amplitude = 0;
differentialThrust.gait.thrust.acceleration = 1e6;
differentialThrust.gait.thrust.dutyCycle = 1;
differentialThrust.chain.sections.trunk.chunks = 245;
differentialThrust.chain.sections.head.motionScale.thrust = 0;
differentialThrust.chain.sections.trunk.motionScale.thrust = 1;
differentialThrust.chain.sections.tail.motionScale.thrust = 0;
const stressedBoundary = new Beefwife(differentialThrust, {
  position: { x: Beefwife.MAX_WORLD_COORDINATE - 1, y: 0 },
});
for (let frame = 0; frame < 1500; frame++) {
  stressedBoundary.step(0.05);
  stressedBoundary.translate({ x: 0, y: 0 });
}
assert.ok(finitePose(stressedBoundary.getPose()));
stressedBoundary.reset();
assert.ok(finitePose(stressedBoundary.getPose()));
checks += 2;

const hitched = new Beefwife(example);
const bounded = new Beefwife(example);
hitched.step(10);
bounded.step(Beefwife.MAX_STEP_SECONDS);
assert.ok(samePose(hitched.getPose(), bounded.getPose()));
checks++;

const stopped = new Beefwife(example);
const stoppedPose = copy(stopped.getPose());
stopped.step(0.05, { throttle: 0, direction: { x: 0, y: 1 } });
assert.ok(samePose(stopped.getPose(), stoppedPose));
checks++;

const breathingExample = copy(example);
breathingExample.chain.breathing = 1;
const breathAtZero = new Beefwife(breathingExample, { random: () => 0 });
const breathAtQuarter = new Beefwife(breathingExample, { random: () => 0.25 });
const matchingBreath = new Beefwife(breathingExample, { random: () => 0.25 });
/* Long enough to land a substep whatever the library's substep size is; a
   shorter step can leave every pose at its untouched starting value, which
   would compare equal for reasons this check is not about. */
for (const breathingBeefwife of [breathAtZero, breathAtQuarter, matchingBreath])
  breathingBeefwife.step(Beefwife.MAX_STEP_SECONDS, { throttle: 0 });
assert.ok(!samePose(breathAtZero.getPose(), breathAtQuarter.getPose()));
assert.ok(samePose(breathAtQuarter.getPose(), matchingBreath.getPose()));
checks += 2;

/* `#private` fields are invisible to `in` whatever the implementation, so
   naming ones this code never had proves nothing. Enumerate what is actually
   reachable instead: what a beefwife adds over a bare container, and the
   documented methods. */
const containerKeys = new Set(Object.keys(new PIXI.Container()));
// `onRender` is an accessor on Container, so assigning it lands in `_onRender`.
assert.deepEqual(
  Object.keys(beefwife).filter((key) => !containerKeys.has(key)),
  ["label", "_onRender"],
);
assert.deepEqual(
  Object.getOwnPropertyNames(Object.getPrototypeOf(beefwife)).sort(),
  [
    "constructor",
    "descriptor",
    "destroy",
    "getBendResponse",
    "getPose",
    "reset",
    "restLength",
    "setDescriptor",
    "step",
    "translate",
  ],
);
checks += 2;

const sixty = new Beefwife(example);
const oneTwenty = new Beefwife(example);
for (let frame = 0; frame < 60; frame++) sixty.step(1 / 60);
for (let frame = 0; frame < 120; frame++) oneTwenty.step(1 / 120);
assert.ok(samePose(sixty.getPose(), oneTwenty.getPose()));
checks++;

const shifted = copy(beefwife.getPose());
beefwife.translate({ x: 7, y: -11 });
const translated = beefwife.getPose();
["head", "center"].forEach((key) => {
  assert.ok(near(translated[key].x, shifted[key].x + 7));
  assert.ok(near(translated[key].y, shifted[key].y - 11));
  checks += 2;
});
assert.deepEqual(translated.direction, shifted.direction);
checks++;

const control = new Beefwife(example);
const edited = new Beefwife(example);
const retainedEditedPose = edited.getPose();
for (let frame = 0; frame < 30; frame++) {
  control.step(1 / 60);
  edited.step(1 / 60);
}
const recolored = copy(example);
recolored.definitions.paints.shell.fill = "#123456";
edited.setDescriptor(recolored);
assert.equal(edited.getPose(), retainedEditedPose);
assert.equal(edited.descriptor.definitions.paints.shell.fill, "#123456");
assert.ok(samePose(edited.getPose(), control.getPose()));
for (let frame = 0; frame < 30; frame++) {
  control.step(1 / 60);
  edited.step(1 / 60);
}
assert.ok(samePose(edited.getPose(), control.getPose()));
checks += 4;

const beforeInvalid = copy(edited.getPose());
const invalid = copy(example);
invalid.chain.sections.trunk.material = "missing";
assert.throws(() => edited.setDescriptor(invalid));
assert.equal(edited.descriptor.definitions.paints.shell.fill, "#123456");
assert.ok(samePose(edited.getPose(), beforeInvalid));
checks += 3;

const changedTopology = copy(recolored);
changedTopology.chain.sections.head.chunks = 1;
changedTopology.chain.skin.plates[0].repeat.count = null;
changedTopology.chain.skin.plates[1].at.offset = 1;
changedTopology.chain.skin.ornaments[0].at.offset = 0;
const beforeTopology = copy(edited.getPose());
edited.setDescriptor(changedTopology);
const afterTopology = edited.getPose();
/* Changed section counts carry the chain rather than re-place it: a chunk the
   descriptor still names keeps its exact position, so the body settles from
   where it stood. The head tangent follows whichever chunk now sits behind the
   head, which is a real turn when the chunk that defined it was removed. */
assert.equal(afterTopology, retainedEditedPose);
assert.equal(afterTopology.head.x, beforeTopology.head.x);
assert.equal(afterTopology.head.y, beforeTopology.head.y);
assert.ok(
  Math.hypot(
    afterTopology.center.x - beforeTopology.center.x,
    afterTopology.center.y - beforeTopology.center.y,
  ) < 10,
);
assert.ok(
  afterTopology.direction.x * beforeTopology.direction.x +
    afterTopology.direction.y * beforeTopology.direction.y >
    Math.cos(Math.PI / 9),
);
checks += 5;

/* Hosts size their own bounds from the chain, so the resting arc length is
   public and tracks the live topology. */
assert.equal(beefwife.restLength, 312);
assert.equal(
  edited.restLength,
  312 - edited.descriptor.chain.sections.head.spacing,
);
checks += 2;

edited.step(0.05, { direction: { x: 0, y: 1 } });
const beforeReset = copy(edited.getPose());
edited.reset({ position: { x: 5, y: 6 } });
const afterReset = edited.getPose();
assert.deepEqual(afterReset.head, { x: 5, y: 6 });
assert.ok(
  near(afterReset.direction.x, beforeReset.direction.x) &&
    near(afterReset.direction.y, beforeReset.direction.y),
);
checks += 2;

const independentA = new Beefwife(example);
const independentB = new Beefwife(example);
independentA.translate({ x: 10, y: 0 });
assert.equal(independentB.getPose().head.x, 0);
checks++;

const castDir = path.join(__dirname, "..", "fixtures", "beefwives");
fs.readdirSync(castDir)
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .forEach((name) => {
    const instance = new Beefwife(
      JSON.parse(fs.readFileSync(path.join(castDir, name), "utf8")),
    );
    for (let frame = 0; frame < 600; frame++)
      instance.step(1 / 60, {
        throttle: frame % 120 < 90 ? 1 : 0.25,
        direction: frame < 300 ? { x: 1, y: 0 } : { x: 0, y: 1 },
      });
    const pose = instance.getPose();
    assert.ok(finitePose(pose));
    assert.ok(near(Math.hypot(pose.direction.x, pose.direction.y), 1));
    checks += 2;
  });

const browser = vm.createContext({ console });
vm.runInContext(
  `const TAU = "host";
   const positiveModulo = "host";
   const PHYSICS_STEP = "host";
   const RELAX_PASSES = "host";
   const AXIS_RATE = "host";
   const lerp = "host";
   const clamp = "host";
   const limbLength = "host";`,
  browser,
);
const seeded = new Set(Reflect.ownKeys(browser));
vm.runInContext(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.js"),
    "utf8",
  ),
  browser,
);
assert.deepEqual(
  Reflect.ownKeys(browser).filter((key) => !seeded.has(key)),
  ["Beefwife"],
);
/* No renderer is on this page, which is the only path where a beefwife
   simulates without building a scene to draw it with. */
const headless = vm.runInContext(
  `const creature = new Beefwife(${JSON.stringify(example)});
   creature.step(1 / 60);
   ({
     name: creature.descriptor.name,
     parse: typeof Beefwife.Descriptor.parse,
     onRender: creature.onRender,
     children: creature.children,
     moved: creature.getPose().head.x !== 0,
   })`,
  browser,
);
// Spread to compare by value: the object comes back from another realm.
assert.deepEqual(
  { ...headless },
  {
    name: "beefwife",
    parse: "function",
    onRender: null,
    children: undefined,
    moved: true,
  },
);
checks += 2;

console.log(`beefwife API: ${checks} lifecycle checks passed`);
