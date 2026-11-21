/**
 * Canonical JSON contract for a beefwife. Definitions are descriptor-local:
 * sections link physical materials, while visual placements link shapes and
 * paints. `read` validates and returns an owned value in canonical key order.
 * `scale` resizes a creature by transforming every length-dimensioned field.
 * `bounds` reports what the schema enforces for one field.
 */

import {
  VERSION,
  LIMITS,
  SECTIONS,
  ID_PATTERN,
  ID_RULE,
  NAME_PATTERN,
  schema,
} from "./schema.mjs";
import { MAX_CHANNEL_RATE } from "./limits.mjs";

/* `path` and `rule` let `scale` restate a range error in terms of its factor. */
const fail = (path, rule) => {
  throw Object.assign(new Error(`${path}: ${rule}`), { path, rule });
};

/* Bounds print at six digits, so -Math.PI reads -3.14159. A given value
   prints whole: rounded, one just past a bound would read as equal to it. */
const bound = (number) => String(Number(number.toPrecision(6)));
const shown = (value) => {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  return typeof value;
};

const oneOf = (values) => {
  const quoted = values.map((value) => JSON.stringify(value));
  if (quoted.length < 3) return quoted.join(" or ");
  return `${quoted.slice(0, -1).join(", ")}, or ${quoted.at(-1)}`;
};

/* Twelve digits drop float noise such as 0.30000000000000004 and keep a
   product just past 1 from reading as 1. */
const product = (a, b) =>
  `${shown(a)} × ${shown(b)} = ${Number((a * b).toPrecision(12))}`;

const plainObject = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(path, "must be an object");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    fail(path, "must be a plain JSON object");
};

const ownKeys = (value, path) => {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string"))
    fail(path, "must not contain symbol keys");
  keys.forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !("value" in descriptor))
      fail(`${path}.${key}`, "must be an enumerable data property");
  });
  return keys;
};

const readNode = (node, value, path, ancestors) => {
  if (node.kind === "nullable")
    return value === null ? null : readNode(node.item, value, path, ancestors);
  if (node.kind === "literal") {
    if (value !== node.value)
      fail(path, `must be ${node.value} (got ${shown(value)})`);
    return value;
  }
  if (node.kind === "choice") {
    if (!node.values.includes(value))
      fail(path, `must be ${oneOf(node.values)} (got ${shown(value)})`);
    return value;
  }
  if (node.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value))
      fail(path, "must be a finite number");
    if (node.integer && !Number.isInteger(value))
      fail(path, `must be an integer (got ${shown(value)})`);
    if (value < node.min || value > node.max)
      fail(
        path,
        `must be from ${bound(node.min)} to ${bound(node.max)} (got ${shown(value)})`,
      );
    return Object.is(value, -0) ? 0 : value;
  }
  if (node.kind === "string") {
    if (typeof value !== "string") fail(path, "must be a string");
    if (value.length < node.minLength || value.length > node.maxLength)
      fail(
        path,
        `must contain ${node.minLength} to ${node.maxLength} characters (got ${value.length})`,
      );
    if (node.pattern && !node.pattern.test(value))
      fail(path, `${node.rule} (got ${shown(value)})`);
    return value;
  }

  if (node.kind === "array") {
    if (!Array.isArray(value)) fail(path, "must be an array");
  } else {
    plainObject(value, path);
  }
  if (ancestors.has(value)) fail(path, "must not contain a cycle");
  ancestors.add(value);
  try {
    if (node.kind === "array") {
      if (value.length > node.maxLength)
        fail(
          path,
          `must contain at most ${node.maxLength} entries (got ${value.length})`,
        );
      const keys = Reflect.ownKeys(value).filter((key) => key !== "length");
      if (keys.some((key) => typeof key !== "string"))
        fail(path, "must not contain symbol keys");
      keys.forEach((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor.enumerable || !("value" in descriptor))
          fail(`${path}.${String(key)}`, "must be an enumerable data property");
      });
      for (let i = 0; i < value.length; i++)
        if (!Object.hasOwn(value, i))
          fail(`${path}[${i}]`, "is an empty slot; arrays must not have holes");
      if (keys.some((key) => !/^(0|[1-9][0-9]*)$/.test(key)))
        fail(path, "must contain only numbered items");
      return value.map((item, i) =>
        readNode(node.item, item, `${path}[${i}]`, ancestors),
      );
    }
    const keys = ownKeys(value, path);
    if (node.kind === "record") {
      if (keys.length < node.minLength || keys.length > node.maxLength)
        fail(
          path,
          `must contain ${node.minLength} to ${node.maxLength} definitions (got ${keys.length})`,
        );
      const out = {};
      keys.sort().forEach((key) => {
        if (!ID_PATTERN.test(key)) fail(`${path}.${key}`, `id ${ID_RULE}`);
        out[key] = readNode(node.item, value[key], `${path}.${key}`, ancestors);
      });
      return out;
    }

    const expected = Object.keys(node.fields);
    keys.forEach((key) => {
      if (!Object.hasOwn(node.fields, key))
        fail(`${path}.${key}`, "is not a known field");
    });
    const out = {};
    expected.forEach((key) => {
      if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "is required");
      out[key] = readNode(
        node.fields[key],
        value[key],
        `${path}.${key}`,
        ancestors,
      );
    });
    return out;
  } finally {
    ancestors.delete(value);
  }
};

