/**
 * Does schema v1 accept canonical linked beefwives and reject malformed ones?
 * The checked-in example and an overlapping-ornament variant are controls.
 * Fails if either control is rejected, a mutation is accepted, plate overlap
 * survives, ornament overlap fails, the instance cap drifts, or canonical JSON
 * changes on round-trip.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const BeefwifeDescriptor = require("../../beefwife/beefwife-descriptor.js");

const examplePath = path.join(
  __dirname,
  "..",
  "..",
  "beefwife",
  "beefwife.example.json",
);
const exampleText = fs.readFileSync(examplePath, "utf8");
const source = JSON.parse(exampleText);
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

const at = (value, tokens) =>
  tokens.slice(0, -1).reduce((parent, token) => parent[token], value);

const propertyPaths = (value, tokens = [], out = []) => {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => propertyPaths(item, [...tokens, i], out));
    return out;
  }
  Object.keys(value).forEach((key) => {
    const next = [...tokens, key];
    out.push(next);
    propertyPaths(value[key], next, out);
  });
  return out;
};

const objectPaths = (value, tokens = [], out = []) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (Array.isArray(value))
      value.forEach((item, i) => objectPaths(item, [...tokens, i], out));
    return out;
  }
  out.push(tokens);
  Object.keys(value).forEach((key) =>
    objectPaths(value[key], [...tokens, key], out),
  );
  return out;
};

const leafPaths = (value, tokens = [], out = []) => {
  if (!value || typeof value !== "object") {
    out.push(tokens);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => leafPaths(item, [...tokens, i], out));
    return out;
  }
  Object.keys(value).forEach((key) =>
    leafPaths(value[key], [...tokens, key], out),
  );
  return out;
};

const containerPaths = (value, tokens = [], out = []) => {
  if (!value || typeof value !== "object") return out;
  if (tokens.length) out.push(tokens);
  if (Array.isArray(value)) {
    value.forEach((item, i) => containerPaths(item, [...tokens, i], out));
  } else {
    Object.keys(value).forEach((key) =>
      containerPaths(value[key], [...tokens, key], out),
    );
  }
  return out;
};

const labelFor = (tokens) =>
  tokens.reduce(
    (label, token) =>
      typeof token === "number" ? `${label}[${token}]` : `${label}.${token}`,
    "$",
  );

const canonical = accepted("canonical example", source);
assert.equal(exampleText, `${BeefwifeDescriptor.stringify(canonical)}\n`);
assert.equal(
  BeefwifeDescriptor.stringify(BeefwifeDescriptor.parse(exampleText)),
  BeefwifeDescriptor.stringify(canonical),
);
checks += 2;

const castDir = path.join(__dirname, "..", "fixtures", "beefwives");
fs.readdirSync(castDir)
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .sort()
  .forEach((file) => {
    const text = fs.readFileSync(path.join(castDir, file), "utf8");
    const descriptor = accepted(`cast/${file}`, JSON.parse(text));
    assert.equal(descriptor.name, path.basename(file, ".json"));
    assert.equal(text, `${BeefwifeDescriptor.stringify(descriptor)}\n`);
    checks += 2;
  });

const callerOwned = copy(source);
const owned = BeefwifeDescriptor.read(callerOwned);
callerOwned.chain.sections.head.chunks = 99;
assert.equal(owned.chain.sections.head.chunks, 2);
checks++;

for (const key of ["jointBend", "jointLean", "jointLeanCenter"]) {
  for (const value of [-1, 1]) {
    const joint = copy(source);
    joint.legs[key] = value;
    accepted(`${key} ${value}`, joint);
  }
  for (const value of [-1.01, 1.01]) {
    const joint = copy(source);
    joint.legs[key] = value;
    rejected(`${key} ${value}`, joint, /between -1 and 1/);
  }
}
const maximumBreathing = copy(source);
maximumBreathing.chain.breathing = 1;
accepted("maximum breathing", maximumBreathing);
for (const breathing of [-0.01, 1.01]) {
  const outsideBreathing = copy(source);
  outsideBreathing.chain.breathing = breathing;
  rejected(`breathing ${breathing}`, outsideBreathing, /between 0 and 1/);
}

propertyPaths(source).forEach((tokens) => {
  const candidate = copy(source);
  delete at(candidate, tokens)[tokens.at(-1)];
  rejected(`missing ${labelFor(tokens)}`, candidate);
});

const recordPaths = new Set([
  "$.definitions.materials",
  "$.definitions.shapes",
  "$.definitions.paints",
]);
objectPaths(source).forEach((tokens) => {
  const candidate = copy(source);
  const target = tokens.reduce((value, token) => value[token], candidate);
  const label = labelFor(tokens);
  target[recordPaths.has(label) ? "bad key" : "unexpected"] = true;
  rejected(`unknown key in ${label}`, candidate);
});

leafPaths(source).forEach((tokens) => {
  const candidate = copy(source);
  const parent = at(candidate, tokens);
  const key = tokens.at(-1);
  const value = parent[key];
  parent[key] =
    value === null ? false : typeof value === "number" ? "number" : 7;
  rejected(`wrong type at ${labelFor(tokens)}`, candidate);
});

containerPaths(source).forEach((tokens) => {
  const candidate = copy(source);
  const parent = at(candidate, tokens);
  const key = tokens.at(-1);
  parent[key] = Array.isArray(parent[key]) ? {} : [];
  rejected(`wrong container at ${labelFor(tokens)}`, candidate);
});

["My Cool Beefwife", "Undulating", "two_words", " trailing"].forEach((name) => {
  const candidate = copy(source);
  candidate.name = name;
  rejected(`noncanonical name ${JSON.stringify(name)}`, candidate, /allowed/);
});

const overlap = copy(source);
const pupil = copy(overlap.chain.skin.ornaments[0]);
pupil.id = "pupils";
overlap.chain.skin.ornaments.push(pupil);
const linked = accepted("overlapping ornaments", overlap);
assert.deepEqual(
  linked.chain.skin.ornaments.map((entry) => entry.id),
  ["eyes", "pupils"],
);
checks++;

const tailTip = copy(source);
const tuft = copy(tailTip.chain.skin.ornaments[0]);
tuft.id = "tail-tuft";
tuft.at = { scope: "section", section: "tail", from: "tail", offset: 0 };
tailTip.chain.skin.ornaments.push(tuft);
accepted("tail-relative ornament", tailTip);

const plateOverlap = copy(source);
const secondPlate = copy(plateOverlap.chain.skin.plates[0]);
secondPlate.id = "second-head-shell";
plateOverlap.chain.skin.plates.push(secondPlate);
rejected("overlapping plates", plateOverlap, /overlaps plate/);

const duplicateOrnament = copy(overlap);
duplicateOrnament.chain.skin.ornaments[1].id = "eyes";
rejected("duplicate placement id", duplicateOrnament, /must be unique/);

const missingShape = copy(source);
missingShape.chain.skin.ornaments[0].shape = "missing";
rejected("missing shape reference", missingShape, /references missing/);

const missingPaint = copy(source);
missingPaint.legs.skin.foot.paint = "missing";
rejected("missing paint reference", missingPaint, /references missing/);

const tailMaterial = copy(source);
tailMaterial.definitions.materials.tail = copy(
  tailMaterial.definitions.materials.body,
);
tailMaterial.chain.sections.tail.material = "tail";
accepted("linked tail material", tailMaterial);

const missingMaterial = copy(source);
missingMaterial.chain.sections.tail.material = "missing";
rejected("missing material reference", missingMaterial, /references missing/);

const scopeMismatch = copy(source);
scopeMismatch.chain.skin.plates[1].at.section = "trunk";
rejected("chain anchor with a section", scopeMismatch, /must be null/);

const absentSection = copy(source);
absentSection.chain.skin.ornaments[0].at.section = null;
rejected(
  "section anchor without a section",
  absentSection,
  /must name a section/,
);

const outsideAnchor = copy(source);
outsideAnchor.chain.skin.ornaments[0].at.offset = 2;
rejected("anchor outside section", outsideAnchor, /falls outside/);

const outsideRepeat = copy(source);
outsideRepeat.chain.skin.ornaments[0].repeat.count = 2;
rejected("repeat outside section", outsideRepeat, /runs outside/);

const collapsedGather = copy(source);
collapsedGather.gait.gather.amplitude = 0.6;
collapsedGather.chain.sections.tail.motionScale.gather = 2;
rejected("non-positive gathered link", collapsedGather, /zero or negative/);

const negativeContact = copy(source);
negativeContact.gait.contact.lift = 0.6;
negativeContact.chain.sections.tail.motionScale.contact = 2;
rejected("negative contact", negativeContact, /contact negative/);

const emptyHead = copy(source);
emptyHead.chain.sections.head.chunks = 0;
rejected("empty head", emptyHead, /at least 1/);

const emptyTrunk = copy(source);
emptyTrunk.chain.sections.trunk.chunks = 0;
rejected("empty trunk", emptyTrunk, /at least 1/);

const tooManyChunks = copy(source);
tooManyChunks.chain.sections.trunk.chunks = BeefwifeDescriptor.LIMITS.chunks;
rejected("too many total chunks", tooManyChunks, /2 to 256/);

const fractionalPairs = copy(source);
fractionalPairs.legs.pairs = 0.5;
rejected("fractional pairs", fractionalPairs, /integer/);

const fractionalRepeat = copy(source);
fractionalRepeat.chain.skin.plates[0].repeat.count = 1.5;
rejected("fractional repeat", fractionalRepeat, /integer/);

const invisiblePaint = copy(source);
invisiblePaint.definitions.paints.eye = {
  fill: null,
  stroke: null,
  strokeWidth: 0,
};
rejected("invisible paint", invisiblePaint, /visible stroke/);

const widthWithoutStroke = copy(source);
widthWithoutStroke.definitions.paints.ribbon.strokeWidth = 1;
rejected("width without stroke", widthWithoutStroke, /without a stroke/);

/* A limb draws whatever its paint draws, and a body may want bare feet, so
   the schema asks nothing of either the paint or the width. */
