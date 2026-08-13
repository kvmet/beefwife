/** Public lifecycle for one schema-v1 beefwife. */

import { PIXI, available } from "./pixi.mjs";
import * as Model from "./model.mjs";
import { Gait } from "./drive.mjs";
import { Body } from "./body.mjs";
import { Legs } from "./legs.mjs";
import { Skin } from "./skin.mjs";
import Graphics from "./graphics.mjs";

export * as Descriptor from "./descriptor.mjs";

class HeadlessContainer {
  destroy() {
    this.destroyed = true;
  }
}
const Container = available ? PIXI.Container : HeadlessContainer;

/* One compiled model per descriptor, shared by every creature built from it.
   `Model.compile` deep-freezes what it returns, so topology is the same object
   for the whole cast and only body state differs between instances. Held
   weakly against the descriptor the caller passed, so a model lives exactly as
   long as something still refers to what made it.

   A descriptor is a value. Mutating one in place and handing the same object
   back returns the model compiled for its old contents; pass a replacement
   instead. */
const compiled = new WeakMap();

const modelFor = (descriptor) => {
  /* A primitive key reads as a miss rather than throwing, so an invalid
     descriptor reaches the validator and fails there as it always did. */
  const held = compiled.get(descriptor);
  if (held) return held;
  const model = Model.compile(descriptor);
  Graphics.prepare(model);
  compiled.set(descriptor, model);
  return model;
};

const MAX_WORLD_COORDINATE = 1e9;
const MIN_PIXEL_RESOLUTION = 1e-6;
const MAX_PIXEL_RESOLUTION = 1e6;
const MAX_PERSPECTIVE = 1e6;
const TAU = Math.PI * 2;
const OPTION_KEYS = new Set([
  "position",
  "direction",
  "phase",
  "random",
  "render",
]);
const RENDER_KEYS = new Set([
  "roundVertices",
  "pixelResolution",
  "kneeProjection",
]);
const KNEE_PROJECTION_KEYS = new Set([
  "centerX",
  "centerY",
  "perspective",
  "maxOffset",
]);
const RESET_KEYS = new Set(["position", "direction", "phase"]);
const CONTROL_KEYS = new Set(["throttle", "direction"]);

const plainObject = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${path} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError(`${path} must be a plain object`);
  return value;
};

const optionsOf = (value, allowed, path) => {
  if (value === undefined) return {};
  const options = plainObject(value, path);
  for (const key in options) {
    if (!allowed.has(key)) throw new TypeError(`${path}.${key} is unknown`);
  }
  return options;
};

/* Only an absent field takes the default. `??` would let null through as
   well, and null is what an emptied number input hands back. */
const defaulted = (value, fallback) => (value === undefined ? fallback : value);

