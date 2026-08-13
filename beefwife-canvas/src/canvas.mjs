/** Declarative, author-placed canvas host for terrain-routed Beefwives. */

import { Descriptor } from "../../beefwife/src/beefwife.mjs";
import { loadCast } from "./cast.mjs";
import { optionsOf, roamOf, terrainOf } from "./mount-options.mjs";
import { BeefwifeCanvasRuntime } from "./runtime.mjs";

const controllers = new WeakMap();
const renderers = new WeakMap();

const dispatch = (canvas, type, detail) =>
  canvas.dispatchEvent(new CustomEvent(type, { detail }));

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
      if (this.options?.pointerInput !== "click" || !this.host) return;
      this.setTarget(this._pointerPoint(event));
    };
    this._onPointerMove = (event) => {
      if (this.options?.pointerInput === "move" && this.host)
        this.setTarget(this._pointerPoint(event));
    };
    this._onVisibilityChange = () => this._syncRunning();
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
      const { cast, castWeights } = await loadCast(
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
          routes: this.options.debugRoutes,
          targets: this.options.debugTargets,
          terrain: this.options.debugTerrain,
        },
        filters,
        imageRendering: this.options.imageRendering,
        kneePerspective: this.options.kneePerspective,
        kneeProjectionCenter: this.options.kneeProjectionCenter,
        maxKneeOffset: this.options.maxKneeOffset,
        maxPixelRatio: this.options.maxPixelRatio,
        physicsFps: this.options.simulationFps,
        random: this.options.random,
        renderFps: this.options.drawFps,
        resolutionScale: this.options.resolutionScale,
        // BeefwifeCanvasRuntime overlays roam onto its own defaults, so a key may be
        // present only when the caller set it; an undefined value would
        // shadow the default.
        roam: roamOf(this.options),
        roundVertices: this.options.roundVertices,
        targetMode: this.options.targetMode,
        // Terrain treats an explicitly undefined value as invalid, so only
        // forward the options this public boundary actually received.
        terrain: terrainOf(this.options),
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

  setTargetMode(targetMode) {
    this._host().setTargetMode(targetMode);
    this.options.targetMode = targetMode;
    return this;
  }

  setPointerInput(pointerInput) {
    if (!["none", "click", "move"].includes(pointerInput))
      throw new RangeError("pointerInput must be none, click, or move");
    this.options.pointerInput = pointerInput;
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

  getActors() {
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
          clearTarget: () => {
            this._host().clearTarget(actor);
            return handle;
          },
          getPose: () => {
            this._host();
            return actor.beefwife.getPose();
          },
          respawn: () => {
            this._host().respawn(actor);
            return handle;
          },
          setDescriptor: (descriptor) => {
            this._host();
            actor.setDescriptor(descriptor);
            return handle;
          },
          setTarget: (target) => {
            this._host().setTarget(target, actor);
            return handle;
          },
          setTargetMode: (targetMode) => {
            this._host().setTargetMode(targetMode, actor);
            return handle;
          },
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
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
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
    if (this.options.pauseHidden)
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => this._canvasResized());
    this.resizeObserver?.observe(this.canvas);
    this.intersectionObserver =
      this.options.pauseOffscreen && typeof IntersectionObserver !== "undefined"
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
    if (!this.wantsToRun) {
      this.host.stop();
      this._state("stopped");
    } else if (this.options.pauseHidden && document.hidden) {
      this.host.stop();
      this._state("paused", "hidden");
    } else if (!visible) {
      this.host.stop();
      this._state("paused", "zero-size");
    } else if (!this.inView) {
      this.host.stop();
      this._state("paused", "offscreen");
    } else {
      this.host.start();
      this._state("running");
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

  _state(state, pauseReason = null) {
    this.canvas.dataset.beefwifeState = state;
    if (pauseReason) this.canvas.dataset.beefwifePauseReason = pauseReason;
    else delete this.canvas.dataset.beefwifePauseReason;
  }
}

// The public runtime handle. The Controller stays private so its host,
// options, and underscore methods are not API.
const facadeOf = (controller) => {
  const facade = Object.freeze({
    canvas: controller.canvas,
    get state() {
      return controller.canvas.dataset.beefwifeState;
    },
    get pauseReason() {
      return controller.canvas.dataset.beefwifePauseReason || null;
    },
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
    setTargetMode(targetMode) {
      controller.setTargetMode(targetMode);
      return facade;
    },
    setPointerInput(pointerInput) {
      controller.setPointerInput(pointerInput);
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
    getActors() {
      return controller.getActors();
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

/* One import reaches the whole runtime, so a page that wants to read, check,
   or write a document has no other way to reach the schema. */
const BeefwifeCanvas = {
  Descriptor,
  get: (canvas) => controllers.get(canvas)?.facade || null,
  mount,
  scan: autoMount,
};

export default BeefwifeCanvas;
