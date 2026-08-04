/**
 * Does the canvas runtime consume only the public Beefwife lifecycle,
 * and does each supplied target produce one finite route? Real schema-v1
 * descriptors are the control. Fails on legacy runtime access, invalid cast
 * entries, repeated directed plans, early wander plans, wrong Pixi ownership,
 * timing drift, or lost spawns.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.BeefwifeDescriptor = require("../../beefwife/beefwife-descriptor.js");
global.Beefwife = require("../../beefwife/beefwife.js");
global.BEEFWIFE_CANVAS_ROUTE_DEFAULTS = {
  arrivalRadius: 10,
  ease: 4,
  patience: 120,
  replan: 7,
  waypointRadius: 10,
};
global.newRoute = () => ({
  path: [],
  from: null,
  age: 0,
  nowhere: false,
  satisfied: false,
});
global.stepRoute = () => ({
  target: { x: 200, y: 50 },
  bearing: { x: 1, y: 0 },
});
global.window = { innerWidth: 800, innerHeight: 600 };

const BeefwifeCanvasActor = require(
  "../../beefwife-canvas/beefwife-canvas-actor.js",
);
const { BeefwifeCanvasTargetPolicy } = require(
  "../../beefwife-canvas/beefwife-canvas-targeting.js",
);
const {
  newRoute: newSteerRoute,
  stepRoute: steerRoute,
} = require("../../beefwife-canvas/beefwife-canvas-steering.js");
const descriptor = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "undulating.json"),
    "utf8",
  ),
);
let checks = 0;

const policyRouter = {
  terrain: { at: () => ({ d: 0, dx: 0, dy: 0 }) },
  randomPoint: () => ({ x: 300, y: 200 }),
  planTo: (_head, goal) => [{ ...goal }],
};
const directed = new BeefwifeCanvasTargetPolicy(policyRouter, "manual");
assert.throws(
  () => directed.setTarget({ x: 1, y: 2, z: 3 }),
  /target\.z is unknown/,
);
assert.throws(
  () => directed.setTarget(Object.assign([], { x: 1, y: 2 })),
  /target must be an object/,
);
directed.setTarget({ x: 12, y: 14 });
assert.deepEqual(directed.plan({ x: 0, y: 0 }), [{ x: 12, y: 14 }]);
directed.satisfy();
assert.equal(directed.readyToPlan, false);
assert.equal(directed.plan({ x: 12, y: 14 }), null);
const wandering = new BeefwifeCanvasTargetPolicy(policyRouter, "wander", {
  random: () => 0.5,
  wanderDelay: 8,
});
assert.equal(wandering.readyToPlan, true);
wandering.plan({ x: 0, y: 0 });
wandering.satisfy();
assert.equal(wandering.readyToPlan, false);
wandering.advance(3.99);
assert.equal(wandering.readyToPlan, false);
wandering.advance(0.01);
assert.equal(wandering.readyToPlan, true);
checks += 10;

let directedPlans = 0;
const finiteRouter = {
  terrain: policyRouter.terrain,
  randomPoint: policyRouter.randomPoint,
  planTo: (_head, goal) => {
    directedPlans++;
    return [{ ...goal }];
  },
};
const finitePolicy = new BeefwifeCanvasTargetPolicy(finiteRouter, "manual");
finitePolicy.setTarget({ x: 12, y: 14 });
const finiteRoute = newSteerRoute();
steerRoute(
  finiteRoute,
  finitePolicy,
  { x: 0, y: 0 },
  1 / 60,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(directedPlans, 1);
steerRoute(
  finiteRoute,
  finitePolicy,
  { x: 12, y: 14 },
  1 / 60,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(finiteRoute.satisfied, true);
steerRoute(
  finiteRoute,
  finitePolicy,
  { x: 12, y: 14 },
  1,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(directedPlans, 1);

let wanderPlans = 0;
const delayedRouter = {
  terrain: policyRouter.terrain,
  randomPoint: () => ({ x: 20 + wanderPlans, y: 0 }),
  planTo: (_head, goal) => {
    wanderPlans++;
    return [{ ...goal }];
  },
};
const delayedPolicy = new BeefwifeCanvasTargetPolicy(delayedRouter, "wander", {
  random: () => 0.5,
  wanderDelay: 8,
});
const delayedRoute = newSteerRoute();
steerRoute(delayedRoute, delayedPolicy, { x: 0, y: 0 }, 0, BEEFWIFE_CANVAS_ROUTE_DEFAULTS);
steerRoute(delayedRoute, delayedPolicy, { x: 20, y: 0 }, 0, BEEFWIFE_CANVAS_ROUTE_DEFAULTS);
steerRoute(delayedRoute, delayedPolicy, { x: 20, y: 0 }, 3.99, BEEFWIFE_CANVAS_ROUTE_DEFAULTS);
assert.equal(wanderPlans, 1);
steerRoute(delayedRoute, delayedPolicy, { x: 20, y: 0 }, 0.01, BEEFWIFE_CANVAS_ROUTE_DEFAULTS);
assert.equal(wanderPlans, 2);
checks += 5;

const toleranceRoute = newSteerRoute();
toleranceRoute.from = { x: 0, y: 0 };
toleranceRoute.path = [{ x: 10, y: 0 }, { x: 20, y: 0 }];
const passivePolicy = {
  readyToPlan: false,
  terrain: policyRouter.terrain,
};
const splitTolerance = {
  ...BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
  arrivalRadius: 2,
  waypointRadius: 2,
};
steerRoute(toleranceRoute, passivePolicy, { x: 11, y: 0 }, 0, splitTolerance);
assert.deepEqual(toleranceRoute.path, [{ x: 20, y: 0 }]);
steerRoute(toleranceRoute, passivePolicy, { x: 23, y: 0 }, 0, splitTolerance);
assert.deepEqual(toleranceRoute.path, [{ x: 20, y: 0 }]);
steerRoute(toleranceRoute, passivePolicy, { x: 21, y: 0 }, 0, splitTolerance);
assert.equal(toleranceRoute.satisfied, true);
checks += 3;

const terrain = { x0: 0, y0: 0, x1: 800, y1: 600 };
const router = { randomPoint: () => ({ x: 90, y: 70 }) };
const actor = new BeefwifeCanvasActor(terrain, router, descriptor);
assert.ok(actor.beefwife instanceof Beefwife);
const firstBeefwife = actor.beefwife;
actor.spawn({ x: 25, y: 35 }, { x: 0, y: 1 });
assert.equal(firstBeefwife.destroyed, true);
assert.deepEqual(actor.beefwife.getPose().head, { x: 25, y: 35 });
const stoppedPose = JSON.parse(JSON.stringify(actor.beefwife.getPose()));
actor.update(1 / 60, 0);
assert.deepEqual(actor.beefwife.getPose(), stoppedPose);
assert.throws(() => actor.update(1 / 60, Infinity), /timeScale/);
assert.throws(() => actor.update(1, 1), /dt/);
actor.update(1 / 60, 1);
assert.deepEqual(actor.heading, { x: 1, y: 0 });
checks += 8;

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

const classicBoundary = async () => {
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
  [
    "../../terrain/terrain.js",
    "../../beefwife/beefwife-descriptor.js",
    "../../beefwife/beefwife-model.js",
    "../../beefwife/beefwife-drive.js",
    "../../beefwife/beefwife-body.js",
    "../../beefwife/beefwife-legs.js",
    "../../beefwife/beefwife-skin.js",
    "../../beefwife/beefwife-graphics.js",
    "../../beefwife/beefwife.js",
    "../../beefwife-canvas/beefwife-canvas-path.js",
    "../../beefwife-canvas/beefwife-canvas-steering.js",
    "../../beefwife-canvas/beefwife-canvas-actor.js",
    "../../beefwife-canvas/beefwife-canvas-options.js",
    "../../beefwife-canvas/beefwife-canvas-targeting.js",
    "../../beefwife-canvas/beefwife-canvas-population.js",
    "../../beefwife-canvas/beefwife-canvas-render.js",
    "../../beefwife-canvas/beefwife-canvas-scene.js",
    "../../beefwife-canvas/beefwife-canvas-runtime.js",
  ].forEach((file) => {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, file), "utf8"),
      browser,
      {
        filename: file,
      },
    );
  });
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
  assert.equal(browser.layer.scene.dpr, 1);
  assert.equal(browser.layer.terrain.options.edgeMargin, 25);
  assert.equal(browser.layer.terrain.options.obstaclePadding, 0);
  assert.equal(browser.layer.debug.targets, true);
  assert.equal(browser.layer.debug.routes, false);
  browser.layer.setDebug({ navigation: true, routes: true });
  assert.equal(browser.layer.debug.navigation, true);
  assert.equal(browser.layer.debug.routes, true);
  assert.throws(
    () => browser.layer.setDebug({ unknown: true }),
    /debug\.unknown is unknown/,
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
  assert.equal(browser.embeddedLayer.terrain.viewport.left, 0);
  browser.embeddedLayer.refreshTerrain();
  assert.equal(browser.embeddedLayer.terrain.viewport.left, 100);
  assert.equal(browser.embeddedLayer.terrain.width, 300);
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

  [0.1, 1.1, Infinity].forEach((resolutionScale) => {
    browser.badValue = resolutionScale;
    assert.throws(
      () =>
        vm.runInContext("new BeefwifeCanvasRuntime({ resolutionScale: badValue })", browser),
      /resolutionScale/,
    );
  });
  [-1, 0.5, 241, Infinity].forEach((renderFps) => {
    browser.badValue = renderFps;
    assert.throws(
      () => vm.runInContext("new BeefwifeCanvasRuntime({ renderFps: badValue })", browser),
      /renderFps/,
    );
  });
  browser.layer.destroy();
  assert.ok(log.some(([operation]) => operation === "remove"));
  assert.ok(log.some(([operation]) => operation === "destroy"));
  return 38;
};

(async () => {
  checks += await classicBoundary();
  console.log(
    `BeefwifeCanvas runtime: ${checks} public-boundary checks passed`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
