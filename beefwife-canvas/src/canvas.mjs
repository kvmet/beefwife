/** Declarative, author-placed canvas host for terrain-routed Beefwives. */

import { Descriptor } from "../../beefwife/src/beefwife.mjs";
import { loadCast } from "./cast.mjs";
import { optionsOf, roamOf, terrainOf } from "./mount-options.mjs";
import { BeefwifeCanvasRuntime } from "./runtime.mjs";

const controllers = new WeakMap();
const renderers = new Map();
const released = new WeakSet();
const lastReady = new WeakMap();
let pageObserver = null;

/* A destroyed mount parks its renderer so the same element can be mounted
   again without a second GPU context. Pixi's own global listeners keep a
   parked renderer, and so its canvas, alive, so a canvas that leaves the page
   releases it. Releasing loses the context, so that element cannot be
   mounted again. */
const park = (canvas, parked) => {
  if (!canvas.isConnected) return release(canvas, parked);
  renderers.set(canvas, parked);
  if (pageObserver || typeof MutationObserver === "undefined") return;
  pageObserver = new MutationObserver(releaseDeparted);
  pageObserver.observe(document, { childList: true, subtree: true });
};

const unpark = (canvas) => {
  renderers.delete(canvas);
  if (renderers.size > 0 || !pageObserver) return;
  pageObserver.disconnect();
  pageObserver = null;
};

const release = (canvas, parked) => {
  released.add(canvas);
  BeefwifeCanvasRuntime.releaseRenderer(parked.application);
};

const releaseDeparted = () => {
  for (const [canvas, parked] of renderers) {
    if (canvas.isConnected) continue;
    unpark(canvas);
    release(canvas, parked);
  }
};

const dispatch = (canvas, type, detail) =>
  canvas.dispatchEvent(new CustomEvent(type, { detail }));

class Controller {
  constructor(canvas, supplied, previousReady) {
    if (!canvas || canvas.tagName !== "CANVAS")
      throw new TypeError("BeefwifeCanvas.mount: needs a <canvas> element");
    this.canvas = canvas;
    this.supplied = supplied;
    this.previousReady = previousReady;
    this.options = null;
    this.host = null;
    this.destroyed = false;
    this.wantsToRun = false;
    this.inView = true;
    this.abortController = new AbortController();
    this.handles = new Map();
    this.nextId = 1;
    this.originalImageRendering = canvas.style.imageRendering;
    this.originalSize = null;
    this._onClick = (event) => {
      if (this.options?.pointerInput !== "click" || !this.host) return;
      this.setTarget(this._pointerPoint(event));
    };
    this._onPointerMove = (event) => {
      if (this.options?.pointerInput === "move" && this.host)
        this.setTarget(this._pointerPoint(event));
    };
    this._onVisibilityChange = () => this._syncObserved();
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this._state("loading");
  }

  async initialize() {
    /* A mount destroyed while Pixi was still starting parks its renderer when
       init settles, so this mount waits to reuse it rather than open a second
       context on the element. The await also defers any error event until
       mount has assigned `ready`. */
    await Promise.allSettled([this.previousReady]);
    this.previousReady = null;
    if (this.destroyed) return this;
    try {
      if (released.has(this.canvas))
        throw new Error(
          "canvas: lost its renderer when it left the page; mount a new <canvas> element",
        );
      this.options = optionsOf(this.canvas, this.supplied);
      this.supplied = null;
      this.wantsToRun = this.options.autoStart;
      this._connectCanvas();
      const { cast, castWeights, castGuaranteed } = await loadCast(
        this.options,
        this.abortController.signal,
      );
      if (this.destroyed) return this;
      const filters = [...(this.options.filters || [])];
      const count = this.options.count ?? Object.keys(cast).length;
      this._pinUnstyledSize();
      const reusable = renderers.get(this.canvas);
      if (reusable && reusable.antialias !== this.options.antialias)
        throw new Error(
          "antialias: cannot change on a canvas that was already mounted; use a new <canvas> element",
        );
      this.host = await BeefwifeCanvasRuntime.create({
        antialias: this.options.antialias,
        application: reusable?.application,
        canvas: this.canvas,
        cast,
        castWeights,
        castGuaranteed,
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
        onError: (error) => this._fail(error),
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
      unpark(this.canvas);
      this._state("ready");
      dispatch(this.canvas, "beefwifecanvasready", {
        controller: this.facade,
      });
      this._syncRunning();
      return this;
    } catch (error) {
      if (this.destroyed || error.name === "AbortError") return this;
      this._fail(error);
      throw error;
    }
  }

  _fail(error) {
    this.destroy("error", () =>
      dispatch(this.canvas, "beefwifecanvaserror", {
        controller: this.facade,
        error,
      }),
    );
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
      throw new RangeError('pointerInput: must be "none", "click", or "move"');
    this.options.pointerInput = pointerInput;
    return this;
  }

  refreshTerrain() {
    this._host().refreshTerrain();
    return this;
  }

  getTerrainView() {
    return this._host().getTerrainView();
  }

  getStats() {
    return this._host().getStats();
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
          getRoute: () => {
            this._host();
            return actor.getRoute();
          },
          getTarget: () => {
            this._host();
            return actor.getTarget();
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
    this._restoreSize();
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
            this.inView = entries.at(-1)?.isIntersecting ?? true;
            this._syncObserved();
          })
        : null;
    this.intersectionObserver?.observe(this.canvas);
  }

  _canvasResized() {
    if (this.destroyed || !this.host) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) this.host.scheduleRebuild();
    this._syncObserved();
  }