const outlinedLeg = copy(source);
outlinedLeg.legs.pairs = 1;
outlinedLeg.definitions.paints.outline = {
  fill: null,
  stroke: "#123456",
  strokeWidth: 2,
};
outlinedLeg.legs.skin.limbPaint = "outline";
accepted("outline-only limb paint", outlinedLeg);

const filledAndStrokedLeg = copy(source);
filledAndStrokedLeg.legs.pairs = 1;
filledAndStrokedLeg.definitions.paints.leg.stroke = "#ffffff";
filledAndStrokedLeg.definitions.paints.leg.strokeWidth = 12;
accepted("filled and stroked limb paint", filledAndStrokedLeg);

const widthlessLeg = copy(source);
widthlessLeg.legs.pairs = 1;
widthlessLeg.legs.skin.limbWidth = 0;
accepted("legs without limb width", widthlessLeg);

const widthlessLegless = copy(source);
widthlessLegless.legs.pairs = 0;
widthlessLegless.legs.skin.limbWidth = 0;
accepted("legless body without limb width", widthlessLegless);

const notFinite = copy(source);
notFinite.gait.cyclesPerSecond = Infinity;
rejected("infinite rate", notFinite, /finite number/);

const nan = copy(source);
nan.gait.phaseLagRadiansPerPixel = NaN;
rejected("NaN lag", nan, /finite number/);

