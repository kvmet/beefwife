/**
 * Pixi overlay and frame host for terrain-routed Beefwives. BeefwifeCanvasRuntime owns goal
 * policy; BeefwifeCanvasActor follows routes; Beefwife owns simulation and display.
 */

const canRequireBeefwifeCanvasModules =
  typeof module !== "undefined" && module.exports;
const RuntimeBeefwifeCanvasActor =
  typeof BeefwifeCanvasActor !== "undefined"
    ? BeefwifeCanvasActor
    : canRequireBeefwifeCanvasModules &&
      require("./beefwife-canvas-actor.js");
if (!RuntimeBeefwifeCanvasActor)
  throw new Error("BeefwifeCanvasActor must load first");
const RuntimeBeefwifeCanvasOptions =
  typeof BeefwifeCanvasOptions !== "undefined"
    ? BeefwifeCanvasOptions
    : canRequireBeefwifeCanvasModules &&
      require("./beefwife-canvas-options.js");
if (!RuntimeBeefwifeCanvasOptions)
  throw new Error("BeefwifeCanvasOptions must load first");
const RuntimeBeefwifeCanvasTargeting =
  typeof BeefwifeCanvasTargeting !== "undefined"
    ? BeefwifeCanvasTargeting
    : canRequireBeefwifeCanvasModules &&
      require("./beefwife-canvas-targeting.js");
if (!RuntimeBeefwifeCanvasTargeting)
  throw new Error("BeefwifeCanvasTargeting must load first");
const RuntimeBeefwifeCanvasRender =
  typeof BeefwifeCanvasRender !== "undefined"
    ? BeefwifeCanvasRender
    : canRequireBeefwifeCanvasModules &&
      require("./beefwife-canvas-render.js");
if (!RuntimeBeefwifeCanvasRender)
  throw new Error("BeefwifeCanvasRender must load first");
const {
  config: BEEFWIFE_CANVAS_CONFIG,
  chooseName,
  countOf,
  debugOf,
  physicsFpsOf,
  renderFpsOf,
  resolutionScaleOf,
  timeScaleOf,
} = RuntimeBeefwifeCanvasOptions;
const { BeefwifeCanvasTargetPolicy, pointOf, targetingOf, wanderDelayOf } =
  RuntimeBeefwifeCanvasTargeting;

class BeefwifeCanvasRuntime {
  static async create(options = {}) {
    const runtime = new BeefwifeCanvasRuntime(options);
    await runtime._initializeRenderer();
    return runtime;
  }

  constructor(options = {}) {
    // BeefwifeCanvas supplies the complete, validated cast before creating the
    // runtime. Actors still wait for terrain measurement before spawning.
    this.cast = options.cast || null;
    this.castWeights = options.castWeights || null;
    this.timeScale = timeScaleOf(options.timeScale ?? 1);
    if (options.random !== undefined && typeof options.random !== "function")
      throw new TypeError("random must be a function");
    this.random = options.random || Math.random;
    this.resolutionScale = resolutionScaleOf(options.resolutionScale ?? 1);
    this.renderFps = renderFpsOf(options.renderFps);
    this.renderInterval = this.renderFps ? 1000 / this.renderFps : 0;
    this.physicsFps = physicsFpsOf(options.physicsFps);
    this.physicsInterval = this.physicsFps ? 1000 / this.physicsFps : 0;
    this.zIndex = options.zIndex || 9000;
    this.antialias = options.antialias ?? false;
    this.maxPixelRatio = options.maxPixelRatio ?? Infinity;
    if (
      this.maxPixelRatio !== Infinity &&
      (!Number.isFinite(this.maxPixelRatio) || this.maxPixelRatio <= 0)
    )
      throw new RangeError("maxPixelRatio must be positive");
    this.targeting = targetingOf(options.targeting || "wander");
    this.wanderDelay = wanderDelayOf(options.wanderDelay ?? 4);
    this.roam = options.roam
      ? { ...BEEFWIFE_CANVAS_ROUTE_DEFAULTS, ...options.roam }
      : BEEFWIFE_CANVAS_ROUTE_DEFAULTS;
    this.filters = options.filters ? Array.from(options.filters) : [];
    this.pauseWhenHidden = options.pauseWhenHidden ?? true;
    this.ownsCanvas = !options.canvas;
    this.canvas = options.canvas || null;
    this.reusableApplication = options.application || null;
    const ownsProjection =
      options.perspective !== undefined ||
      options.maxJointOffset !== undefined ||
      options.projectionCenter !== undefined;
    this.renderOptions = {
      roundVertices: options.roundVertices === true,
      projectionCenter: options.projectionCenter || "canvas",
      projection: ownsProjection
        ? {
            centerX: 0,
            centerY: 0,
            perspective: options.perspective ?? 0,
            maxOffset: options.maxJointOffset ?? 256,
          }
        : null,
    };
    if (!["canvas", "viewport"].includes(this.renderOptions.projectionCenter))
      throw new RangeError("projectionCenter must be canvas or viewport");
    this.debug = debugOf(options.debug);

    this.terrain = new Terrain(
      options.terrain
        ? {
            ...options.terrain,
            viewport: () => this._viewportRect(),
          }
        : this.ownsCanvas
          ? null
          : { viewport: () => this._viewportRect() },
    );
    this.router = new BeefwifeCanvasRouter(this.terrain, this.random);
    this.observed = new Set();
    this.observerConnected = false;
    this.actors = [];
    this.targetPolicies = new Map();
    this.running = false;
    this.destroyed = false;
    this.frameId = null;
    this.lastTime = 0;
    this.nextPhysicsTime = 0;
    this.nextDrawTime = 0;
    this.rebuildTimer = null;
    this.application = null;
    this.debugUnderlay = null;
    this.debugOverlay = null;
    this.world = null;
    this.displayed = [];
    this.dpr = 1;

    this._onResize = () => {
      if (!this.destroyed) this.scheduleRebuild();
    };
    this._onScroll = () => {
      if (!this.destroyed && this.renderOptions.projectionCenter === "viewport")
        this.scheduleRebuild();
    };
    this._onVisibility = () => {
      if (this.pauseWhenHidden && document.hidden) this._pause();
      else if (this.running) this._resume();
    };
    this.observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(this._onResize);

    const count = options.count === undefined ? 3 : countOf(options.count);
    this.pending = Array(count).fill(null);
  }

