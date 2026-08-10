/**
 * The v1 schema tree: every field a beefwife descriptor may hold, its kind,
 * and its bounds. Length-dimensioned fields carry `length`, the power of the
 * resize factor they scale by. Reading and resizing a descriptor against this
 * tree is beefwife-descriptor.js.
 */

const BeefwifeSchema = (() => {
  const VERSION = 1;
  const SECTIONS = ["head", "trunk", "tail"];
  const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
  const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const LIMITS = Object.freeze({
    name: 64,
    definitions: 256,
    chunks: 256,
    placements: 512,
    instances: 512,
    path: 65536,
    pathTotal: 1048576,
  });

  const number = (min, max, integer = false) => ({
    kind: "number",
    min,
    max,
    integer,
  });
  /* length is the field's length-dimension exponent; `scale` multiplies the
     value by factor ** length. Untagged numbers are size-invariant. */
  const px = (min, max) => ({ ...number(min, max), length: 1 });
  const perPx = (min, max) => ({ ...number(min, max), length: -1 });
  const string = (minLength, maxLength, pattern = null) => ({
    kind: "string",
    minLength,
    maxLength,
    pattern,
  });
  const choice = (...values) => ({ kind: "choice", values });
  const literal = (value) => ({ kind: "literal", value });
  const nullable = (item) => ({ kind: "nullable", item });
  const object = (fields) => ({ kind: "object", fields });
  const array = (item, maxLength) => ({ kind: "array", item, maxLength });
  const record = (item, minLength = 0) => ({
    kind: "record",
    item,
    minLength,
    maxLength: LIMITS.definitions,
  });

  const id = string(1, 64, ID_PATTERN);
  const ratio = number(0, 1);
  /* Placement scales carry the px dimension: shape paths are local units,
     drawn px = path units x scale. plantedScale is a ratio on top of
     foot.scale and stays invariant. */
  const pxScale = px(0.001, 1000);
  const ratioScale = number(0.001, 100);
  const distance = px(1e-6, 10000);
  const offset = px(-10000, 10000);
  /* Whitespace is length without content, and a paint or path made of it
     draws nothing while passing every length check. `validate` rejects it; the
     tag is what lets `bounds` say so. */
  const nonBlank = (node) => ({ ...node, blank: false });
  const colour = nullable(nonBlank(string(1, 256)));

  const material = object({
    velocityRetention: ratio,
    jointCorrection: ratio,
    linkCorrection: number(0.001, 1),
    grip: object({
      forward: ratio,
      backward: ratio,
      lateral: ratio,
    }),
  });

  const shape = object({ path: nonBlank(string(1, LIMITS.path)) });
  const paint = object({
    fill: colour,
    stroke: nullable(
      object({
        colour: string(1, 256),
        width: number(0, 1000),
      }),
    ),
  });
  const span = object({
    start: px(0, 1000),
    end: px(0, 1000),
  });
  /* Head and trunk must exist for the chain to have a direction and a middle;
     the tail may be empty. The node carries the floor so `bounds` reports the
     range a caller can actually use. Their total is capped as well, which no
     per-field bound can express. */
  const sectionOf = (minChunks) =>
    object({
      chunks: number(minChunks, LIMITS.chunks, true),
      spacing: px(1e-6, 1000),
      material: id,
      motionScale: object({
        bend: number(0, 4),
        thrust: number(0, 4),
        gather: number(0, 4),
        contact: number(0, 4),
      }),
      profile: object({
        ribbonWidth: span,
        plateScale: object({
          start: number(0, 100),
          end: number(0, 100),
        }),
      }),
    });

  const anchor = object({
    section: nullable(choice(...SECTIONS)),
    from: choice("head", "tail"),
    offset: number(0, LIMITS.chunks - 1, true),
  });
  const repeat = object({
    count: nullable(number(1, LIMITS.chunks, true)),
    step: number(1, LIMITS.chunks, true),
  });
  const plate = object({
    id,
    shape: id,
    paint: id,
    at: anchor,
    repeat,
    scale: pxScale,
  });
  const ornament = object({
    id,
    shape: id,
    paint: id,
    at: anchor,
    repeat,
    side: choice("left", "right", "both"),
    layer: choice("under", "over"),
    offset: object({ forward: offset, outward: offset }),
    angleDegrees: number(-180, 180),
    scale: pxScale,
    source: ratio,
    react: number(-4, 4),
    recover: number(0, 1000),
    wobble: ratio,
  });

  const schema = object({
    schemaVersion: literal(VERSION),
    name: string(1, LIMITS.name, NAME_PATTERN),
    definitions: object({
      materials: record(material, 1),
      shapes: record(shape, 1),
      paints: record(paint, 1),
    }),
    gait: object({
      cyclesPerSecond: number(0, 100),
      /* Aliasing depends on lag x spacing x harmonic, so no per-pixel bound
         can express it; this one only keeps the value sane and scalable. */
      phaseLagRadiansPerPixel: perPx(-1000, 1000),
      bend: object({
        amplitude: number(0, 10),
        harmonic: number(1, 8, true),
      }),
      thrust: object({
        acceleration: px(0, 1e6),
        harmonic: number(1, 8, true),
        phaseOffset: number(-Math.PI, Math.PI),
        dutyCycle: number(0.01, 1),
      }),
      gather: object({
        amplitude: number(0, 0.95),
        harmonic: number(1, 8, true),
        phaseOffset: number(-Math.PI, Math.PI),
      }),
      contact: object({
        amplitude: ratio,
        harmonic: number(1, 8, true),
        phaseOffset: number(-Math.PI, Math.PI),
        dutyCycle: number(0.01, 1),
      }),
    }),
    chain: object({
      physics: object({
        autoLift: object({
          amount: ratio,
          share: ratio,
          rate: number(0, 1000),
        }),
        steering: object({
          gain: number(0, 100),
          limit: number(0, Math.PI),
          rate: number(0, 1000),
        }),
      }),
      breathing: ratio,
      sections: object({
        head: sectionOf(1),
        trunk: sectionOf(1),
        tail: sectionOf(0),
      }),
      skin: object({
        /* -1 shrinks plates to nothing at full grip; below it they would
           draw mirrored, so the bound is the last meaningful value. */
        loadScale: number(-1, 10),
        ribbon: object({ paint: id }),
        /* One plate per chunk at most, so the chain length is the real
           ceiling; `placements` would report one `read` never accepts. */
        plates: array(plate, LIMITS.chunks),
        ornaments: array(ornament, LIMITS.placements),
      }),
    }),
    legs: object({
      section: choice(...SECTIONS),
      pairs: number(0, 128, true),
      reach: distance,
      spread: number(0, 4),
      lead: ratio,
      fold: ratio,
      jointBend: number(-1, 1),
      jointLean: number(-1, 1),
      jointLeanCenter: number(-1, 1),
      sidePhase: ratio,
      liftThreshold: ratio,
      swingCycles: number(0.001, 60),
      swingArc: number(0, 4),
      jitter: ratio,
      skin: object({
        limbPaint: id,
        limbWidth: px(0, 1000),
        foot: object({
          shape: id,
          paint: id,
          scale: pxScale,
          plantedScale: ratioScale,
        }),
      }),
    }),
  });

  return Object.freeze({ VERSION, LIMITS, SECTIONS, ID_PATTERN, schema });
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeSchema;
}