const undefinedIn = (definitions, table, id) =>
  Object.hasOwn(definitions[table], id)
    ? null
    : `${shown(id)} is not defined in $.definitions.${table}`;

const reference = (definitions, table, id, path) => {
  const problem = undefinedIn(definitions, table, id);
  if (problem) fail(path, problem);
};

/* Chunks a placement covers, or null when `flag` dropped it. A count that
   overruns is trimmed to the copies that fit. */
const resolvedChunks = (descriptor, placement, path, flag) => {
  const sections = descriptor.chain.sections;
  const offsets = {
    head: 0,
    trunk: sections.head.chunks,
    tail: sections.head.chunks + sections.trunk.chunks,
  };
  const section = placement.at.section;
  const length = section
    ? sections[section].chunks
    : SECTIONS.reduce((sum, name) => sum + sections[name].chunks, 0);
  if (!length) {
    flag(`${path}.at.section`, `${shown(section)} has no chunks`, NOT_DRAWN);
    return null;
  }
  const area = section ? `the ${section}` : "the chain";
  const offset = placement.at.offset;
  if (offset >= length) {
    flag(
      `${path}.at.offset`,
      `must be at most ${length - 1}, the last chunk of ${area} (got ${offset})`,
      NOT_DRAWN,
    );
    return null;
  }
  const direction = placement.at.from === "head" ? 1 : -1;
  const localStart = direction > 0 ? offset : length - 1 - offset;
  const step = placement.repeat.step;
  const available = Math.floor((length - 1 - offset) / step) + 1;
  let count = placement.repeat.count ?? available;
  if (count > available) {
    const copies = available === 1 ? "copy" : "copies";
    const spacing = step === 1 ? "in a row" : `${step} chunks apart`;
    flag(
      `${path}.repeat.count`,
      `must be at most ${available} (got ${count}); from offset ${offset}, ${area} fits ${available} ${copies} ${spacing}`,
      `Drawn with ${available} ${copies}.`,
    );
    count = available;
    placement.repeat.count = count;
  }
  const base = section ? offsets[section] : 0;
  return Array.from(
    { length: count },
    (_, i) => base + localStart + direction * i * step,
  );
};

const NOT_DRAWN = "Not drawn.";

/* `flag` reports a problem the creature can still be drawn without: `read`
   throws on it, and `repair` records it and applies the repair it names. */
