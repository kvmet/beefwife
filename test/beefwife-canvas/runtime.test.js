/**
 * Does the assembled runtime own its Pixi objects, keep its own clock, and let
 * go of everything on destroy? A page and a renderer of this test's making are
 * the control, because Pixi's Application needs a document to init against and
 * there is none here. Fails on wrong Pixi ownership, timing drift, a leaked
 * observer or timer, or a surviving display object.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { bundleFor } = require("./vm-bundle.js");
const { default: Terrain } = require("../../terrain/src/terrain.mjs");
const descriptor = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "undulating.json"),
    "utf8",
  ),
);

const pixiStub = (log) => {
  class Container {
    constructor() {
      this.children = [];
      this.parent = null;
      this.destroyed = false;
    }
    addChild(...children) {
      for (const child of children)
        this.addChildAt(child, this.children.length);
      return children.at(-1);
    }
    addChildAt(child, index) {
      if (child.parent) child.parent.removeChild(child);
      this.children.splice(index, 0, child);
      child.parent = this;
      return child;
    }
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parent = null;
      return child;
    }
    destroy() {
      if (this.parent) this.parent.removeChild(this);
      this.destroyed = true;
    }
  }
  class Graphics extends Container {
    constructor() {
      super();
      this.position = { set() {} };
      this.scale = { set() {} };
    }
    clear() {
      return this;
    }
    rect() {
      return this;
    }
    circle() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    arc() {
      return this;
    }
    closePath() {
      return this;
    }
    fill() {
      return this;
    }
    stroke() {
      return this;
    }
  }
  class GraphicsPath {
    transform() {
      return this;
    }
  }
  class GraphicsContext {
    path() {
      return this;
    }
    fill() {
      return this;
    }
    stroke() {
      return this;
    }
  }
  class MeshGeometry {
    constructor(options) {
      this.positions = options.positions;
      this.buffer = { update() {} };
    }
    getBuffer() {
      return this.buffer;
    }
    destroy() {}
  }
  class Mesh extends Container {
    constructor(options) {
      super();
      this.geometry = options.geometry;
    }
  }
  class Application {
    constructor() {
      this.stage = new Container();
      this.renderer = {
        resolution: 1,
        resize: (width, height) => log.push(["resize", width, height]),
      };
    }
    async init(options) {
      this.canvas = options.canvas;
      this.renderer.resolution = options.resolution;
      log.push(["init", options.antialias]);
    }
    render() {
      const visit = (node) => {
        if (node.onRender) node.onRender();
        node.children?.forEach(visit);
      };
      visit(this.stage);
      log.push(["render"]);
    }
    destroy() {
      log.push(["destroy"]);
    }
  }
  return {
    Application,
    Color: class Color {},
    Container,
    Graphics,
    GraphicsContext,
    GraphicsPath,
    Matrix: class Matrix {},
    Mesh,
    MeshGeometry,
    Texture: { WHITE: {} },
  };
};

const sceneBoundary = async () => {
  const log = [];
  const scheduledTimers = new Set();
  const canvas = {
    className: "",
    style: {},
    remove: () => log.push(["remove"]),
  };
  const obstacle = {
    getBoundingClientRect: () => ({
      left: 500,
      top: 100,
      right: 520,
      bottom: 120,
    }),
  };
  const browser = {
    console,
    PIXI: pixiStub(log),
    window: {
      innerWidth: 640,
      innerHeight: 360,
      devicePixelRatio: 2,
      addEventListener() {},
      removeEventListener() {},
    },
    document: {
      hidden: true,
      body: { appendChild: () => log.push(["append"]) },
      createElement: () => canvas,
      querySelectorAll: () => [obstacle, obstacle],
      addEventListener() {},
      removeEventListener() {},
    },
    ResizeObserver: class ResizeObserver {
      disconnect() {
        log.push(["observer-disconnect"]);
      }
      observe(element) {
        log.push(["observer-observe", element]);
      }
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout: (callback) => {
      scheduledTimers.add(callback);
      return callback;
    },
    clearTimeout: (callback) => scheduledTimers.delete(callback),
  };
  vm.createContext(browser);
  /* The runtime is not public, so it gets its own bundle rather than a widened
     facade. Terrain and Beefwife ride inside it; only the renderer and the
     page are this test's, because Pixi's Application needs a document to init
     against and there is none here. */
  vm.runInContext(
    await bundleFor({
      source:
        'export { BeefwifeCanvasRuntime as default } from "./runtime.mjs";',
      name: "BeefwifeCanvasRuntime",
    }),
    browser,
    { filename: "beefwife-canvas-runtime.js" },
  );
  browser.descriptorText = JSON.stringify(descriptor);
  vm.runInContext(
    `globalThis.testDescriptor = JSON.parse(descriptorText);`,
    browser,
  );
  browser.layer = await vm.runInContext(
    `BeefwifeCanvasRuntime.create({
      cast: { [testDescriptor.name]: testDescriptor },
      count: 0,
      debug: { targets: true },
      imageRendering: "auto",
      timeScale: 0,
      resolutionScale: 0.25,
      renderFps: 24,
      physicsFps: 60,
    })`,
    browser,
  );
  assert.equal(browser.layer.scene.dpr, 0.5);
  assert.equal(
    browser.layer.scene.renderOptions.pixelResolution,
    browser.layer.scene.dpr,
  );
  assert.equal(
    browser.layer.terrain.options.edgeMargin,
    Terrain.DEFAULTS.edgeMargin,
  );
  assert.equal(browser.layer.terrain.options.obstaclePadding, 0);
  assert.equal(browser.layer.debug.targets, true);
  assert.equal(browser.layer.debug.routes, false);
  browser.layer.setDebug({ routes: true });
  assert.equal(browser.layer.debug.routes, true);
  assert.throws(
    () => browser.layer.setDebug({ unknown: true }),
    /debug\.unknown is unknown/,
  );
  assert.throws(
    () => browser.layer.setDebug({ navigation: true }),
    /debug\.navigation is unknown/,
  );
  assert.throws(
    () => browser.layer.setDebug({ terrain: 1 }),
    /debug\.terrain must be a boolean/,
  );
  browser.layer.start();
  assert.equal(
    log.filter(([operation]) => operation === "observer-observe").length,
    1,
  );
  browser.layer.refreshTerrain();
  assert.equal(
    log.filter(([operation]) => operation === "observer-observe").length,
    1,
  );
  browser.layer.setDebug({ terrain: true });
  assert.equal(browser.layer.terrainView.rectangles.length, 1);
  assert.equal(browser.layer.terrainView.bounds.right, 640);
  assert.equal(browser.layer.scene.canvas.style.imageRendering, "auto");
  browser.layer.setCount(1);
  browser.layer._draw();
  assert.equal(browser.layer.scene.dpr, 0.5);
  assert.equal(browser.layer.scene.application.stage.children.length, 3);
  assert.equal(
    browser.layer.scene.application.stage.children[1].children[0],
    browser.layer.actors[0].beefwife,
  );
  assert.ok(log.some(([operation]) => operation === "render"));

  const embeddedCanvas = {
    style: {},
    getBoundingClientRect: () => ({
      left: 100,
      top: 40,
      width: 300,
      height: 200,
    }),
    remove: () => log.push(["embedded-remove"]),
  };
  browser.embeddedCanvas = embeddedCanvas;
  browser.embeddedLayer = await vm.runInContext(
    `BeefwifeCanvasRuntime.create({
      canvas: embeddedCanvas,
      cast: { [testDescriptor.name]: testDescriptor },
      count: 0,
      imageRendering: "pixelated",
      kneePerspective: 0.002,
      kneeProjectionCenter: "viewport",
    })`,
    browser,
  );
  browser.embeddedLayer.scene.resize();
  assert.equal(
    browser.embeddedLayer.scene.renderOptions.kneeProjection.centerX,
    220,
  );
  assert.equal(
    browser.embeddedLayer.scene.renderOptions.kneeProjection.centerY,
    140,
  );
  assert.equal(embeddedCanvas.style.imageRendering, "pixelated");
  browser.embeddedLayer.refreshTerrain();
  assert.equal(browser.embeddedLayer.router.viewport().width, 300);
  assert.equal(browser.embeddedLayer.router.viewport().height, 200);

  /* A layer of its own is fixed over the viewport, so the page scrolling
     under it moves every obstacle it measured. An embedded canvas scrolls
     with those obstacles and keeps its measurement, unless its knee field is
     centred on the viewport, which the scroll moves. */
  const scrolls = (layer) => {
    layer.rebuildTimer = null;
    layer._onScroll();
    return layer.rebuildTimer !== null;
  };
  assert.ok(scrolls(browser.layer), "a fixed layer ignored a scroll");
  assert.ok(
    scrolls(browser.embeddedLayer),
    "a viewport-centred knee field ignored a scroll",
  );
  browser.stillCanvas = {
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 }),
    remove() {},
  };
  browser.stillLayer = await vm.runInContext(
    `BeefwifeCanvasRuntime.create({
      canvas: stillCanvas,
      cast: { [testDescriptor.name]: testDescriptor },
      count: 0,
    })`,
    browser,
  );
  assert.equal(
    scrolls(browser.stillLayer),
    false,
    "an embedded layer re-measured a scroll that moved nothing",
  );
  browser.stillLayer.destroy();
  browser.embeddedLayer.destroy();
  assert.ok(!log.some(([operation]) => operation === "embedded-remove"));

  vm.runInContext(
    `globalThis.physicsSteps = [];
     globalThis.renderTicks = 0;
     globalThis.clock = new BeefwifeCanvasRuntime({
       cast: { [testDescriptor.name]: testDescriptor },
       count: 0,
       physicsFps: 60,
       renderFps: 24,
     });
     clock.terrain.build();
     clock.population.actors = [{ update: (dt) => physicsSteps.push(dt) }];
     clock._draw = () => renderTicks++;
     for (let time = 1000; time <= 1100; time += 5) clock._tick(time);`,
    browser,
  );
  assert.equal(browser.physicsSteps.length, 6);
  assert.ok(
    browser.physicsSteps.every((seconds) => Math.abs(seconds - 1 / 60) < 1e-12),
  );
  assert.equal(browser.renderTicks, 3);

  [0.125, 0.2, 1].forEach((resolutionScale) => {
    browser.goodValue = resolutionScale;
    assert.doesNotThrow(() =>
      vm.runInContext(
        "new BeefwifeCanvasRuntime({ resolutionScale: goodValue })",
        browser,
      ),
    );
  });
  [0.1, 1.1, Infinity].forEach((resolutionScale) => {
    browser.badValue = resolutionScale;
    assert.throws(
      () =>
        vm.runInContext(
          "new BeefwifeCanvasRuntime({ resolutionScale: badValue })",
          browser,
        ),
      /resolutionScale/,
    );
  });
  [-1, 0.5, 241, Infinity].forEach((renderFps) => {
    browser.badValue = renderFps;
    assert.throws(
      () =>
        vm.runInContext(
          "new BeefwifeCanvasRuntime({ renderFps: badValue })",
          browser,
        ),
      /renderFps/,
    );
  });
  /* One knob, one meaning: a mount and a direct construction start from the
     same rates, because only this layer states them. */
  browser.rates = { count: 0, timeScale: 0 };
  assert.equal(
    vm.runInContext(
      "((host) => `${host.renderFps},${host.physicsFps}`)(new BeefwifeCanvasRuntime(rates))",
      browser,
    ),
    "24,60",
  );
  /* Drawing faster than the simulation repeats frames, so the draw rate is
     held at the physics rate however high it was asked for, including the 0
     that otherwise means every frame. */
  [
    [0, 60, 60],
    [120, 60, 60],
    [60, 30, 30],
    [24, 60, 24],
    [120, 0, 120],
    [0, 0, 0],
  ].forEach(([renderFps, physicsFps, expected]) => {
    browser.rates = { renderFps, physicsFps, count: 0, timeScale: 0 };
    const capped = vm.runInContext(
      "new BeefwifeCanvasRuntime(rates).renderFps",
      browser,
    );
    assert.equal(
      capped,
      expected,
      `renderFps ${renderFps} with physicsFps ${physicsFps}`,
    );
  });
  browser.layer.destroy();
  assert.ok(log.some(([operation]) => operation === "remove"));
  assert.ok(log.some(([operation]) => operation === "destroy"));
  return 46;
};

(async () => {
  const checks = await sceneBoundary();
  console.log(`BeefwifeCanvas runtime: ${checks} ownership checks passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
