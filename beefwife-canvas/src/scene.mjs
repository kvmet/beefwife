/** Pixi application, stage, canvas sizing, and display ownership. */

import { PIXI, available } from "../../beefwife/src/pixi.mjs";

class BeefwifeCanvasScene {
  constructor(options = {}) {
    this.ownsCanvas = !options.canvas;
    this.canvas = options.canvas || null;
    this.reusableApplication = options.application || null;
    this.antialias = options.antialias;
    this.filters = options.filters;
    this.imageRendering = options.imageRendering;
    this.maxPixelRatio = options.maxPixelRatio;
    this.resolutionScale = options.resolutionScale;
    this.zIndex = options.zIndex;
    this.kneeProjectionCenter = options.kneeProjectionCenter;
    this.renderOptions = options.renderOptions;
    this.application = null;
    this.debugUnderlay = null;
    this.debugOverlay = null;
    this.world = null;
    this.displayed = [];
    this.dpr = 1;
    this.viewport = this.viewportRect(this.canvas);
  }

  async initialize() {
    if (!available) throw new Error("PIXI must load first");
    this._syncPixelResolution();
    if (this.reusableApplication) {
      this.application = this.reusableApplication;
      if (this.application.canvas !== this.canvas)
        throw new Error("reusable Pixi application belongs to another canvas");
      this._buildStage();
      return this;
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
    const viewport = this.viewportRect(canvas);
    this.viewport = viewport;
    const application = new PIXI.Application();
    await application.init({
      canvas,
      preference: "webgl",
      backgroundAlpha: 0,
      antialias: this.antialias,
      autoDensity: this.ownsCanvas,
      autoStart: false,
      resolution: this.dpr,
      width: Math.max(1, viewport.width),
      height: Math.max(1, viewport.height),
    });
    this.application = application;
    this.canvas = application.canvas;
    this._buildStage();
    return this;
  }

  _buildStage() {
    this.debugUnderlay = new PIXI.Graphics();
    this.debugOverlay = new PIXI.Graphics();
    this.world = new PIXI.Container();
    this.world.filters = this.filters;
    this.application.stage.addChild(
      this.debugUnderlay,
      this.world,
      this.debugOverlay,
    );
  }

  attach() {
    if (!this.application) throw new Error("Pixi renderer is not ready");
    if (this.ownsCanvas) document.body.appendChild(this.canvas);
  }

  viewportRect(canvas = this.canvas) {
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

  resize() {
    if (!this.application) return;
    const viewport = this.viewportRect();
    this.viewport = viewport;
    this._syncPixelResolution();
    this.canvas.style.imageRendering = this.imageRendering;
    const projection = this.renderOptions.kneeProjection;
    if (projection) {
      if (this.kneeProjectionCenter === "viewport") {
        projection.centerX = window.innerWidth / 2 - viewport.left;
        projection.centerY = window.innerHeight / 2 - viewport.top;
      } else {
        projection.centerX = viewport.width / 2;
        projection.centerY = viewport.height / 2;
      }
    }
    this.application.renderer.resolution = this.dpr;
    this.application.renderer.resize(viewport.width, viewport.height);
  }

  _syncPixelResolution() {
    this.dpr =
      Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) *
      this.resolutionScale;
    this.renderOptions.pixelResolution = this.dpr;
  }

  syncDisplays(displays) {
    const currentSet = new Set(displays);
    for (const beefwife of this.displayed) {
      if (!currentSet.has(beefwife) && !beefwife.destroyed) beefwife.destroy();
    }
    for (let index = 0; index < displays.length; index++)
      this.world.addChildAt(displays[index], index);
    this.displayed = displays.slice();
  }

  render() {
    this.application.render();
  }

  release(preserveRenderer = false) {
    const application = this.application;
    this.displayed = [];
    if (preserveRenderer && application) {
      this.world.filters = [];
      this.debugUnderlay.destroy();
      this.world.destroy();
      this.debugOverlay.destroy();
    } else if (this.ownsCanvas && this.canvas) {
      this.canvas.remove();
    }
    if (application && !preserveRenderer)
      application.destroy({
        removeView: false,
        releaseGlobalResources: false,
      });
    this.application = null;
    return preserveRenderer ? application : null;
  }
}

export { BeefwifeCanvasScene };
