/**
 * Canonical JSON contract for a beefwife. Definitions are descriptor-local:
 * sections link physical materials, while visual placements link shapes and
 * paints. `read` validates and returns an owned value in canonical key order.
 * `scale` resizes a creature by transforming every length-dimensioned field.
 * `bounds` reports what the schema enforces for one field.
 */

const BeefwifeDescriptor = (() => {
  const Schema =
    typeof BeefwifeSchema !== "undefined"
      ? BeefwifeSchema
      : typeof module !== "undefined" && module.exports
        ? require("./beefwife-schema.js")
        : null;
  if (!Schema) throw new Error("BeefwifeSchema must load first");
  const { VERSION, LIMITS, SECTIONS, ID_PATTERN, schema } = Schema;

  const fail = (path, message) => {
    throw new Error(`${path}: ${message}`);
  };

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
      return value === null
        ? null
        : readNode(node.item, value, path, ancestors);
    if (node.kind === "literal") {
      if (value !== node.value) fail(path, `must equal ${node.value}`);
      return value;
    }
    if (node.kind === "choice") {
      if (!node.values.includes(value))
        fail(path, `must be one of ${node.values.join(", ")}`);
      return value;
    }
    if (node.kind === "number") {
      if (typeof value !== "number" || !Number.isFinite(value))
        fail(path, "must be a finite number");
      if (node.integer && !Number.isInteger(value))
        fail(path, "must be an integer");
      if (value < node.min || value > node.max)
        fail(path, `must be between ${node.min} and ${node.max}`);
      return Object.is(value, -0) ? 0 : value;
    }
    if (node.kind === "string") {
      if (typeof value !== "string") fail(path, "must be a string");
      if (value.length < node.minLength || value.length > node.maxLength)
        fail(
          path,
          `must contain ${node.minLength} to ${node.maxLength} characters`,
        );
      if (node.pattern && !node.pattern.test(value))
        fail(path, "contains characters that are not allowed");
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
          fail(path, `must contain at most ${node.maxLength} entries`);
        const keys = Reflect.ownKeys(value).filter((key) => key !== "length");
        if (keys.some((key) => typeof key !== "string"))
          fail(path, "must not contain symbol keys");
        keys.forEach((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor.enumerable || !("value" in descriptor))
            fail(
              `${path}.${String(key)}`,
              "must be an enumerable data property",
            );
        });
        for (let i = 0; i < value.length; i++)
          if (!Object.hasOwn(value, i)) fail(`${path}[${i}]`, "is missing");
        if (keys.some((key) => !/^(0|[1-9][0-9]*)$/.test(key)))
          fail(path, "must not contain named properties");
        return value.map((item, i) =>
          readNode(node.item, item, `${path}[${i}]`, ancestors),
        );
      }
      const keys = ownKeys(value, path);
      if (node.kind === "record") {
        if (keys.length < node.minLength || keys.length > node.maxLength)
          fail(
            path,
            `must contain ${node.minLength} to ${node.maxLength} definitions`,
          );
        const out = {};
        keys.sort().forEach((key) => {
          if (!ID_PATTERN.test(key))
            fail(`${path}.${key}`, "has an invalid id");
          out[key] = readNode(
            node.item,
            value[key],
            `${path}.${key}`,
            ancestors,
          );
        });
        return out;
      }

      const expected = Object.keys(node.fields);
      keys.forEach((key) => {
        if (!Object.hasOwn(node.fields, key))
          fail(`${path}.${key}`, "is unknown");
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

  const reference = (table, id, path) => {
    if (!Object.hasOwn(table, id)) fail(path, `references missing "${id}"`);
  };

  const resolvedChunks = (descriptor, placement, path) => {
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
    if (!length) fail(`${path}.at`, "cannot address an empty scope");
    const offset = placement.at.offset;
    if (offset >= length) fail(`${path}.at.offset`, "falls outside its scope");
    const direction = placement.at.from === "head" ? 1 : -1;
    const localStart = direction > 0 ? offset : length - 1 - offset;
    const available =
      Math.floor((length - 1 - offset) / placement.repeat.step) + 1;
    const count = placement.repeat.count ?? available;
    if (count > available)
      fail(`${path}.repeat.count`, "runs outside its scope");
    const base = section ? offsets[section] : 0;
    return Array.from(
      { length: count },
      (_, i) => base + localStart + direction * i * placement.repeat.step,
    );
  };

  const validate = (descriptor) => {
    const { definitions, chain, legs } = descriptor;
    const sections = chain.sections;
    const total = SECTIONS.reduce(
      (sum, name) => sum + sections[name].chunks,
      0,
    );
    if (total < 2 || total > LIMITS.chunks)
      fail("$.chain.sections", `must contain 2 to ${LIMITS.chunks} chunks`);
    SECTIONS.forEach((name) =>
      reference(
        definitions.materials,
        sections[name].material,
        `$.chain.sections.${name}.material`,
      ),
    );
    SECTIONS.forEach((name) => {
      const scale = sections[name].motionScale;
      if (descriptor.gait.gather.amplitude * scale.gather >= 1)
        fail(
          `$.chain.sections.${name}.motionScale.gather`,
          "makes the gathered link length zero or negative",
        );
      if (descriptor.gait.contact.amplitude * scale.contact > 1)
        fail(
          `$.chain.sections.${name}.motionScale.contact`,
          "makes ground contact negative",
        );
    });
    const references = [
      [
        definitions.paints,
        chain.skin.ribbon.paint,
        "$.chain.skin.ribbon.paint",
      ],
      [definitions.paints, legs.skin.limbPaint, "$.legs.skin.limbPaint"],
      [definitions.shapes, legs.skin.foot.shape, "$.legs.skin.foot.shape"],
      [definitions.paints, legs.skin.foot.paint, "$.legs.skin.foot.paint"],
    ];
    references.forEach((args) => reference(...args));

    const placementIds = new Set();
    const occupied = new Map();
    chain.skin.plates.forEach((entry, i) => {
      const path = `$.chain.skin.plates[${i}]`;
      if (placementIds.has(entry.id)) fail(`${path}.id`, "must be unique");
      placementIds.add(entry.id);
      reference(definitions.shapes, entry.shape, `${path}.shape`);
      reference(definitions.paints, entry.paint, `${path}.paint`);
      resolvedChunks(descriptor, entry, path).forEach((chunk) => {
        if (occupied.has(chunk))
          fail(
            `${path}.at`,
            `overlaps plate "${occupied.get(chunk)}" at chunk ${chunk}`,
          );
        occupied.set(chunk, entry.id);
      });
    });

    let ornamentInstances = 0;
    chain.skin.ornaments.forEach((entry, i) => {
      const path = `$.chain.skin.ornaments[${i}]`;
      if (placementIds.has(entry.id)) fail(`${path}.id`, "must be unique");
      placementIds.add(entry.id);
      reference(definitions.shapes, entry.shape, `${path}.shape`);
      reference(definitions.paints, entry.paint, `${path}.paint`);
      ornamentInstances +=
        resolvedChunks(descriptor, entry, path).length *
        (entry.side === "both" ? 2 : 1);
      if (ornamentInstances > LIMITS.instances)
        fail(
          "$.chain.skin.ornaments",
          `must expand to at most ${LIMITS.instances} instances`,
        );
    });

    if (legs.pairs && !sections[legs.section].chunks)
      fail("$.legs.section", "cannot attach legs to an empty section");

    Object.entries(definitions.paints).forEach(([name, entry]) => {
      if (entry.fill !== null && !entry.fill.trim())
        fail(`$.definitions.paints.${name}.fill`, "must not be blank");
      if (entry.stroke !== null && !entry.stroke.colour.trim())
        fail(`$.definitions.paints.${name}.stroke.colour`, "must not be blank");
      if (entry.fill === null && (entry.stroke === null || !entry.stroke.width))
        fail(
          `$.definitions.paints.${name}`,
          "must draw a fill or visible stroke",
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
        `paths must total at most ${LIMITS.pathTotal} characters`,
      );
    return descriptor;
  };

  const read = (value) => validate(readNode(schema, value, "$", new WeakSet()));

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
      fail("$", "bounds path must be a non-empty string");
    const found = resolve(path.replace(/\[\]/g, ".[]").split("."));
    if (!found) fail(`$.${path}`, "is not a field in this schema");
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
      fail("$", "scale factor must be a finite number greater than 0");
    return read(scaleNode(schema, read(descriptor), factor));
  };

  const parse = (text) => {
    if (typeof text !== "string") fail("$", "JSON input must be a string");
    let value;
    try {
      value = JSON.parse(text);
    } catch (error) {
      fail("$", `invalid JSON: ${error.message}`);
    }
    return read(value);
  };

  const stringify = (value, space = 2) => {
    if (!Number.isInteger(space) || space < 0 || space > 10)
      fail("$", "indentation must be an integer from 0 to 10");
    return JSON.stringify(read(value), null, space);
  };

  return Object.freeze({
    VERSION,
    LIMITS,
    read,
    parse,
    stringify,
    scale,
    bounds,
  });
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeDescriptor;
}