const validate = (descriptor, flag) => {
  const { definitions, chain, gait, legs } = descriptor;
  const sections = chain.sections;
  const total = SECTIONS.reduce((sum, name) => sum + sections[name].chunks, 0);
  if (total < 2 || total > LIMITS.chunks)
    fail(
      "$.chain.sections",
      `chunk counts must total 2 to ${LIMITS.chunks} (got ${total})`,
    );
  SECTIONS.forEach((name) =>
    reference(
      definitions,
      "materials",
      sections[name].material,
      `$.chain.sections.${name}.material`,
    ),
  );
  SECTIONS.forEach((name) => {
    const scale = sections[name].motionScale;
    const { gather, contact } = descriptor.gait;
    if (gather.amplitude * scale.gather >= 1)
      fail(
        `$.chain.sections.${name}.motionScale.gather`,
        `gait.gather.amplitude × motionScale.gather must be less than 1 (got ${product(gather.amplitude, scale.gather)})`,
      );
    if (contact.amplitude * scale.contact > 1)
      fail(
        `$.chain.sections.${name}.motionScale.contact`,
        `gait.contact.amplitude × motionScale.contact must be at most 1 (got ${product(contact.amplitude, scale.contact)})`,
      );
  });
  const references = [
    ["paints", chain.skin.ribbon.paint, "$.chain.skin.ribbon.paint"],
    ["paints", legs.skin.limbPaint, "$.legs.skin.limbPaint"],
    ["shapes", legs.skin.foot.shape, "$.legs.skin.foot.shape"],
    ["paints", legs.skin.foot.paint, "$.legs.skin.foot.paint"],
  ];
  references.forEach((args) => reference(definitions, ...args));

  const placementIds = new Set();
  /* Chunks a kept placement covers, or null when it is dropped. */
  const placed = (entry, path) => {
    if (placementIds.has(entry.id)) {
      flag(
        `${path}.id`,
        `${shown(entry.id)} is already used by another plate or ornament`,
        NOT_DRAWN,
      );
      return null;
    }
    for (const table of ["shapes", "paints"]) {
      const key = table.slice(0, -1);
      const problem = undefinedIn(definitions, table, entry[key]);
      if (problem) {
        flag(`${path}.${key}`, problem, NOT_DRAWN);
        return null;
      }
    }
    const chunks = resolvedChunks(descriptor, entry, path, flag);
    if (chunks) placementIds.add(entry.id);
    return chunks;
  };

  const occupied = new Map();
  chain.skin.plates = chain.skin.plates.filter((entry, i) => {
    const path = `$.chain.skin.plates[${i}]`;
    const chunks = placed(entry, path);
    if (!chunks) return false;
    const taken = chunks.find((chunk) => occupied.has(chunk));
    if (taken !== undefined) {
      flag(
        `${path}.at`,
        `must not overlap plate ${shown(occupied.get(taken))}; both cover chunk ${taken}`,
        NOT_DRAWN,
      );
      placementIds.delete(entry.id);
      return false;
    }
    chunks.forEach((chunk) => occupied.set(chunk, entry.id));
    return true;
  });

  const kept = [];
  chain.skin.ornaments.forEach((entry, i) => {
    const chunks = placed(entry, `$.chain.skin.ornaments[${i}]`);
    if (chunks)
      kept.push({
        entry,
        count: chunks.length * (entry.side === "both" ? 2 : 1),
      });
  });
  const ornamentCount = kept.reduce((sum, { count }) => sum + count, 0);
  if (ornamentCount > LIMITS.instances) {
    flag(
      "$.chain.skin.ornaments",
      `must place at most ${LIMITS.instances} ornaments, counting repeats and both sides (got ${ornamentCount})`,
      "Ornaments past the limit are not drawn.",
    );
    let running = 0;
    const within = kept.findIndex(
      ({ count }) => (running += count) > LIMITS.instances,
    );
    kept.length = within;
  }
  chain.skin.ornaments = kept.map(({ entry }) => entry);

  ["bend", "thrust", "gather", "contact"].forEach((channel) => {
    const harmonic = gait[channel].harmonic;
    if (gait.cyclesPerSecond * harmonic > MAX_CHANNEL_RATE)
      fail(
        `$.gait.${channel}.harmonic`,
        `harmonic × gait.cyclesPerSecond must be at most ${bound(MAX_CHANNEL_RATE)} (got ${product(harmonic, gait.cyclesPerSecond)})`,
      );
  });

  if (legs.pairs && !sections[legs.section].chunks) {
    flag(
      "$.legs.section",
      `${shown(legs.section)} has no chunks to carry legs`,
      "Legs are not drawn.",
    );
    legs.pairs = 0;
  }

  Object.entries(definitions.paints).forEach(([name, entry]) => {
    if (entry.fill !== null && !entry.fill.trim())
      fail(`$.definitions.paints.${name}.fill`, "must not be blank");
    if (entry.stroke !== null && !entry.stroke.colour.trim())
      fail(`$.definitions.paints.${name}.stroke.colour`, "must not be blank");
    if (entry.fill === null && (entry.stroke === null || !entry.stroke.width))
      fail(
        `$.definitions.paints.${name}`,
        "needs a fill, or a stroke wider than 0",
      );
  });
  let pathTotal = 0;
  Object.entries(definitions.shapes).forEach(([name, entry]) => {
    if (!entry.path.trim())
      fail(`$.definitions.shapes.${name}.path`, "must not be blank");
    pathTotal += entry.path.length;
  });
  if (pathTotal > LIMITS.pathTotal)
    fail(
      "$.definitions.shapes",
      `paths must total at most ${LIMITS.pathTotal} characters (got ${pathTotal})`,
    );
  return descriptor;
};

const read = (value) =>
  validate(readNode(schema, value, "$", new WeakSet()), fail);

/* For an editor's live preview: problems that only cost drawing are
   repaired instead of thrown, so a half-finished edit still draws. The file
   stays invalid until they are fixed, and `read` still rejects it. */
const repair = (value) => {
  const warnings = [];
  const descriptor = validate(
    readNode(schema, value, "$", new WeakSet()),
    (path, rule, repaired) =>
      warnings.push(Object.freeze({ path, rule, repaired })),
  );
  return { descriptor, warnings: Object.freeze(warnings) };
};

/* Field constraints for editors, so a caller reads one field's range from
   the schema that enforces it rather than keeping a second copy. Paths name
   fields with dots, an array item with [], and a record entry with *. */