const finite = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${path} must be a finite number`);
  return value;
};

const renderOptionsOf = (value) => {
  if (value === undefined) return null;
  const render = optionsOf(value, RENDER_KEYS, "options.render");
  if (
    render.roundVertices !== undefined &&
    typeof render.roundVertices !== "boolean"
  )
    throw new TypeError("options.render.roundVertices must be a boolean");
  if (render.pixelResolution !== undefined) {
    const pixelResolution = finite(
      render.pixelResolution,
      "options.render.pixelResolution",
    );
    if (pixelResolution <= 0)
      throw new RangeError("options.render.pixelResolution must be positive");
    /* Snapping multiplies a world coordinate by this and divides by it, so a
       value outside this range turns finite vertices into infinities. Real
       displays sit near 1. */
    if (
      pixelResolution < MIN_PIXEL_RESOLUTION ||
      pixelResolution > MAX_PIXEL_RESOLUTION
    )
      throw new RangeError(
        `options.render.pixelResolution must be from ${MIN_PIXEL_RESOLUTION} to ${MAX_PIXEL_RESOLUTION}`,
      );
  }
  const projection = render.kneeProjection;
  if (projection !== undefined && projection !== null) {
    optionsOf(
      projection,
      KNEE_PROJECTION_KEYS,
      "options.render.kneeProjection",
    );
    // The projection center is a world point, so it lives where a body may.
    worldPoint(
      { x: projection.centerX, y: projection.centerY },
      null,
      "options.render.kneeProjection.center",
    );
    const perspective = finite(
      projection.perspective,
      "options.render.kneeProjection.perspective",
    );
    if (perspective < 0)
      throw new RangeError(
        "options.render.kneeProjection.perspective must be nonnegative",
      );
    /* The knee moves by view distance times elbow height times this, and
       both distances span the world, so a larger factor overflows. */
    if (perspective > MAX_PERSPECTIVE)
      throw new RangeError(
        `options.render.kneeProjection.perspective must be at most ${MAX_PERSPECTIVE}`,
      );
    if (projection.maxOffset !== undefined) {
      const maxOffset = finite(
        projection.maxOffset,
        "options.render.kneeProjection.maxOffset",
      );
      if (maxOffset < 0)
        throw new RangeError(
          "options.render.kneeProjection.maxOffset must be nonnegative",
        );
      if (maxOffset > MAX_WORLD_COORDINATE)
        throw new RangeError(
          `options.render.kneeProjection.maxOffset must be at most ${MAX_WORLD_COORDINATE}`,
        );
    }
  }
  return render;
};

const point = (value, fallback, path) => {
  if (value === undefined) {
    if (fallback === null) throw new TypeError(`${path} is required`);
    return { ...fallback };
  }
  const input = plainObject(value, path);
  for (const key in input) {
    if (key !== "x" && key !== "y")
      throw new TypeError(`${path}.${key} is unknown`);
  }
  return { x: finite(input.x, `${path}.x`), y: finite(input.y, `${path}.y`) };
};

const worldPoint = (value, fallback, path) => {
  const result = point(value, fallback, path);
  if (
    Math.abs(result.x) > MAX_WORLD_COORDINATE ||
    Math.abs(result.y) > MAX_WORLD_COORDINATE
  )
    throw new RangeError(
      `${path} coordinates must be from ${-MAX_WORLD_COORDINATE} to ${MAX_WORLD_COORDINATE}`,
    );
  return result;
};

const directionInto = (value, fallback, path, result) => {
  const input = value === undefined ? fallback : plainObject(value, path);
  if (value !== undefined) {
    for (const key in input) {
      if (key !== "x" && key !== "y")
        throw new TypeError(`${path}.${key} is unknown`);
    }
  }
  const inputX = finite(input.x, `${path}.x`);
  const inputY = finite(input.y, `${path}.y`);
  const scale = Math.max(Math.abs(inputX), Math.abs(inputY));
  if (!scale) throw new RangeError(`${path} must be nonzero`);
  const x = inputX / scale;
  const y = inputY / scale;
  const magnitude = Math.hypot(x, y);
  result.x = x / magnitude;
  result.y = y / magnitude;
  return result;
};
const direction = (value, fallback, path) =>
  directionInto(value, fallback, path, {});
const newPose = () => ({
  head: { x: 0, y: 0 },
  center: { x: 0, y: 0 },
  direction: { x: 0, y: 0 },
});

const bodyFitsWorld = (body) =>
  body.chain.fitsTranslation({ x: 0, y: 0 }, MAX_WORLD_COORDINATE);

const sameTopology = (before, after) =>
  ["head", "trunk", "tail"].every(
    (name) => before.sections[name].count === after.sections[name].count,
  );
/* Only the number of legs forces new foot state. A leg reads its stance from
   the model every step and reconfigure moves its anchor, so changing reach,
   spread, or even the leg section leaves planted feet where they stand and
   lets them walk to the new stance. */
const legCountKey = (model) => model.descriptor.legs.pairs;
/* Only the expanded ornament list forces new swing state. An ornament that
   moves to another chunk keeps its deflection and settles from wherever the
   new root leaves it. */
const ornamentKey = (model) =>
  model.skin.ornaments
    .map((ornament) => `${ornament.id}:${ornament.side}`)
    .join("|");

class Beefwife extends Container {
  #random;
  #requestedDirection;
  #model;
  #gait;
  #body;
  #legs;
  #skin;
  #graphics = null;
  #gone = false;
  #renderOptions = null;
  #renderState = null;
  #pose = newPose();
  #throttle;
  #stepThrottle;
  #updateDependents = (seconds) => {
    this.#throttle = this.#stepThrottle;
    this.#legs.update(seconds, this.#stepThrottle);
    this.#skin.update(seconds);
  };

  constructor(descriptor, rawOptions) {
    super();
    const options = optionsOf(rawOptions, OPTION_KEYS, "options");
    const position = worldPoint(
      options.position,
      { x: 0, y: 0 },
      "options.position",
    );
    const facing = direction(
      options.direction,
      { x: 1, y: 0 },
      "options.direction",
    );
    const phase = finite(defaulted(options.phase, 0), "options.phase");
    if (options.random !== undefined && typeof options.random !== "function")
      throw new TypeError("options.random must be a function");
    this.#random = options.random ?? Math.random;
    this.#renderOptions = renderOptionsOf(options.render);
    this.#requestedDirection = { ...facing };
    this.#model = modelFor(descriptor);
    this.#gait = new Gait(this.#model.gait, phase);
    const breathingPhase = this.#model.breathing.strain
      ? TAU * this.#sampleRandom()
      : this.#gait.phase;
    this.#body = new Body(this.#model, this.#gait, breathingPhase);
    this.#body.place(position, facing);
    if (!bodyFitsWorld(this.#body))
      throw new RangeError(
        "options.position places the body outside the world",
      );
    this.#legs = new Legs(this.#model, this.#body, this.#gait, () =>
      this.#sampleRandom(),
    );
    this.#throttle = 1;
    this.#stepThrottle = 1;
    this.#skin = new Skin(this.#model, this.#body, this.#legs);
    this.#refreshPose();
    this.label = this.#model.descriptor.name;
    /* Pixi hands the renderer to this callback, and it is the only place a
       beefwife is sure to see one; the shape frames are baked from it. */
    this.onRender = Graphics.available
      ? (renderer) => this.#syncGraphics(renderer)
      : null;
    this.#replaceGraphics();
  }

  get descriptor() {
    return this.#model.descriptor;
  }

  get restLength() {
    return this.#model.restLength;
  }

  step(rawDt, rawControls) {
    this.#live("step");
    const dt = finite(rawDt, "dt");
    if (dt < 0) throw new RangeError("dt must be nonnegative");
    const controls = optionsOf(rawControls, CONTROL_KEYS, "controls");
    const throttle = finite(
      defaulted(controls.throttle, 1),
      "controls.throttle",
    );
    if (throttle < 0 || throttle > 1)
      throw new RangeError("controls.throttle must be from 0 to 1");
    const wanted = directionInto(
      controls.direction,
      this.#requestedDirection,
      "controls.direction",
      this.#requestedDirection,
    );
    this.#stepThrottle = throttle;
    const stepped = this.#body.step(
      dt,
      throttle,
      wanted,
      this.#updateDependents,
    );
    if (stepped) {
      const correction = this.#body.chain.worldCorrection(MAX_WORLD_COORDINATE);
      if (correction.x || correction.y) {
        this.#body.chain.translate(correction);
        this.#legs.translate(correction);
        this.#skin.translate(correction);
      }
      this.#refreshPose();
    }
  }

  setDescriptor(descriptor) {
    this.#live("setDescriptor");
    const nextModel = modelFor(descriptor);
    const nextGait = new Gait(nextModel.gait, this.#gait.phase);
    const breathingPhase =
      !this.#model.breathing.strain && nextModel.breathing.strain
        ? TAU * this.#sampleRandom()
        : this.#body.breathingPhase;
    /* Every construction happens before the first assignment, so a rejected
       replacement leaves the instance untouched. */
    const compatible = sameTopology(this.#model, nextModel);
    let body = this.#body;
    if (!compatible) {
      body = new Body(nextModel, nextGait, breathingPhase);
      body.adopt(this.#body);
      body.refreshContacts(this.#throttle);
      if (!bodyFitsWorld(body))
        throw new RangeError("descriptor places the body outside the world");
    }
    const nextLegs =
      legCountKey(this.#model) === legCountKey(nextModel)
        ? null
        : new Legs(nextModel, body, nextGait, () => this.#sampleRandom());
    const nextSkin =
      ornamentKey(this.#model) === ornamentKey(nextModel)
        ? null
        : new Skin(nextModel, body, nextLegs || this.#legs);
    if (compatible)
      this.#body.reconfigure(
        nextModel,
        nextGait,
        this.#throttle,
        breathingPhase,
      );
    else this.#body = body;
    if (nextLegs) this.#legs = nextLegs;
    else this.#legs.reconfigure(nextModel, this.#body, nextGait);
    if (nextSkin) this.#skin = nextSkin;
    else this.#skin.reconfigure(nextModel, this.#body, this.#legs);
    this.#model = nextModel;
    this.#gait = nextGait;
    this.#refreshPose();
    this.label = nextModel.descriptor.name;
    this.#replaceGraphics();
  }

  reset(rawOptions) {
    this.#live("reset");
    const options = optionsOf(rawOptions, RESET_KEYS, "options");
    const pose = this.#body.getPose(this.#pose);
    const position = worldPoint(
      options.position,
      pose.head,
      "options.position",
    );
    const facing = direction(
      options.direction,
      pose.direction,
      "options.direction",
    );
    const phase = finite(
      defaulted(options.phase, this.#gait.phase),
      "options.phase",
    );
    const gait = new Gait(this.#model.gait, phase);
    const breathingPhase = this.#model.breathing.strain
      ? TAU * this.#sampleRandom()
      : gait.phase;
    const body = new Body(this.#model, gait, breathingPhase);
    body.place(position, facing);
    if (!bodyFitsWorld(body))
      throw new RangeError(
        "options.position places the body outside the world",
      );
    const legs = new Legs(this.#model, body, gait, () => this.#sampleRandom());
    const skin = new Skin(this.#model, body, legs);
    if (options.direction !== undefined)
      this.#requestedDirection = { ...facing };
    this.#gait = gait;
    this.#body = body;
    this.#legs = legs;
    this.#skin = skin;
    this.#throttle = 1;
    this.#refreshPose();
    if (this.#graphics) this.#syncGraphics();
  }

  translate(rawOffset) {
    this.#live("translate");
    const offset = worldPoint(rawOffset, null, "offset");
    if (!this.#body.chain.fitsTranslation(offset, MAX_WORLD_COORDINATE))
      throw new RangeError("offset places the body outside the world");
    this.#body.chain.translate(offset);
    this.#legs.translate(offset);
    this.#skin.translate(offset);
    this.#refreshPose();
  }

  getPose() {
    return this.#pose;
  }

  /* The turn the gait asked each joint for against the turn it is making, so
     an author can see what a `gait.bend` amplitude actually buys on this body.
     Delivery is capped by `grip.lateral`, which resists the sideways motion
     bending is, and by how far the solver gets in a substep, and neither is
     visible in the descriptor. Both angles are radians, positive to the left.
     Pass an array to fill to avoid allocating one a frame. */
  getBendResponse(into) {
    this.#live("getBendResponse");
    return this.#body.bend.response(this.#body.chain, into);
  }

  destroy(options) {
    this.onRender = null;
    if (this.#graphics) {
      this.#graphics.destroy();
      this.#graphics = null;
    }
    this.#gone = true;
    super.destroy(options);
  }

  /* A destroyed instance has no scene left to keep in step with, and
     `setDescriptor` would build a second one under the dead container that
     nothing would ever free. Refuse rather than leak. */
  #live(method) {
    if (this.#gone)
      throw new Error(`${method} was called on a destroyed beefwife`);
  }

  #sampleRandom() {
    const sample = this.#random();
    if (typeof sample !== "number" || !Number.isFinite(sample))
      throw new TypeError("random() must return a finite number");
    if (sample < 0 || sample >= 1)
      throw new RangeError("random() must return a number from 0 to 1");
    return sample;
  }

  #refreshPose() {
    this.#body.getPose(this.#pose);
  }

  #replaceGraphics() {
    this.#renderState = this.#skin.writeRenderState(this.#renderState);
    if (this.#graphics) this.#graphics.adopt(this.#renderState);
    else if (Graphics.available)
      this.#graphics = new Graphics(
        this,
        this.#renderState,
        this.#renderOptions,
      );
  }

  /* Pixi runs a container's render callback whatever its visibility, so a
     creature the host has hidden would otherwise rebuild every vertex and
     place every particle for a frame nobody sees. Stepping is unaffected;
     only the drawing is skipped. */
  #syncGraphics(renderer = null) {
    const drawable = this.visible && this.renderable;
    if (drawable)
      this.#renderState = this.#skin.writeRenderState(this.#renderState);
    this.#graphics.sync(this.#renderState, renderer, drawable);
  }
}

Object.defineProperty(Beefwife, "MAX_WORLD_COORDINATE", {
  value: MAX_WORLD_COORDINATE,
  enumerable: true,
});

export { Beefwife };
