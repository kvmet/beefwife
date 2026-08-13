/** Coordinates scene, population, terrain observation, and frame timing. */

import Terrain from "../../terrain/src/terrain.mjs";
import { BEEFWIFE_CANVAS_ROUTE_DEFAULTS } from "./steering.mjs";
import { BeefwifeCanvasRouter } from "./path.mjs";
import {
  config as BEEFWIFE_CANVAS_CONFIG,
  debugOf,
  imageRenderingOf,
  physicsFpsOf,
  renderFpsOf,
  resolutionScaleOf,
  timeScaleOf,
} from "./options.mjs";
import * as RuntimeBeefwifeCanvasRender from "./render.mjs";
import { BeefwifeCanvasScene as RuntimeBeefwifeCanvasScene } from "./scene.mjs";
import { BeefwifeCanvasPopulation as RuntimeBeefwifeCanvasPopulation } from "./population.mjs";

class BeefwifeCanvasRuntime {
  static async create(options = {}) {
    const runtime = new BeefwifeCanvasRuntime(options);
    await runtime.scene.initialize();
    return runtime;
  }

  constructor(options = {}) {
    // BeefwifeCanvas supplies the complete, validated cast before creating the
    // runtime. Actors still wait for terrain measurement before spawning.
    this.timeScale = timeScaleOf(options.timeScale ?? 1);
    if (options.random !== undefined && typeof options.random !== "function")
      throw new TypeError("random must be a function");
    const random = options.random || Math.random;
    const resolutionScale = resolutionScaleOf(options.resolutionScale ?? 1);
    const imageRendering = imageRenderingOf(options.imageRendering ?? "auto");
    this.renderFps = renderFpsOf(options.renderFps);
    this.physicsFps = physicsFpsOf(options.physicsFps);
    /* A draw landing between two physics updates repeats the frame before it,
       because nothing interpolates. So the draw rate follows the physics rate
       down: the extra pass costs a whole scene traversal and shows nothing
       new. A draw rate of 0 asks for that ceiling by name. */
    if (!this.renderFps || this.renderFps > this.physicsFps)
      this.renderFps = this.physicsFps;
    this.renderInterval = 1000 / this.renderFps;
    this.physicsInterval = 1000 / this.physicsFps;
    const maxPixelRatio = options.maxPixelRatio ?? Infinity;
    if (
      maxPixelRatio !== Infinity &&
      (!Number.isFinite(maxPixelRatio) || maxPixelRatio <= 0)
    )
      throw new RangeError("maxPixelRatio must be positive");
    const roam = options.roam
      ? { ...BEEFWIFE_CANVAS_ROUTE_DEFAULTS, ...options.roam }
      : BEEFWIFE_CANVAS_ROUTE_DEFAULTS;
    const ownsProjection =
      options.kneePerspective !== undefined ||
      options.maxKneeOffset !== undefined ||
      options.kneeProjectionCenter !== undefined;
    const kneeProjectionCenter = options.kneeProjectionCenter || "canvas";
    const renderOptions = {
      roundVertices: options.roundVertices === true,
      pixelResolution: 1,
      kneeProjection: ownsProjection
        ? {
            centerX: 0,
            centerY: 0,
            perspective: options.kneePerspective ?? 0,
            maxOffset: options.maxKneeOffset ?? 256,
          }
        : null,
    };
    if (!["canvas", "viewport"].includes(kneeProjectionCenter))
      throw new RangeError("kneeProjectionCenter must be canvas or viewport");
    this.scene = new RuntimeBeefwifeCanvasScene({
      antialias: options.antialias ?? false,
      application: options.application || null,
      canvas: options.canvas || null,
      filters: options.filters ? Array.from(options.filters) : [],
      imageRendering,
      kneeProjectionCenter,
      maxPixelRatio,
      renderOptions,
      resolutionScale,
      zIndex: options.zIndex || 9000,
    });
    this.debug = debugOf(options.debug);

    const terrainOptions = {};
    for (const [key, value] of Object.entries(options.terrain || {})) {
      if (value !== undefined) terrainOptions[key] = value;
    }
    // Terrain and the actors must share canvas-local coordinates for both
    // embedded and viewport-sized scenes.
    terrainOptions.viewport = () => this.scene.viewport;
    this.terrain = new Terrain(terrainOptions);
    this.terrainDebugOptions = {
      edgeMargin: terrainOptions.edgeMargin ?? Terrain.DEFAULTS.edgeMargin,
      obstaclePadding:
        terrainOptions.obstaclePadding ?? Terrain.DEFAULTS.obstaclePadding,
    };
    this.terrainView = {
      bounds: { left: 0, top: 0, right: 0, bottom: 0 },
      rectangles: [],
    };
    this.router = new BeefwifeCanvasRouter(
      this.terrain,
      () => this.scene.viewport,
      {
        edgeMargin: this.terrainDebugOptions.edgeMargin,
        random,
      },
    );
    this.population = new RuntimeBeefwifeCanvasPopulation(
      this.terrain,
      this.router,
      {
        cast: options.cast || null,
        castWeights: options.castWeights || null,
        count: options.count,
        random,
        renderOptions: this.scene.renderOptions,
        roam,
        targetMode: options.targetMode,
        wanderDelay: options.wanderDelay,
      },
    );
    this.observed = new Set();
    this.observerConnected = false;
    this.meter = { since: 0, steps: 0, draws: 0, stepMs: 0, drawMs: 0 };
    this.stats = { steps: 0, draws: 0, stepMs: 0, drawMs: 0 };
    this.running = false;
    this.destroyed = false;
    this.frameId = null;
    this.nextPhysicsTime = 0;
    this.nextDrawTime = 0;
    this.rebuildTimer = null;
    this._onResize = () => {
      if (!this.destroyed) this.scheduleRebuild();
    };
    /* Terrain is measured in canvas coordinates. An embedded canvas scrolls
       alongside the obstacles it shares a page with, so its measurement
       survives; a layer fixed over the viewport does not move, so every
       obstacle it measured has shifted. A viewport-centred knee field is
       placed from the scroll position either way. */
    this._onScroll = () => {
      if (this.destroyed) return;
      if (
        this.scene.ownsCanvas ||
        this.scene.kneeProjectionCenter === "viewport"
      )
        this.scheduleRebuild();
    };
    this.observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(this._onResize);
  }