const sparse = copy(source);
delete sparse.chain.skin.plates[0];
rejected("sparse placement array", sparse, /is missing/);

const namedArray = copy(source);
namedArray.chain.skin.plates.extra = true;
rejected("named array property", namedArray, /named properties/);

const customPrototype = copy(source);
Object.setPrototypeOf(customPrototype.chain, { inherited: true });
rejected("custom object prototype", customPrototype, /plain JSON object/);

const cyclic = copy(source);
cyclic.chain.physics.autoLift = cyclic;
rejected("cyclic object", cyclic, /cycle/);

const symbolKey = copy(source);
symbolKey.chain[Symbol("hidden")] = true;
rejected("symbol key", symbolKey, /symbol keys/);

const hostileKey = copy(source);
Object.defineProperty(hostileKey.chain, "__proto__", {
  enumerable: true,
  value: {},
});
rejected("prototype-named key", hostileKey, /is unknown/);

const longPath = copy(source);
longPath.definitions.shapes.eye.path = "M".repeat(
  BeefwifeDescriptor.LIMITS.path + 1,
);
rejected("oversized SVG path", longPath, /characters/);

const tooManyPathCharacters = copy(source);
for (let i = 0; i < 17; i++)
  tooManyPathCharacters.definitions.shapes[`bulk-${i}`] = {
    path: "M".repeat(BeefwifeDescriptor.LIMITS.path),
  };
