/** Public lifecycle for one schema-v1 beefwife. */

const Beefwife = (() => {
  const commonJS = typeof module !== "undefined" && module.exports;
  const Model =
    typeof BeefwifeModel !== "undefined"
      ? BeefwifeModel
      : commonJS
        ? require("./beefwife-model.js")
        : null;
  const Gait =
    typeof BeefwifeGait !== "undefined"
      ? BeefwifeGait
      : commonJS
        ? require("./beefwife-drive.js").BeefwifeGait
        : null;
  const Body =
    typeof BeefwifeBody !== "undefined"
      ? BeefwifeBody
      : commonJS
        ? require("./beefwife-body.js").BeefwifeBody
        : null;
  const Legs =
    typeof BeefwifeLegs !== "undefined"
      ? BeefwifeLegs
      : commonJS
        ? require("./beefwife-legs.js").BeefwifeLegs
        : null;
  const Skin =
    typeof BeefwifeSkin !== "undefined"
      ? BeefwifeSkin
      : commonJS
        ? require("./beefwife-skin.js").BeefwifeSkin
        : null;
  const Graphics =
    typeof BeefwifeGraphics !== "undefined"
      ? BeefwifeGraphics
      : commonJS
        ? require("./beefwife-graphics.js")
        : null;
  const Container =
    typeof PIXI !== "undefined"
      ? PIXI.Container
      : class HeadlessContainer {
          destroy() {
            this.destroyed = true;
          }
        };
  if (!Model || !Gait || !Body || !Legs || !Skin || !Graphics)
    throw new Error(
      "BeefwifeModel, BeefwifeGait, BeefwifeBody, BeefwifeLegs, BeefwifeSkin, and BeefwifeGraphics must load first",
    );
  const MAX_STEP_SECONDS = 0.05;
  const MAX_WORLD_COORDINATE = 1e9;
  const TAU = Math.PI * 2;
  const OPTION_KEYS = new Set([
    "position",
    "direction",
    "phase",
    "random",
    "render",
  ]);
  const RENDER_KEYS = new Set(["roundVertices", "kneeProjection"]);
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
    const projection = render.kneeProjection;
    if (projection !== undefined && projection !== null) {
      optionsOf(
        projection,
        KNEE_PROJECTION_KEYS,
        "options.render.kneeProjection",
      );
      finite(projection.centerX, "options.render.kneeProjection.centerX");
      finite(projection.centerY, "options.render.kneeProjection.centerY");
      const perspective = finite(
        projection.perspective,
        "options.render.kneeProjection.perspective",
      );
      if (perspective < 0)
        throw new RangeError(
          "options.render.kneeProjection.perspective must be nonnegative",
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
    body.fitsTranslation({ x: 0, y: 0 }, MAX_WORLD_COORDINATE);

  const sameTopology = (before, after) =>
    ["head", "trunk", "tail"].every(
      (name) => before.sections[name].count === after.sections[name].count,
    );
  const legStateKey = (model) => {
    const { jointLean, ...legs } = model.descriptor.legs;
    return JSON.stringify(legs);
  };
  const sameLegs = (before, after) =>
    legStateKey(before) === legStateKey(after);
  const skinKey = (model) =>
    JSON.stringify([
      model.descriptor.appearance,
      model.descriptor.definitions.shapes,
      model.descriptor.definitions.paints,
      model.descriptor.chain.skin,
      model.descriptor.legs.skin,
    ]);

  class Beefwife extends Container {
    #random;
    #requestedDirection;
    #model;
    #gait;
    #body;
    #legs;
    #skin;
    #graphics = null;
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
      const phase = finite(options.phase ?? 0, "options.phase");
      if (options.random !== undefined && typeof options.random !== "function")
        throw new TypeError("options.random must be a function");
      this.#random = options.random ?? Math.random;
      this.#renderOptions = renderOptionsOf(options.render);
      this.#requestedDirection = { ...facing };
      this.#model = Model.compile(descriptor);
      Graphics.prepare(this.#model);
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
      this.onRender = Graphics.available ? () => this.#syncGraphics() : null;
      this.#replaceGraphics();
    }

    get descriptor() {
      return this.#model.descriptor;
    }

    step(rawDt, rawControls) {
      const dt = finite(rawDt, "dt");
      if (dt < 0) throw new RangeError("dt must be nonnegative");
      const controls = optionsOf(rawControls, CONTROL_KEYS, "controls");
      const throttle = finite(controls.throttle ?? 1, "controls.throttle");
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
        Math.min(dt, MAX_STEP_SECONDS),
        throttle,
        wanted,
        this.#updateDependents,
      );
      if (stepped) {
        const correction = this.#body.worldCorrection(MAX_WORLD_COORDINATE);
        if (correction.x || correction.y) {
          this.#body.translate(correction);
          this.#legs.translate(correction);
          this.#skin.translate(correction);
        }
        this.#refreshPose();
      }
    }

    setDescriptor(descriptor) {
      const nextModel = Model.compile(descriptor);
      Graphics.prepare(nextModel);
      const nextGait = new Gait(nextModel.gait, this.#gait.phase);
      const breathingPhase =
        !this.#model.breathing.strain && nextModel.breathing.strain
          ? TAU * this.#sampleRandom()
          : this.#body.breathingPhase;
      const compatible = sameTopology(this.#model, nextModel);
      const rebuildSkin =
        !compatible || skinKey(this.#model) !== skinKey(nextModel);
      if (compatible) {
        const nextLegs = sameLegs(this.#model, nextModel)
          ? null
          : new Legs(nextModel, this.#body, nextGait, () =>
              this.#sampleRandom(),
            );
        const nextSkin = rebuildSkin
          ? new Skin(nextModel, this.#body, nextLegs || this.#legs)
          : null;
        this.#body.reconfigure(
          nextModel,
          nextGait,
          this.#throttle,
          breathingPhase,
        );
        if (nextLegs) this.#legs = nextLegs;
        else this.#legs.reconfigure(nextModel, this.#body, nextGait);
        if (nextSkin) this.#skin = nextSkin;
        else this.#skin.reconfigure(nextModel, this.#body, this.#legs);
      } else {
        const pose = this.#body.getPose(this.#pose);
        const body = new Body(nextModel, nextGait, breathingPhase);
        body.place(pose.head, pose.direction);
        body.refreshContacts(this.#throttle);
        if (!bodyFitsWorld(body))
          throw new RangeError("descriptor places the body outside the world");
        const legs = new Legs(nextModel, body, nextGait, () =>
          this.#sampleRandom(),
        );
        const skin = new Skin(nextModel, body, legs);
        this.#body = body;
        this.#legs = legs;
        this.#skin = skin;
      }
      this.#model = nextModel;
      this.#gait = nextGait;
      this.#refreshPose();
      this.label = nextModel.descriptor.name;
      this.#replaceGraphics();
    }

    reset(rawOptions) {
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
      const phase = finite(options.phase ?? this.#gait.phase, "options.phase");
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
      const legs = new Legs(this.#model, body, gait, () =>
        this.#sampleRandom(),
      );
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
      const offset = worldPoint(rawOffset, null, "offset");
      if (!this.#body.fitsTranslation(offset, MAX_WORLD_COORDINATE))
        throw new RangeError("offset places the body outside the world");
      this.#body.translate(offset);
      this.#legs.translate(offset);
      this.#skin.translate(offset);
      this.#refreshPose();
    }

    getPose() {
      return this.#pose;
    }

    destroy(options) {
      this.onRender = null;
      if (this.#graphics) {
        this.#graphics.destroy();
        this.#graphics = null;
      }
      super.destroy(options);
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
      if (this.#graphics) this.#graphics.destroy();
      this.#renderState = this.#skin.writeRenderState();
      this.#graphics = Graphics.available
        ? new Graphics(this, this.#renderState, this.#renderOptions)
        : null;
    }

    #syncGraphics() {
      this.#renderState = this.#skin.writeRenderState(this.#renderState);
      this.#graphics.sync(this.#renderState);
    }
  }

  Object.defineProperty(Beefwife, "MAX_STEP_SECONDS", {
    value: MAX_STEP_SECONDS,
    enumerable: true,
  });
  Object.defineProperty(Beefwife, "MAX_WORLD_COORDINATE", {
    value: MAX_WORLD_COORDINATE,
    enumerable: true,
  });
  return Beefwife;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Beefwife;
}