  async _initializeRenderer() {
    if (typeof PIXI === "undefined") throw new Error("PIXI must load first");
    if (this.reusableApplication) {
      this.application = this.reusableApplication;
      if (this.application.canvas !== this.canvas)
        throw new Error("reusable Pixi application belongs to another canvas");
      this.debugUnderlay = new PIXI.Graphics();
      this.debugOverlay = new PIXI.Graphics();
      this.world = new PIXI.Container();
      this.world.filters = this.filters;
      this.application.stage.addChild(
        this.debugUnderlay,
        this.world,
        this.debugOverlay,
      );
      return;
    }
    const canvas = this.canvas || document.createElement("canvas");
    if (this.ownsCanvas) {
      canvas.className = "beefwife-canvas-layer";
      Object.assign(canvas.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: String(this.zIndex),
      });
    }
    const viewport = this._viewportRect(canvas);
    const application = new PIXI.Application();
    await application.init({
      canvas,
      preference: "webgl",
      backgroundAlpha: 0,
      antialias: this.antialias,
      autoDensity: this.ownsCanvas,
      autoStart: false,
      resolution:
        Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) *
        this.resolutionScale,
      width: Math.max(1, viewport.width),
      height: Math.max(1, viewport.height),
    });
    this.application = application;
    this.canvas = application.canvas;
    this.debugUnderlay = new PIXI.Graphics();
    this.debugOverlay = new PIXI.Graphics();
    this.world = new PIXI.Container();
    this.world.filters = this.filters;
    application.stage.addChild(
      this.debugUnderlay,
      this.world,
      this.debugOverlay,
    );
  }

  start() {
    this._assertActive();
    if (this.running) return this;
    if (!this.application) throw new Error("Pixi renderer is not ready");
    if (this.ownsCanvas) document.body.appendChild(this.canvas);
    this._resizeCanvas();
    if (!this.cast) throw new Error("BeefwifeCanvas runtime needs a cast");
    this.rebuild();

    window.addEventListener("resize", this._onResize);
    window.addEventListener("scroll", this._onScroll, { passive: true });
    document.addEventListener("visibilitychange", this._onVisibility);
    this.running = true;
    if (!this.pauseWhenHidden || !document.hidden) this._resume();
    return this;
  }

  stop() {
    this.running = false;
    this._pause();
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = null;
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("scroll", this._onScroll);
    document.removeEventListener("visibilitychange", this._onVisibility);
    if (this.observer) {
      this.observer.disconnect();
      this.observed.clear();
      this.observerConnected = false;
    }
    return this;
  }

  destroy(options = {}) {
    if (this.destroyed) return null;
    this.stop();
    this.destroyed = true;
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = null;
    for (const actor of this.actors) actor.beefwife.destroy();
    this.actors = [];
    this.targetPolicies.clear();
    this.pending = [];
    this.displayed = [];
    const application = this.application;
    if (options.preserveRenderer && application) {
      this.world.filters = [];
      this.debugUnderlay.destroy();
      this.world.destroy();
      this.debugOverlay.destroy();
    } else if (this.ownsCanvas && this.canvas) {
      this.canvas.remove();
    }
    if (application && !options.preserveRenderer)
      this.application.destroy({
        removeView: false,
        releaseGlobalResources: false,
      });
    this.application = null;
    return options.preserveRenderer ? application : null;
  }

  add(name) {
    this._assertActive();
    if (name !== undefined && typeof name !== "string")
      throw new TypeError("name must be a string");
    if (this.actors.length + this.pending.length >= BEEFWIFE_CANVAS_CONFIG.MAX_COUNT)
      throw new RangeError(
        `cannot add more than ${BEEFWIFE_CANVAS_CONFIG.MAX_COUNT} beefwives`,
      );
    if (!this.router.ready || !this.cast) {
      this.pending.push(name ?? null);
      return null;
    }
    return this._addNow(name);
  }

  _addNow(name) {
    const selectedName =
      name || chooseName(this.cast, this.castWeights, this.random);
    const spec = this.cast[selectedName];
    if (!spec) throw new Error(`no creature named ${name}`);
    const planner = new BeefwifeCanvasTargetPolicy(this.router, this.targeting, {
      random: this.random,
      wanderDelay: this.wanderDelay,
    });
    const creature = new RuntimeBeefwifeCanvasActor(this.terrain, this.router, spec, {
      planner,
      random: this.random,
      render: this.renderOptions,
      roam: this.roam,
    });
    this.actors.push(creature);
    this.targetPolicies.set(creature, planner);
    return creature;
  }

  remove() {
    this._assertActive();
    if (this.pending.length) this.pending.pop();
    else {
      const actor = this.actors.pop();
      if (actor) {
        this.targetPolicies.delete(actor);
        actor.beefwife.destroy();
      }
    }
  }

  clear() {
    this._assertActive();
    for (const actor of this.actors) actor.beefwife.destroy();
    this.actors = [];
    this.targetPolicies.clear();
    this.pending = [];
  }

  setCount(rawCount) {
    this._assertActive();
    const count = countOf(rawCount);
    while (this.actors.length + this.pending.length > count) this.remove();
    while (this.actors.length + this.pending.length < count) this.add();
    return this;
  }

  setTimeScale(timeScale) {
    this._assertActive();
    this.timeScale = timeScaleOf(timeScale);
    return this;
  }

  setTarget(target, actor = null) {
    this._assertActive();
    const point = pointOf(target);
    const targets = actor ? [actor] : this.actors;
    for (const creature of targets) {
      const policy = this.targetPolicies.get(creature);
      if (!policy) throw new Error("actor does not belong to this host");
      policy.setTarget(point);
      creature.route = newRoute();
    }
    return this;
  }

  clearTarget(actor = null) {
    this._assertActive();
    const targets = actor ? [actor] : this.actors;
    for (const creature of targets) {
      const policy = this.targetPolicies.get(creature);
      if (!policy) throw new Error("actor does not belong to this host");
      policy.clearTarget();
      creature.route = newRoute();
    }
    return this;
  }

  setTargeting(targeting, actor = null) {
    this._assertActive();
    const mode = targetingOf(targeting);
    if (!actor) this.targeting = mode;
    const targets = actor ? [actor] : this.actors;
    for (const creature of targets) {
      const policy = this.targetPolicies.get(creature);
      if (!policy) throw new Error("actor does not belong to this host");
      policy.setTargeting(mode);
      creature.route = newRoute();
    }
    return this;
  }

  respawn(actor = null) {
    this._assertActive();
    const targets = actor ? [actor] : this.actors;
    for (const creature of targets) {
      if (!this.targetPolicies.has(creature))
        throw new Error("actor does not belong to this host");
      creature.spawn();
    }
    return this;
  }

  setDebug(flags) {
    this._assertActive();
    this.debug = debugOf(flags, this.debug);
    if (this.application) this._draw();
    return this;
  }

  refreshTerrain() {
    this._assertActive();
    this._resizeCanvas();
    this.rebuild();
    return this;
  }

  scheduleRebuild() {
    this._assertActive();
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => {
      if (!this.running) return;
      this._resizeCanvas();
      this.rebuild();
    }, BEEFWIFE_CANVAS_CONFIG.REBUILD_DELAY);
  }

  /**
   * The page has moved under the actors. It measures the new field and
   * nothing else: no creature is reseated and no plan is touched. A widget
   * appearing over one leaves it out of bounds, which its own steering replans
   * out of, on its own clock. Everything that redraws a plan is per creature,
   * so a page that changes cannot make the whole layer stall on one frame.
   */
  rebuild() {
    this._assertActive();
    this.terrain.build();
    // The same selector terrain measures, so the observer cannot end up
    // watching a different set than the field.
    const elements = this.terrain.avoidElements
      ? this.terrain.avoidElements()
      : Array.from(document.querySelectorAll(TERRAIN_CONFIG.avoid));

    // Re-observing feeds ResizeObserver's initial callback straight back into
    // scheduleRebuild, so a steady DOM only settles to zero rebuilds if the
    // observer is left alone when the element set has not changed.
    if (
      this.observer &&
      (!this.observerConnected || this._elementsChanged(elements))
    ) {
      this.observer.disconnect();
      if (!this.ownsCanvas) this.observer.observe(this.canvas);
      elements.forEach((el) => this.observer.observe(el));
      this.observed = new Set(elements);
      this.observerConnected = true;
    }

    while (this.router.ready && this.cast && this.pending.length) {
      const name = this.pending.shift();
      this._addNow(name || undefined);
    }
  }

  _elementsChanged(elements) {
    if (elements.length !== this.observed.size) return true;
    return elements.some((el) => !this.observed.has(el));
  }

  _viewportRect(canvas = this.canvas) {
    if (this.ownsCanvas || !canvas)
      return {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  _assertActive() {
    if (this.destroyed) throw new Error("BeefwifeCanvasRuntime has been destroyed");
  }

  _resizeCanvas() {
    if (!this.application) return;
    const viewport = this._viewportRect();
    this.dpr =
      Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) *
      this.resolutionScale;
    this.canvas.style.imageRendering =
      this.resolutionScale < 1 ? "pixelated" : "auto";
    if (!this.renderOptions.projection) {
      this.application.renderer.resolution = this.dpr;
      this.application.renderer.resize(viewport.width, viewport.height);
      return;
    }
    if (this.renderOptions.projectionCenter === "viewport") {
      this.renderOptions.projection.centerX =
        window.innerWidth / 2 - viewport.left;
      this.renderOptions.projection.centerY =
        window.innerHeight / 2 - viewport.top;
    } else {
      this.renderOptions.projection.centerX = viewport.width / 2;
      this.renderOptions.projection.centerY = viewport.height / 2;
    }
    this.application.renderer.resolution = this.dpr;
    this.application.renderer.resize(viewport.width, viewport.height);
  }

  _resume() {
    if (this.frameId !== null) return;
    this.lastTime = 0;
    this.nextPhysicsTime = 0;
    this.nextDrawTime = 0;
    this.frameId = requestAnimationFrame(this._tick);
  }

  _pause() {
    if (this.frameId === null) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.nextPhysicsTime = 0;
    this.nextDrawTime = 0;
  }

  _tick = (time) => {
    this.frameId = requestAnimationFrame(this._tick);
    let dt = 0;
    if (!this.physicsInterval) {
      dt = this.lastTime
        ? Math.min((time - this.lastTime) / 1000, BEEFWIFE_CANVAS_CONFIG.MAX_DT)
        : 0;
      this.lastTime = time;
    } else if (!this.nextPhysicsTime) {
      this.nextPhysicsTime = time + this.physicsInterval;
    } else if (time >= this.nextPhysicsTime - 1e-7) {
      const elapsedIntervals =
        Math.floor(
          Math.max(0, time - this.nextPhysicsTime) / this.physicsInterval,
        ) + 1;
      this.nextPhysicsTime += elapsedIntervals * this.physicsInterval;
      dt = Math.min(
        (elapsedIntervals * this.physicsInterval) / 1000,
        BEEFWIFE_CANVAS_CONFIG.MAX_DT,
      );
    }

    if (this.terrain.ready && dt > 0) {
      for (let index = 0; index < this.actors.length; index++)
        this.actors[index].update(dt, this.timeScale);
    }
    // Missed slots collapse into one bounded update; replaying them would stall
    // the frame that is already recovering from a stall.
    if (!this.renderInterval) {
      this._draw();
    } else if (!this.nextDrawTime || time >= this.nextDrawTime) {
      if (!this.nextDrawTime) this.nextDrawTime = time;
      const elapsedIntervals =
        Math.floor((time - this.nextDrawTime) / this.renderInterval) + 1;
      this.nextDrawTime += elapsedIntervals * this.renderInterval;
      this._draw();
    }
  };

  _draw = () => RuntimeBeefwifeCanvasRender.draw(this);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    BeefwifeCanvasRuntime,
    BeefwifeCanvasActor: RuntimeBeefwifeCanvasActor,
    BeefwifeCanvasTargetPolicy,
  };
}