rejected("oversized combined paths", tooManyPathCharacters, /paths must total/);

const tooManyOrnaments = copy(source);
tooManyOrnaments.chain.sections.trunk.chunks = 245;
for (let i = 0; i < 9; i++) {
  const entry = copy(tooManyOrnaments.chain.skin.ornaments[0]);
  entry.id = `crowd-${i}`;
  entry.at = { scope: "chain", section: null, from: "head", offset: 0 };
  entry.repeat = { count: null, step: 1 };
  tooManyOrnaments.chain.skin.ornaments.push(entry);
}
rejected("too many expanded ornaments", tooManyOrnaments, /at most 512/);

const maximumOrnaments = copy(source);
maximumOrnaments.chain.sections.trunk.chunks = 245;
const repeatedOrnament = copy(maximumOrnaments.chain.skin.ornaments[0]);
repeatedOrnament.at = {
  scope: "chain",
  section: null,
  from: "head",
  offset: 0,
};
repeatedOrnament.repeat = { count: null, step: 1 };
repeatedOrnament.side = "both";
maximumOrnaments.chain.skin.ornaments = [repeatedOrnament];
accepted("maximum expanded ornaments", maximumOrnaments);
const oneExtraOrnament = copy(maximumOrnaments);
const extraOrnament = copy(repeatedOrnament);
extraOrnament.id = "one-extra";
extraOrnament.repeat = { count: 1, step: 1 };
extraOrnament.side = "left";
oneExtraOrnament.chain.skin.ornaments.push(extraOrnament);
rejected("one excessive ornament", oneExtraOrnament, /at most 512/);

const excessiveScale = copy(source);
excessiveScale.chain.skin.plates[0].scale = 101;
rejected("excessive drawable scale", excessiveScale, /between/);

const disconnectedMaterial = copy(source);
disconnectedMaterial.definitions.materials.body.linkCorrection = 0;
rejected("disconnected material", disconnectedMaterial, /between/);

const blankPath = copy(source);
blankPath.definitions.shapes.eye.path = "   ";
rejected("blank SVG path", blankPath, /must not be blank/);

const blankPaint = copy(source);
blankPaint.definitions.paints.eye.fill = " ";
rejected("blank paint", blankPaint, /must not be blank/);

const paddedName = copy(source);
paddedName.name = " undulating ";
rejected("padded name", paddedName, /allowed/);

const accessor = copy(source);
Object.defineProperty(accessor.chain, "physics", {
  enumerable: true,
  get: () => source.chain.physics,
});
rejected("accessor property", accessor, /enumerable data property/);

const hiddenArrayEntry = copy(source);
Object.defineProperty(hiddenArrayEntry.chain.skin.plates, 0, {
  enumerable: false,
  value: hiddenArrayEntry.chain.skin.plates[0],
});
rejected(
  "non-enumerable array entry",
  hiddenArrayEntry,
  /enumerable data property/,
);

const negativeZero = copy(source);
negativeZero.chain.skin.ornaments[0].angleDegrees = -0;
assert.equal(
  Object.is(
    BeefwifeDescriptor.read(negativeZero).chain.skin.ornaments[0].angleDegrees,
    -0,
  ),
  false,
);
checks++;

const reordered = copy(source);
reordered.definitions.shapes = Object.fromEntries(
  Object.entries(reordered.definitions.shapes).reverse(),
);
assert.equal(
  BeefwifeDescriptor.stringify(reordered),
  BeefwifeDescriptor.stringify(source),
);
checks++;

assert.throws(() => BeefwifeDescriptor.parse("{"), /invalid JSON/);
assert.throws(() => BeefwifeDescriptor.parse({}), /must be a string/);
assert.throws(() => BeefwifeDescriptor.stringify(source, 11), /indentation/);
checks += 3;

console.log(`descriptor schema: ${checks} adversarial checks passed`);