  get actors() {
    return this.population.actors;
  }

  start() {
    this._assertActive();
    if (this.running) return this;
    this.scene.attach();
    this.scene.resize();
    if (!this.population.cast)
      throw new Error("BeefwifeCanvas runtime needs a cast");
    this.rebuild();

    window.addEventListener("resize", this._onResize);
    window.addEventListener("scroll", this._onScroll, { passive: true });
    this.running = true;
    this._resume();
    return this;
  }

  stop() {
    this.running = false;
    this._pause();
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = null;
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("scroll", this._onScroll);
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
    this.population.destroy();
    return this.scene.release(options.preserveRenderer === true);
  }

  add(name) {
    this._assertActive();
    return this.population.add(name);
  }

  remove() {
    this._assertActive();
    this.population.remove();
  }

  clear() {
    this._assertActive();
    this.population.clear();
  }

  setCount(rawCount) {
    this._assertActive();
    this.population.setCount(rawCount);
    return this;
  }

  setTimeScale(timeScale) {
    this._assertActive();
    this.timeScale = timeScaleOf(timeScale);
    return this;
  }

  setTarget(target, actor = null) {
    this._assertActive();
    this.population.setTarget(target, actor);
    return this;
  }

  clearTarget(actor = null) {
    this._assertActive();
    this.population.clearTarget(actor);
    return this;
  }

  setTargetMode(targetMode, actor = null) {
    this._assertActive();
    this.population.setTargetMode(targetMode, actor);
    return this;
  }

  respawn(actor = null) {
    this._assertActive();
    this.population.respawn(actor);
    return this;
  }

  setDebug(flags) {
    this._assertActive();
    this.debug = debugOf(flags, this.debug);
    if (this.scene.application) this._draw();
    return this;
  }

  /* The measured field, for a caller drawing its own debug layer. Copies,
     because the next build rewrites this one. */
  getTerrainView() {
    this._assertActive();
    return {
      bounds: { ...this.terrainView.bounds },
      rectangles: this.terrainView.rectangles.map((rectangle) => ({
        ...rectangle,
      })),
    };
  }

  getStats() {
    this._assertActive();
    return { ...this.stats, actors: this.population.actors.length };
  }

  refreshTerrain() {
    this._assertActive();
    this.scene.resize();
    this.rebuild();
    return this;
  }

