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
const BeefwifeSchema = require("../../beefwife/beefwife-schema.js");

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
  3 * k,
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
assert.equal(BeefwifeDescriptor.bounds("chain.skin.plates").maxLength, 256);
assert.equal(BeefwifeDescriptor.bounds("chain.skin.ornaments").maxLength, 512);
assert.ok(Object.isFrozen(BeefwifeDescriptor.bounds("legs.pairs")));

/* The reported pattern must be a copy. Freezing the wrapper does not reach
   into a RegExp, so handing back the schema's own would let a caller reassign
   `test` and switch validation off for every descriptor in the process. */
for (const [path, key] of [
  ["name", "pattern"],
  ["definitions.shapes", "keyPattern"],
]) {
  const first = BeefwifeDescriptor.bounds(path)[key];
  const second = BeefwifeDescriptor.bounds(path)[key];
  assert.notEqual(first, second);
  assert.equal(first.source, second.source);
  first.test = () => true;
  checks += 2;
}
rejected("neutered name pattern", { ...source, name: "Not A Slug" }, /allowed/);
const badKey = copy(source);
badKey.definitions.shapes["not an id"] = { path: "M 0 0" };
rejected("neutered key pattern", badKey, /invalid id/);

/* Head and trunk have to exist, and a caller driving a slider from `bounds`
   must be told so rather than finding out from `read`. */
assert.equal(BeefwifeDescriptor.bounds("chain.sections.head.chunks").min, 1);
assert.equal(BeefwifeDescriptor.bounds("chain.sections.trunk.chunks").min, 1);
assert.equal(BeefwifeDescriptor.bounds("chain.sections.tail.chunks").min, 0);
for (const section of ["head", "trunk"]) {
  const empty = copy(source);
  empty.chain.sections[section].chunks = 0;
  rejected(`empty ${section}`, empty, /must be between 1 and 256/);
}
const noTail = copy(source);
noTail.chain.sections.tail.chunks = 0;
accepted("empty tail", noTail);
checks += 4;

// Blank is length without content, so the reported minimum alone would lie.
assert.equal(
  BeefwifeDescriptor.bounds("definitions.paints.*.fill").blankAllowed,
  false,
);
assert.equal(BeefwifeDescriptor.bounds("name").blankAllowed, true);
const blankFill = copy(source);
blankFill.definitions.paints.shell.fill = " ";
rejected("blank fill", blankFill, /must not be blank/);
checks += 3;
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

/* Every numeric field the schema declares, not a hand-picked few: walk the
   tree for paths, then drive each field to both its reported edges and one
   step past. A bound nobody can reach is as wrong as one that lets a bad value
   through, so the edge itself must be accepted. */
const numericPaths = (node, trail = [], out = []) => {
  const at = trail.join(".");
  if (node.kind === "nullable") return numericPaths(node.item, trail, out);
  if (node.kind === "number") out.push(at);
  if (node.kind === "object")
    for (const [key, field] of Object.entries(node.fields))
      numericPaths(field, [...trail, key], out);
  if (node.kind === "record") numericPaths(node.item, [...trail, "*"], out);
  // `bounds` spells an array item as `plates[]`, not `plates.[]`.
  if (node.kind === "array")
    numericPaths(node.item, [...trail.slice(0, -1), `${trail.at(-1)}[]`], out);
  return out;
};
const everyNumber = numericPaths(BeefwifeSchema.schema);
assert.ok(everyNumber.length > 80, `only ${everyNumber.length} numeric fields`);

/* Some fields answer to more than themselves: section counts are capped as a
   total, the contact and gather amplitudes share a cutoff with the gait, and a
   placement's anchor has to land on a chunk nothing else claims. No
   single-field edit can sit at those edges, so they are swept by name
   elsewhere. Listing them explicitly keeps a new field from joining silently. */
const crossChecked = (path) =>
  /^chain\.sections\.(head|trunk|tail)\.(chunks|motionScale\.(contact|gather))$/.test(
    path,
  ) || /^chain\.skin\.(plates|ornaments)\[\]\.(at|repeat)\./.test(path);
assert.deepEqual(everyNumber.filter(crossChecked), [
  "chain.sections.head.chunks",
  "chain.sections.head.motionScale.gather",
  "chain.sections.head.motionScale.contact",
  "chain.sections.trunk.chunks",
  "chain.sections.trunk.motionScale.gather",
  "chain.sections.trunk.motionScale.contact",
  "chain.sections.tail.chunks",
  "chain.sections.tail.motionScale.gather",
  "chain.sections.tail.motionScale.contact",
  "chain.skin.plates[].at.offset",
  "chain.skin.plates[].repeat.count",
  "chain.skin.plates[].repeat.step",
  "chain.skin.ornaments[].at.offset",
  "chain.skin.ornaments[].repeat.count",
  "chain.skin.ornaments[].repeat.step",
]);
checks += 1;
let swept = 0;
for (const path of everyNumber) {
  if (crossChecked(path)) continue;
  const limit = BeefwifeDescriptor.bounds(path);
  const segments = path.replace(/\[\]/g, ".[]").split(".");
  const step = limit.integer ? 1 : 1e-6;
  for (const [edge, outside] of [
    [limit.min, limit.min - step],
    [limit.max, limit.max + step],
  ]) {
    const inside = copy(source);
    setAt(inside, segments, edge);
    try {
      BeefwifeDescriptor.read(inside);
    } catch (error) {
      throw new Error(
        `${path} rejects its own bound ${edge}: ${error.message}`,
      );
    }
    const beyond = copy(source);
    setAt(beyond, segments, outside);
    rejected(`${path} past ${outside}`, beyond, /between/);
    swept++;
  }
}
assert.equal(swept, (everyNumber.length - 15) * 2);
assert.ok(swept > 140, `only ${swept} edges swept`);
checks += 2;

console.log(`descriptor schema: ${checks} field checks passed`);
