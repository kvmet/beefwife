/** Declarative, author-placed canvas host for terrain-routed Beefwives. */

const BeefwifeCanvas = (() => {
  const controllers = new WeakMap();
  const renderers = new WeakMap();
  const castSupport =
    typeof BeefwifeCanvasCast !== "undefined"
      ? BeefwifeCanvasCast
      : typeof module !== "undefined" && module.exports
        ? require("./beefwife-canvas-cast.js")
        : null;
  if (!castSupport) throw new Error("BeefwifeCanvasCast must load first");
  const BOOLEAN = new Set(["true", "false"]);
  // One row per public option. `attribute: false` marks JavaScript-only
  // options. A `default` here is a BeefwifeCanvas opinion that differs from
  // the owning layer; an option without one is forwarded undefined so the
  // layer that owns the value (BeefwifeCanvasRuntime, Terrain, or steering)
  // defaults it.
  const OPTIONS = {
    antialias: { type: "boolean", default: false },
    arrivalRadius: { type: "number" },
    autoStart: { type: "boolean", default: true },
    avoid: { type: "string" },
    count: { type: "number" },
    debugNavigation: { type: "boolean", default: false },
    debugRoutes: { type: "boolean", default: false },
    debugTargets: { type: "boolean", default: false },
    debugTerrain: { type: "boolean", default: false },
    descriptors: { attribute: false },
    drawFps: { type: "number", default: 24 },
    edgeMargin: { type: "number" },
    escapeReplanSeconds: { type: "number" },
    filters: { attribute: false },
    manifest: { type: "string" },
    maxJointOffset: { type: "number" },
    maxPixelRatio: { type: "number", default: 2 },
    obstaclePadding: { type: "number" },
    pauseHidden: { type: "boolean" },
    pauseOffscreen: { type: "boolean", default: true },
    perspective: { type: "number", default: 0.002 },
    projectionCenter: { type: "string" },
    random: { attribute: false },
    resolutionScale: { type: "number", default: 0.25 },
    roundVertices: { type: "boolean", default: true },
    simulationFps: { type: "number", default: 60 },
    sources: { type: "sources" },
    stuckReplanSeconds: { type: "number" },
    targeting: { type: "string" },
    throttleEase: { type: "number" },
    timeScale: { type: "number" },
    wanderDelay: { type: "number" },
  };
  const kebab = (key) =>
    key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const ATTRIBUTES = {};
  const DEFAULTS = {};
  for (const [key, rule] of Object.entries(OPTIONS)) {
    if (rule.attribute !== false)
      ATTRIBUTES[`data-beefwife-${kebab(key)}`] = [key, rule.type];
    if (rule.default !== undefined) DEFAULTS[key] = rule.default;
  }

  const dispatch = (canvas, type, detail) =>
    canvas.dispatchEvent(new CustomEvent(type, { detail }));

  const parseAttribute = (value, type, name) => {
    if (type === "string") return value;
    if (type === "sources")
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    if (type === "boolean") {
      if (!BOOLEAN.has(value))
        throw new TypeError(`${name} must be true or false`);
      return value === "true";
    }
    const number = Number(value);
    if (!Number.isFinite(number))
      throw new TypeError(`${name} must be a finite number`);
    return number;
  };

  const attributesOf = (canvas) => {
    const options = {};
    for (const attribute of canvas.attributes) {
      if (!attribute.name.startsWith("data-beefwife-")) continue;
      if (
        attribute.name === "data-beefwife-canvas" ||
        attribute.name === "data-beefwife-state"
      )
        continue;
      const rule = ATTRIBUTES[attribute.name];
      if (!rule) throw new TypeError(`${attribute.name} is unknown`);
      options[rule[0]] = parseAttribute(
        attribute.value,
        rule[1],
        attribute.name,
      );
    }
    return options;
  };

  const optionsOf = (canvas, supplied) => {
    if (
      supplied === null ||
      typeof supplied !== "object" ||
      Array.isArray(supplied)
    )
      throw new TypeError("options must be an object");
    for (const key of Object.keys(supplied)) {
      if (!OPTIONS[key]) throw new TypeError(`options.${key} is unknown`);
    }
    const options = { ...DEFAULTS, ...attributesOf(canvas), ...supplied };
    for (const [key, rule] of Object.entries(OPTIONS)) {
      const value = options[key];
      if (value === undefined) continue;
      if (rule.type === "boolean" && typeof value !== "boolean")
        throw new TypeError(`${key} must be true or false`);
      if (rule.type === "number" && !Number.isFinite(value))
        throw new TypeError(`${key} must be a finite number`);
      if (key === "avoid" && typeof value !== "string")
        throw new TypeError("avoid must be a selector string");
    }
    if (options.count !== undefined && !Number.isInteger(options.count))
      throw new TypeError("count must be an integer");
    if (options.random !== undefined && typeof options.random !== "function")
      throw new TypeError("random must be a function");
    if (options.filters !== undefined && !Array.isArray(options.filters))
      throw new TypeError("filters must be an array");
    for (const key of [
      "edgeMargin",
      "escapeReplanSeconds",
      "maxJointOffset",
      "obstaclePadding",
      "perspective",
      "stuckReplanSeconds",
      "wanderDelay",
    ]) {
      if (options[key] < 0) throw new RangeError(`${key} must be nonnegative`);
    }
    if (options.arrivalRadius !== undefined && options.arrivalRadius <= 1)
      throw new RangeError("arrivalRadius must be greater than 1");
    if (options.throttleEase !== undefined && options.throttleEase <= 0)
      throw new RangeError("throttleEase must be positive");
    return options;
  };

  const ROAM_KEYS = {
    arrivalRadius: "arrive",
    throttleEase: "ease",
    stuckReplanSeconds: "patience",
    escapeReplanSeconds: "replan",
  };
  const roamOf = (options) => {
    const roam = {};
    for (const [option, key] of Object.entries(ROAM_KEYS)) {
      if (options[option] !== undefined) roam[key] = options[option];
    }
    return roam;
  };

  class Controller {
    constructor(canvas, supplied) {
      if (!canvas || canvas.tagName !== "CANVAS")
        throw new TypeError("BeefwifeCanvas.mount needs a canvas element");
      this.canvas = canvas;
      this.supplied = supplied;
      this.options = null;
      this.host = null;
      this.destroyed = false;
      this.wantsToRun = false;
      this.inView = true;
      this.abortController = new AbortController();
      this.handles = new Map();
      this.nextId = 1;
      this.originalImageRendering = canvas.style.imageRendering;
      this._onClick = (event) => {
        if (this.options?.targeting !== "click" || !this.host) return;
        this.setTarget(this._pointerPoint(event));
      };
      this._onPointerMove = (event) => {
        if (this.options?.targeting === "pointer" && this.host)
          this.setTarget(this._pointerPoint(event));
      };
      this.resizeObserver = null;
      this.intersectionObserver = null;
      this._state("loading");
    }

    async initialize() {
      try {
        this.options = optionsOf(this.canvas, this.supplied);
        this.supplied = null;
        this.wantsToRun = this.options.autoStart;
        this._connectCanvas();
        const { cast, castWeights } = await castSupport.loadCast(
          this.options,
          this.abortController.signal,
        );
        if (this.destroyed) return this;
        const filters = [...(this.options.filters || [])];
        const count = this.options.count ?? Object.keys(cast).length;
        const reusable = renderers.get(this.canvas);
        if (reusable && reusable.antialias !== this.options.antialias)
          throw new Error("antialias cannot change when remounting one canvas");
        this.host = await BeefwifeCanvasRuntime.create({
          antialias: this.options.antialias,
          application: reusable?.application,
          canvas: this.canvas,
          cast,
          castWeights,
          count,
          debug: {
            navigation: this.options.debugNavigation,
            routes: this.options.debugRoutes,
            targets: this.options.debugTargets,
            terrain: this.options.debugTerrain,
          },
          filters,
          maxJointOffset: this.options.maxJointOffset,
          maxPixelRatio: this.options.maxPixelRatio,
          pauseWhenHidden: this.options.pauseHidden,
          perspective: this.options.perspective,
          projectionCenter: this.options.projectionCenter,
          physicsFps: this.options.simulationFps,
          random: this.options.random,
          renderFps: this.options.drawFps,
          resolutionScale: this.options.resolutionScale,
          // BeefwifeCanvasRuntime overlays roam onto its own defaults, so a key may be
          // present only when the caller set it; an undefined value would
          // shadow the default.
          roam: roamOf(this.options),
          roundVertices: this.options.roundVertices,
          targeting: this.options.targeting,
          terrain: {
            avoid: this.options.avoid,
            edgeMargin: this.options.edgeMargin,
            obstaclePadding: this.options.obstaclePadding,
          },
          timeScale: this.options.timeScale,
          wanderDelay: this.options.wanderDelay,
        });
        if (this.destroyed) {
          this._preserveHost();
          return this;
        }
        renderers.delete(this.canvas);
        this._state("ready");
        dispatch(this.canvas, "beefwifecanvasready", {
          controller: this.facade,
        });
        this._syncRunning();
        return this;
      } catch (error) {
        if (this.destroyed || error.name === "AbortError") return this;
        this.destroy("error", () =>
          dispatch(this.canvas, "beefwifecanvaserror", {
            controller: this.facade,
            error,
          }),
        );
        throw error;
      }
    }

    start() {
      this._assertActive();
      this.wantsToRun = true;
      this._syncRunning();
      return this;
    }

    stop() {
      this._assertActive();
      this.wantsToRun = false;
      this.host?.stop();
      if (this.host) this._state("stopped");
      return this;
    }

    setCount(count) {
      this._host().setCount(count);
      return this;
    }

    setTimeScale(timeScale) {
      this._host().setTimeScale(timeScale);
      return this;
    }

    setDebug(debug) {
      this._host().setDebug(debug);
      for (const [key, enabled] of Object.entries(debug)) {
        const option = `debug${key[0].toUpperCase()}${key.slice(1)}`;
        if (option in this.options) this.options[option] = enabled;
      }
      return this;
    }

    setTarget(target) {
      this._host().setTarget(target);
      return this;
    }

    clearTarget() {
      this._host().clearTarget();
      return this;
    }

    setTargeting(targeting) {
      this._host().setTargeting(targeting);
      this.options.targeting = targeting;
      return this;
    }

    refreshTerrain() {
      this._host().refreshTerrain();
      return this;
    }

    respawn() {
      this._host().respawn();
      return this;
    }

    getBeefwives() {
      const host = this._host();
      const active = new Set(host.actors);
      for (const actor of this.handles.keys()) {
        if (!active.has(actor)) this.handles.delete(actor);
      }
      // Handles resolve the host per call, so one retained past destroy()
      // fails with the BeefwifeCanvas error instead of a deep BeefwifeCanvasRuntime one.
      return host.actors.map((actor) => {
        let handle = this.handles.get(actor);
        if (!handle) {
          const id = this.nextId++;
          handle = Object.freeze({
            id,
            name: actor.name,
            clearTarget: () => this._host().clearTarget(actor),
            getPose: () => {
              this._host();
              return actor.beefwife.getPose();
            },
            respawn: () => this._host().respawn(actor),
            setTarget: (target) => this._host().setTarget(target, actor),
            setTargeting: (targeting) =>
              this._host().setTargeting(targeting, actor),
          });
          this.handles.set(actor, handle);
        }
        return handle;
      });
    }

    destroy(finalState = "destroyed", beforeRelease) {
      if (this.destroyed) return;
      this.destroyed = true;
      this.abortController.abort();
      this.canvas.removeEventListener("click", this._onClick);
      this.canvas.removeEventListener("pointermove", this._onPointerMove);
      this.resizeObserver?.disconnect();
      this.intersectionObserver?.disconnect();
      this._preserveHost();
      this.handles.clear();
      this.canvas.style.imageRendering = this.originalImageRendering;
      this._state(finalState);
      try {
        if (beforeRelease) beforeRelease();
      } finally {
        controllers.delete(this.canvas);
      }
    }

    _connectCanvas() {
      this.canvas.addEventListener("click", this._onClick);
      this.canvas.addEventListener("pointermove", this._onPointerMove);
      this.resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => this._canvasResized());
      this.resizeObserver?.observe(this.canvas);
      this.intersectionObserver =
        this.options.pauseOffscreen &&
        typeof IntersectionObserver !== "undefined"
          ? new IntersectionObserver((entries) => {
              this.inView = entries[0]?.isIntersecting ?? true;
              this._syncRunning();
            })
          : null;
      this.intersectionObserver?.observe(this.canvas);
    }

    _canvasResized() {
      if (this.destroyed || !this.host) return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) this.host.scheduleRebuild();
      this._syncRunning();
    }

    _pointerPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    _preserveHost() {
      if (!this.host) return;
      // The WebGL context belongs to the authored canvas. Keep its renderer
      // dormant between mounts because a destroyed context cannot be safely
      // reinitialized on the same element.
      const application = this.host.destroy({ preserveRenderer: true });
      if (application)
        renderers.set(this.canvas, {
          antialias: this.options.antialias,
          application,
        });
      this.host = null;
    }

    _syncRunning() {
      if (!this.host || this.destroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (this.wantsToRun && visible && this.inView) {
        this.host.start();
        this._state("running");
      } else {
        this.host.stop();
        this._state(this.wantsToRun ? "ready" : "stopped");
      }
    }

    _host() {
      this._assertActive();
      if (!this.host) throw new Error("BeefwifeCanvas is not ready");
      return this.host;
    }

    _assertActive() {
      if (this.destroyed) throw new Error("BeefwifeCanvas has been destroyed");
    }

    _state(state) {
      this.canvas.dataset.beefwifeState = state;
    }
  }

  // The public runtime handle. The Controller stays private so its host,
  // options, and underscore methods are not API.
  const facadeOf = (controller) => {
    const facade = Object.freeze({
      canvas: controller.canvas,
      get ready() {
        return controller.ready;
      },
      start() {
        controller.start();
        return facade;
      },
      stop() {
        controller.stop();
        return facade;
      },
      destroy() {
        controller.destroy();
      },
      setCount(count) {
        controller.setCount(count);
        return facade;
      },
      setTimeScale(timeScale) {
        controller.setTimeScale(timeScale);
        return facade;
      },
      setDebug(debug) {
        controller.setDebug(debug);
        return facade;
      },
      setTarget(target) {
        controller.setTarget(target);
        return facade;
      },
      clearTarget() {
        controller.clearTarget();
        return facade;
      },
      setTargeting(targeting) {
        controller.setTargeting(targeting);
        return facade;
      },
      refreshTerrain() {
        controller.refreshTerrain();
        return facade;
      },
      respawn() {
        controller.respawn();
        return facade;
      },
      getBeefwives() {
        return controller.getBeefwives();
      },
    });
    return facade;
  };

  const mount = (canvas, options = {}) => {
    if (controllers.has(canvas))
      return Promise.reject(new Error("canvas already has a BeefwifeCanvas"));
    let controller;
    try {
      controller = new Controller(canvas, options);
    } catch (error) {
      return Promise.reject(error);
    }
    controller.facade = facadeOf(controller);
    controllers.set(canvas, controller);
    controller.ready = controller.initialize().then(() => controller.facade);
    return controller.ready;
  };

  const autoMount = () => {
    document
      .querySelectorAll("canvas[data-beefwife-canvas]")
      .forEach((canvas) => {
        if (!controllers.has(canvas)) mount(canvas).catch(() => {});
      });
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", autoMount, { once: true });
  else queueMicrotask(autoMount);

  return {
    get: (canvas) => controllers.get(canvas)?.facade || null,
    mount,
    scan: autoMount,
  };
})();

if (typeof window !== "undefined") window.BeefwifeCanvas = BeefwifeCanvas;

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeCanvas;
}