  scheduleRebuild() {
    this._assertActive();
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => {
      if (!this.running) return;
      this.scene.resize();
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
    // Terrain exposes the measured source for observers. De-duplicate it just
    // as Terrain does so repeated elements do not cause endless reconnects.
    const elements = [...new Set(this.terrain.avoidElements())];
    this._snapshotTerrain(elements);

    // Re-observing feeds ResizeObserver's initial callback straight back into
    // scheduleRebuild, so a steady DOM only settles to zero rebuilds if the
    // observer is left alone when the element set has not changed.
    if (
      this.observer &&
      (!this.observerConnected || this._elementsChanged(elements))
    ) {
      this.observer.disconnect();
      if (!this.scene.ownsCanvas) this.observer.observe(this.scene.canvas);
      elements.forEach((el) => this.observer.observe(el));
      this.observed = new Set(elements);
      this.observerConnected = true;
    }

    this.population.spawnPending();
  }

  _elementsChanged(elements) {
    if (elements.length !== this.observed.size) return true;
    return elements.some((el) => !this.observed.has(el));
  }

  _snapshotTerrain(elements) {
    const viewport = this.scene.viewport;
    const margin = this.terrainDebugOptions.edgeMargin;
    const padding = this.terrainDebugOptions.obstaclePadding;
    const x0 = Math.min(margin, viewport.width / 2);
    const y0 = Math.min(margin, viewport.height / 2);
    this.terrainView.bounds = {
      left: x0,
      top: y0,
      right: viewport.width - x0,
      bottom: viewport.height - y0,
    };
    this.terrainView.rectangles = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - viewport.left - padding,
        top: rect.top - viewport.top - padding,
        right: rect.right - viewport.left + padding,
        bottom: rect.bottom - viewport.top + padding,
      };
    });
  }

  _assertActive() {
    if (this.destroyed)
      throw new Error("BeefwifeCanvasRuntime has been destroyed");
  }

  _resume() {
    if (this.frameId !== null) return;
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
    this._resetMeter(0);
  }

  _resetMeter(time) {
    this.meter.since = time;
    this.meter.steps = 0;
    this.meter.draws = 0;
    this.meter.stepMs = 0;
    this.meter.drawMs = 0;
  }

  /**
   * Rates over the last whole second, so two readers asking at different
   * moments read the same numbers. The milliseconds are this thread's work
   * only: `render` returns once the frame is submitted and the GPU draws it
   * afterwards, so nothing the resolution costs is counted here.
   */
  _meter(time) {
    const meter = this.meter;
    if (!meter.since) {
      meter.since = time;
      return;
    }
    const elapsed = time - meter.since;
    if (elapsed < 1000) return;
    const perSecond = 1000 / elapsed;
    this.stats = {
      steps: meter.steps * perSecond,
      draws: meter.draws * perSecond,
      stepMs: meter.steps ? meter.stepMs / meter.steps : 0,
      drawMs: meter.draws ? meter.drawMs / meter.draws : 0,
    };
    this._resetMeter(time);
  }

  _tick = (time) => {
    this.frameId = requestAnimationFrame(this._tick);
    let dt = 0;
    if (!this.nextPhysicsTime) {
      this.nextPhysicsTime = time + this.physicsInterval;
    } else if (time >= this.nextPhysicsTime - 1e-7) {
      const elapsedIntervals =
        Math.floor(
          Math.max(0, time - this.nextPhysicsTime) / this.physicsInterval,
        ) + 1;
      this.nextPhysicsTime += elapsedIntervals * this.physicsInterval;
      /* The missed slots advance the schedule and are then dropped: the step
         is one slot however late the frame is. `timeScale` multiplies this,
         so a step that grew with lateness would buy the next frame the same
         lateness again and hold the host in the stall it is leaving. A host
         that cannot keep the rate therefore plays slower rather than moving
         differently, since the routing below steps once per tick whatever
         the step is. */
      dt = this.physicsInterval / 1000;
    }

    if (this.terrain.ready && dt > 0) {
      const started = performance.now();
      this.population.update(dt, this.timeScale);
      this.meter.stepMs += performance.now() - started;
      this.meter.steps += 1;
    }
    if (!this.nextDrawTime || time >= this.nextDrawTime) {
      if (!this.nextDrawTime) this.nextDrawTime = time;
      const elapsedIntervals =
        Math.floor((time - this.nextDrawTime) / this.renderInterval) + 1;
      this.nextDrawTime += elapsedIntervals * this.renderInterval;
      const started = performance.now();
      this._draw();
      this.meter.drawMs += performance.now() - started;
      this.meter.draws += 1;
    }
    this._meter(time);
  };

  _draw = () =>
    RuntimeBeefwifeCanvasRender.draw({
      actors: this.population.renderState(),
      debug: this.debug,
      scene: this.scene,
      terrainView: this.terrainView,
    });
}

export { BeefwifeCanvasRuntime };