const resolve = (segments) => {
  let node = schema;
  for (const segment of segments) {
    while (node.kind === "nullable") node = node.item;
    if (node.kind === "object" && Object.hasOwn(node.fields, segment))
      node = node.fields[segment];
    else if (node.kind === "record" && segment === "*") node = node.item;
    else if (node.kind === "array" && segment === "[]") node = node.item;
    else return null;
  }
  const nullable = node.kind === "nullable";
  return { node: nullable ? node.item : node, nullable };
};

const shapeOf = (node) => {
  if (node.kind === "number")
    return {
      kind: "number",
      min: node.min,
      max: node.max,
      integer: node.integer,
    };
  if (node.kind === "string")
    return {
      kind: "string",
      minLength: node.minLength,
      maxLength: node.maxLength,
      /* A copy: the schema's own RegExp is what `read` tests against, and a
         caller that reassigned its `test` would switch validation off for
         every descriptor in the process. */
      pattern:
        node.pattern && new RegExp(node.pattern.source, node.pattern.flags),
      blankAllowed: node.blank !== false,
    };
  if (node.kind === "choice")
    return { kind: "choice", values: Object.freeze([...node.values]) };
  if (node.kind === "literal") return { kind: "literal", value: node.value };
  if (node.kind === "object")
    return {
      kind: "object",
      fields: Object.freeze(Object.keys(node.fields)),
    };
  if (node.kind === "record")
    return {
      kind: "record",
      minEntries: node.minLength,
      maxEntries: node.maxLength,
      keyPattern: new RegExp(ID_PATTERN.source, ID_PATTERN.flags),
    };
  return { kind: "array", maxLength: node.maxLength };
};

const bounds = (path) => {
  if (typeof path !== "string" || !path)
    fail("bounds", "path must be a non-empty string");
  const found = resolve(path.replace(/\[\]/g, ".[]").split("."));
  if (!found) fail("bounds", `${shown(path)} is not a descriptor field`);
  return Object.freeze({ ...shapeOf(found.node), nullable: found.nullable });
};

const scaleNode = (node, value, factor) => {
  if (node.kind === "nullable")
    return value === null ? null : scaleNode(node.item, value, factor);
  if (node.kind === "number")
    return node.length ? value * factor ** node.length : value;
  if (node.kind === "object") {
    const out = {};
    Object.keys(node.fields).forEach((key) => {
      out[key] = scaleNode(node.fields[key], value[key], factor);
    });
    return out;
  }
  if (node.kind === "record") {
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = scaleNode(node.item, value[key], factor);
    });
    return out;
  }
  if (node.kind === "array")
    return value.map((item) => scaleNode(node.item, item, factor));
  return value;
};

/* Resizes the creature: the pose trace scales by factor with timing
   unchanged. Re-reading rejects any product outside its field's bounds. */
const scale = (descriptor, factor) => {
  if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0)
    fail("scale", "factor must be a finite number greater than 0");
  const source = read(descriptor);
  const scaled = scaleNode(schema, source, factor);
  const worldPaints = new Set([
    source.chain.skin.ribbon.paint,
    source.legs.skin.limbPaint,
  ]);
  const placements = [
    scaled.legs.skin.foot,
    ...scaled.chain.skin.plates,
    ...scaled.chain.skin.ornaments,
  ];
  const shapePaints = new Set(placements.map(({ paint }) => paint));
  for (const id of shapePaints) {
    const paint = source.definitions.paints[id];
    if (!paint.stroke || paint.stroke.width === 0 || factor === 1) continue;
    // Shape strokes already grow with placement scale; mesh strokes do not.
    let shapeId = id;
    if (worldPaints.has(id)) {
      let suffix = 1;
      do {
        shapeId = `shape-paint-${suffix++}`;
      } while (Object.hasOwn(scaled.definitions.paints, shapeId));
      for (const placement of placements)
        if (placement.paint === id) placement.paint = shapeId;
    }
    scaled.definitions.paints[shapeId] = paint;
  }
  try {
    return read(scaled);
  } catch (error) {
    if (!error.path) throw error;
    fail("scale", `with factor ${shown(factor)}, ${error.path} ${error.rule}`);
  }
};

const parse = (text) => {
  if (typeof text !== "string") fail("parse", "text must be a string");
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail("parse", `text is not valid JSON: ${error.message}`);
  }
  return read(value);
};

const stringify = (value, space = 2) => {
  if (!Number.isInteger(space) || space < 0 || space > 10)
    fail("stringify", "space must be an integer from 0 to 10");
  return JSON.stringify(read(value), null, space);
};

export {
  VERSION,
  LIMITS,
  ID_PATTERN,
  NAME_PATTERN,
  read,
  repair,
  parse,
  stringify,
  scale,
  bounds,
};