  _pointerPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /* Pixi writes the buffer size into the width and height attributes, and a
     canvas with no CSS size lays out from them, so each resize would rescale
     it by the pixel ratio. The pin is the attribute size, which is what an
     unstyled canvas lays out at. */
  _pinUnstyledSize() {
    const canvas = this.canvas;
    const original = {
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height,
      width: canvas.getAttribute("width"),
      height: canvas.getAttribute("height"),
    };
    if (!this._layoutFollowsAttributes(original)) return;
    this.originalSize = original;
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }

  _layoutFollowsAttributes(original) {
    const canvas = this.canvas;
    const shown = canvas.getBoundingClientRect();
    /* A canvas outside layout (display: none here or on an ancestor) measures
       0 by 0 either way, but its computed size is still the authored one. */
    if (shown.width === 0 && shown.height === 0) {
      const style = getComputedStyle(canvas);
      return style.width === "auto" && style.height === "auto";
    }
    canvas.width *= 2;
    canvas.height *= 2;
    const doubled = canvas.getBoundingClientRect();
    this._restoreAttributes(original);
    return doubled.width !== shown.width || doubled.height !== shown.height;
  }

  _restoreSize() {
    const original = this.originalSize;
    if (!original) return;
    this.originalSize = null;
    this.canvas.style.width = original.styleWidth;
    this.canvas.style.height = original.styleHeight;
    this._restoreAttributes(original);
  }

  _restoreAttributes(original) {
    for (const name of ["width", "height"]) {
      if (original[name] === null) this.canvas.removeAttribute(name);
      else this.canvas.setAttribute(name, original[name]);
    }
  }

  _preserveHost() {
    if (!this.host) return;
    const application = this.host.destroy({ preserveRenderer: true });
    if (application)
      park(this.canvas, { antialias: this.options.antialias, application });
    this.host = null;
  }

  /* Observer callbacks have no caller to throw to, so a failure there is
     reported through the error event like any other runtime failure. */
  _syncObserved() {
    try {
      this._syncRunning();
    } catch (error) {
      this._fail(error);
    }
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
    if (!this.host)
      throw new Error(
        "BeefwifeCanvas: is not ready; wait for mount() to resolve",
      );
    return this.host;
  }

  _assertActive() {
    if (this.destroyed)
      throw new Error("BeefwifeCanvas: cannot be used after destroy()");
  }

  _state(state, pauseReason = null) {
    this.state = state;
    this.pauseReason = pauseReason;
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
      return controller.state;
    },
    get pauseReason() {
      return controller.pauseReason;
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
    getTerrainView() {
      return controller.getTerrainView();
    },
    getStats() {
      return controller.getStats();
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
    return Promise.reject(
      new Error(
        "canvas: already has a BeefwifeCanvas; destroy it before mounting again",
      ),
    );
  let controller;
  try {
    controller = new Controller(canvas, options, lastReady.get(canvas));
  } catch (error) {
    return Promise.reject(error);
  }
  controller.facade = facadeOf(controller);
  controllers.set(canvas, controller);
  controller.ready = controller.initialize().then(() => controller.facade);
  lastReady.set(canvas, controller.ready);
  return controller.ready;
};

const autoMount = () => {
  document
    .querySelectorAll("canvas[data-beefwife-canvas]")
    .forEach((canvas) => {
      if (!controllers.has(canvas)) mount(canvas).catch(() => {});
    });
};

/* A server-side render imports the module with no document to mount into. */
if (typeof document !== "undefined") {
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", autoMount, { once: true });
  else queueMicrotask(autoMount);
}

/* One import reaches the whole runtime, so a page that wants to read, check,
   or write a document has no other way to reach the schema. */
const BeefwifeCanvas = {
  Descriptor,
  get: (canvas) => controllers.get(canvas)?.facade || null,
  mount,
  scan: autoMount,
};

export default BeefwifeCanvas;
