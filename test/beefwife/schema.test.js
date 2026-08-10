/**
 * Does the schema tree report per field what it enforces per field? `scale`
 * reads each field's length dimension and `bounds` reads its constraints, so
 * both answer from the same tree `read` checks against. Fails if a length
 * field misses the factor, if a dimensionless one takes it, or if a reported
 * edge is one `read` rejects.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const BeefwifeDescriptor = require("../../beefwife/beefwife-descriptor.js");

const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;

const accepted = (label, value) => {
  checks++;
  try {
    return BeefwifeDescriptor.read(value);
  } catch (error) {
    throw new Error(`${label} was rejected: ${error.message}`);
  }
};

const rejected = (label, value, pattern) => {
  checks++;
  let error = null;
  try {
    BeefwifeDescriptor.read(value);
  } catch (caught) {
    error = caught;
  }
  if (!error) throw new Error(`${label} was accepted`);
  if (pattern && !pattern.test(error.message))
    throw new Error(`${label} failed for the wrong reason: ${error.message}`);
};

const canonical = accepted("canonical example", source);

/* scale() transforms every length-dimensioned field by k ** length and
   leaves everything else untouched. */
const k = 2.5;
const scaled = BeefwifeDescriptor.scale(source, k);
assert.equal(
  scaled.chain.sections.trunk.spacing,
  canonical.chain.sections.trunk.spacing * k,
);
assert.equal(
  scaled.chain.sections.tail.profile.ribbonWidth.start,
  canonical.chain.sections.tail.profile.ribbonWidth.start * k,
);
assert.equal(scaled.legs.reach, canonical.legs.reach * k);
assert.equal(scaled.legs.skin.limbWidth, canonical.legs.skin.limbWidth * k);
assert.equal(
  scaled.chain.skin.ornaments[0].offset.outward,
  canonical.chain.skin.ornaments[0].offset.outward * k,
);
assert.equal(
  scaled.chain.skin.plates[0].scale,
  canonical.chain.skin.plates[0].scale * k,
);
assert.equal(
  scaled.chain.skin.ornaments[0].scale,
  canonical.chain.skin.ornaments[0].scale * k,
);
assert.equal(scaled.legs.skin.foot.scale, canonical.legs.skin.foot.scale * k);
assert.equal(
  scaled.gait.thrust.acceleration,
  canonical.gait.thrust.acceleration * k,
);
assert.equal(
  scaled.gait.phaseLagRadiansPerPixel,
  canonical.gait.phaseLagRadiansPerPixel / k,
);
assert.equal(
  scaled.legs.skin.foot.plantedScale,
  canonical.legs.skin.foot.plantedScale,
);
assert.equal(scaled.legs.spread, canonical.legs.spread);
assert.equal(scaled.legs.swingArc, canonical.legs.swingArc);
assert.equal(scaled.legs.swingCycles, canonical.legs.swingCycles);
assert.equal(scaled.chain.skin.loadScale, canonical.chain.skin.loadScale);
const strokedPaint = copy(source);
strokedPaint.definitions.paints.ribbon.stroke = {
  colour: "#123456",
  width: 3,
};
assert.equal(
  BeefwifeDescriptor.scale(strokedPaint, k).definitions.paints.ribbon.stroke
    .width,
  3,
);
assert.deepEqual(BeefwifeDescriptor.scale(source, 1), canonical);
for (const factor of [0, -1, NaN, Infinity, "2"])
  assert.throws(() => BeefwifeDescriptor.scale(source, factor), /scale factor/);
assert.throws(() => BeefwifeDescriptor.scale(source, 100), /between/);
assert.throws(() => BeefwifeDescriptor.scale(source, 0.0001), /between/);
checks += 24;

assert.deepEqual(BeefwifeDescriptor.bounds("legs.pairs"), {
  kind: "number",
  min: 0,
  max: 128,
  integer: true,
  nullable: false,
});
assert.deepEqual(BeefwifeDescriptor.bounds("chain.skin.ornaments[].side"), {
  kind: "choice",
  values: ["left", "right", "both"],
  nullable: false,
});
assert.equal(
  BeefwifeDescriptor.bounds("chain.skin.plates[].repeat.count").nullable,
  true,
);
assert.equal(
  BeefwifeDescriptor.bounds("chain.skin.plates[].at.section").kind,
  "choice",
);
// Descends through a nullable container to reach the field inside it.
assert.equal(
  BeefwifeDescriptor.bounds("definitions.paints.*.stroke.width").max,
  1000,
);
assert.equal(BeefwifeDescriptor.bounds("definitions.shapes").minEntries, 1);
assert.equal(BeefwifeDescriptor.bounds("chain.skin.plates").maxLength, 512);
assert.ok(Object.isFrozen(BeefwifeDescriptor.bounds("legs.pairs")));
for (const path of ["legs.nope", "chain.skin.plates.side", "legs..pairs"])
  assert.throws(() => BeefwifeDescriptor.bounds(path), /not a field/);
assert.throws(() => BeefwifeDescriptor.bounds(""), /non-empty string/);
assert.throws(() => BeefwifeDescriptor.bounds(null), /non-empty string/);
checks += 11;

/* A reported bound is only useful if it is the one `read` enforces, so every
   edge is applied to a real descriptor and the value past it is rejected. */
const setAt = (target, segments, value) => {
  if (target === null || target === undefined) return;
  const [head, ...rest] = segments;
  if (head === "[]") return target.forEach((item) => setAt(item, rest, value));
  if (head === "*")
    return Object.values(target).forEach((item) => setAt(item, rest, value));
  if (!rest.length) target[head] = value;
  else setAt(target[head], rest, value);
};

for (const path of [
  "legs.pairs",
  "gait.bend.harmonic",
  "chain.skin.loadScale",
  "chain.skin.ornaments[].scale",
  "chain.skin.plates[].scale",
  "definitions.materials.*.grip.forward",
  "chain.sections.trunk.spacing",
  "definitions.paints.*.stroke.width",
  "chain.skin.ornaments[].react",
]) {
  const limit = BeefwifeDescriptor.bounds(path);
  const segments = path.replace(/\[\]/g, ".[]").split(".");
  const step = limit.integer ? 1 : 1e-6;
  for (const [edge, outside] of [
    [limit.min, limit.min - step],
    [limit.max, limit.max + step],
  ]) {
    const inside = copy(source);
    setAt(inside, segments, edge);
    BeefwifeDescriptor.read(inside);
    const beyond = copy(source);
    setAt(beyond, segments, outside);
    rejected(`${path} past ${outside}`, beyond, /between/);
  }
  checks += 2;
}

console.log(`descriptor schema: ${checks} field checks passed`);
