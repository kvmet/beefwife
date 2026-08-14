/**
 * Does the public canvas boundary preserve its element, load atomically, and
 * keep targets and projection policy in the host? Parsed descriptors are the
 * control. It fails on attribute precedence, nonlocal clicks, duplicate names,
 * lifecycle leaks, or descriptor/goal policy entering Beefwife.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { bundleFor } = require("./vm-bundle.js");

/* Every cast entry is a real schema-v1 document, since the boundary hands each
   one to the shipped reader. Only the name varies, so assertions still key on
   a short one. */
const template = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "samples", "undulating.json"),
    "utf8",
  ),
);
const descriptorJson = (name) => JSON.stringify({ ...template, name });

class Canvas {
  constructor(attributes = {}) {
    this.tagName = "CANVAS";
    this.attributes = Object.entries(attributes).map(([name, value]) => ({
      name,
      value: String(value),
    }));
    this.dataset = {};
    this.style = { imageRendering: "crisp-edges" };
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || [])
      listener(event);
  }

  getBoundingClientRect() {
    return { left: 40, top: 70, width: 640, height: 360 };
  }
}

const calls = [];
const hosts = [];
let intersectionCallback = null;
const newHost = (options) => {
  const actor = {
    name: Object.keys(options.cast)[0],
    beefwife: { getPose: () => ({ head: { x: 4, y: 5 } }) },
    getRoute: () => [{ x: 7, y: 8 }],
    getTarget: () => ({ x: 12, y: 14 }),
    setDescriptor: (descriptor) => calls.push(["setDescriptor", descriptor]),
  };
  const host = {
    actors: [actor],
    destroyed: false,
    running: false,
    clearTarget: (one) => calls.push(["clearTarget", one]),
    destroy() {
      this.destroyed = true;
      calls.push(["destroy"]);
    },
    getStats: () => ({ actors: 1, steps: 60, draws: 24, stepMs: 2, drawMs: 3 }),
    getTerrainView: () => ({ bounds: { left: 1 }, rectangles: [{ left: 2 }] }),
    rebuild: () => calls.push(["rebuild"]),
    refreshTerrain: () => calls.push(["refreshTerrain"]),
    respawn: (one) => calls.push(["respawn", one]),
    setCount: (count) => calls.push(["setCount", count]),
    setDebug: (debug) => calls.push(["setDebug", debug]),
    setTarget: (point, one) => calls.push(["setTarget", point, one]),
    setTargetMode: (mode, one) => calls.push(["setTargetMode", mode, one]),
    setTimeScale: (scale) => calls.push(["setTimeScale", scale]),
    start() {
      this.running = true;
      calls.push(["start"]);
    },
    stop() {
      this.running = false;
      calls.push(["stop"]);
    },
  };
  hosts.push({ host, options });
  return host;
};

const document = {
  baseURI: "https://example.test/demo/page.html",
  hidden: false,
  listeners: new Map(),
  readyState: "complete",
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  },
  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener),
    );
  },
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || [])
      listener(event);
  },
  querySelectorAll: () => [],
};
const context = {
  AbortController,
  console,
  CustomEvent: class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  },
  document,
  /* The schema rejects an object from another realm, so a response body is
     parsed by the page that receives it, exactly as a real one would be. */
  fetch: async (url) => {
    const bodies = {
      "https://example.test/cast/manifest.json": JSON.stringify({
        schemaVersion: 1,
        sources: ["a.json", { src: "b.json", weight: 4 }],
      }),
      "https://example.test/cast/a.json": descriptorJson("a"),
      "https://example.test/cast/b.json": descriptorJson("b"),
    };
    return { ok: true, json: async () => parseInContext(bodies[url]) };
  },
  hostFor: async (options) => newHost(options),
  IntersectionObserver: class IntersectionObserver {
    constructor(callback) {
      intersectionCallback = callback;
    }
    observe() {}
    disconnect() {}
  },
  queueMicrotask,
  ResizeObserver: undefined,
  setTimeout,
  URL,
};
context.window = context;
vm.createContext(context);
const parseInContext = vm.runInContext("JSON.parse", context);
const namedDescriptor = (name) => parseInContext(descriptorJson(name));

(async () => {
  /* Only the runtime stands in; the descriptors, the cast loader, and the
     schema the mount boundary hands them to are the shipped ones. */
  const code = await bundleFor({
    source: 'export { default } from "./canvas.mjs";',
    name: "BeefwifeCanvas",
    aliases: { "./runtime.mjs": `${__dirname}/runtime-stub.mjs` },
  });
  vm.runInContext(code, context, { filename: "beefwife-canvas.js" });

  let checks = 0;
  const canvas = new Canvas({
    "data-beefwife-canvas": "",
    "data-beefwife-manifest": "https://example.test/cast/manifest.json",
    "data-beefwife-count": "9",
    "data-beefwife-debug-targets": "true",
    "data-beefwife-target-mode": "manual",
    "data-beefwife-pointer-input": "click",
    "data-beefwife-wander-delay": "7",
    "data-beefwife-knee-projection-center": "viewport",
  });
  let ready = 0;
  canvas.addEventListener("beefwifecanvasready", () => ready++);
  const suppliedFilter = { name: "supplied" };
  const runtime = await context.BeefwifeCanvas.mount(canvas, {
    autoStart: false,
    count: 5,
    debugRoutes: true,
    filters: [suppliedFilter],
  });
  const created = hosts[0];
  assert.equal(ready, 1);
  assert.equal(canvas.dataset.beefwifeState, "stopped");
  assert.equal(runtime.state, "stopped");
  assert.equal(runtime.pauseReason, null);
  assert.equal(created.options.count, 5);
  assert.equal(
    JSON.stringify(created.options.debug),
    '{"routes":true,"targets":true,"terrain":false}',
  );
  assert.equal(created.options.targetMode, "manual");
  assert.equal(created.options.imageRendering, "pixelated");
  assert.equal(created.options.wanderDelay, 7);
  assert.equal(created.options.kneeProjectionCenter, "viewport");
  assert.equal(created.options.castWeights.a, 1);
  assert.equal(created.options.castWeights.b, 4);
  assert.equal(created.options.filters.length, 1);
  assert.equal(created.options.filters[0], suppliedFilter);
  assert.equal(context.BeefwifeCanvas.get(canvas), runtime);
  checks += 15;

  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(runtime.host, undefined);
  assert.equal(runtime.options, undefined);
  assert.equal(await runtime.ready, runtime);
  assert.equal("arrivalRadius" in created.options.roam, false);
  assert.equal("waypointRadius" in created.options.roam, false);
  assert.equal(created.options.terrain.avoid, ".beefwife-avoid");
  assert.equal(created.options.terrain.edgeMargin, 25);
  assert.equal(created.options.terrain.obstaclePadding, 0);
  assert.deepEqual(Object.keys(created.options.terrain), [
    "avoid",
    "edgeMargin",
    "obstaclePadding",
  ]);
  checks += 10;

  canvas.dispatchEvent({ type: "click", clientX: 340, clientY: 250 });
  assert.equal(calls.at(-1)[0], "setTarget");
  assert.equal(JSON.stringify(calls.at(-1)[1]), '{"x":300,"y":180}');
  runtime.setTargetMode("wander");
  assert.equal(calls.at(-1)[0], "setTargetMode");
  runtime.setPointerInput("move");
  canvas.dispatchEvent({ type: "pointermove", clientX: 140, clientY: 170 });
  assert.equal(JSON.stringify(calls.at(-1)[1]), '{"x":100,"y":100}');
  const callsBeforeLeave = calls.length;
  canvas.dispatchEvent({ type: "pointerleave" });
  assert.equal(calls.length, callsBeforeLeave);
  runtime.start();
  document.hidden = true;
  document.dispatchEvent({ type: "visibilitychange" });
  assert.equal(canvas.dataset.beefwifeState, "paused");
  assert.equal(canvas.dataset.beefwifePauseReason, "hidden");
  assert.equal(runtime.state, "paused");
  assert.equal(runtime.pauseReason, "hidden");
  document.hidden = false;
  document.dispatchEvent({ type: "visibilitychange" });
  assert.equal(canvas.dataset.beefwifeState, "running");
  assert.equal(canvas.dataset.beefwifePauseReason, undefined);
  intersectionCallback([{ isIntersecting: false }]);
  assert.equal(canvas.dataset.beefwifeState, "paused");
  assert.equal(canvas.dataset.beefwifePauseReason, "offscreen");
  intersectionCallback([{ isIntersecting: true }]);
  assert.equal(canvas.dataset.beefwifeState, "running");
  runtime
    .stop()
    .setCount(3)
    .setTimeScale(0.5)
    .setDebug({ routes: false })
    .refreshTerrain();
  assert.equal(canvas.dataset.beefwifeState, "stopped");
  assert.deepEqual(
    calls.slice(-6).map((call) => call[0]),
    ["start", "stop", "setCount", "setTimeScale", "setDebug", "refreshTerrain"],
  );
  checks += 16;

  const handle = runtime.getActors()[0];
  assert.equal(runtime.getBeefwives, undefined);
  assert.equal(handle.name, "a");
  assert.deepEqual(handle.getPose(), { head: { x: 4, y: 5 } });
  assert.equal(handle.setTarget({ x: 12, y: 14 }), handle);
  assert.equal(calls.at(-1)[2], created.host.actors[0]);
  assert.equal(handle.setTargetMode("manual"), handle);
  assert.equal(handle.clearTarget(), handle);
  assert.equal(handle.respawn(), handle);
  assert.equal(handle.setDescriptor({ name: "edited" }), handle);
  assert.deepEqual(calls.at(-1), ["setDescriptor", { name: "edited" }]);
  assert.equal(handle.host, undefined);
  /* What a caller needs to draw its own debug layer: the plan, the goal, the
     measured field, and the frame rates the host is keeping. */
  assert.deepEqual(handle.getRoute(), [{ x: 7, y: 8 }]);
  assert.deepEqual(handle.getTarget(), { x: 12, y: 14 });
  assert.deepEqual(runtime.getTerrainView(), {
    bounds: { left: 1 },
    rectangles: [{ left: 2 }],
  });
  assert.equal(runtime.getStats().steps, 60);
  checks += 14;

  runtime.destroy();
  assert.equal(created.host.destroyed, true);
  assert.equal(canvas.dataset.beefwifeState, "destroyed");
  assert.equal(canvas.style.imageRendering, "crisp-edges");
  assert.equal(context.BeefwifeCanvas.get(canvas), null);
  assert.throws(() => handle.setTarget({ x: 1, y: 2 }), /destroyed/);
  assert.throws(() => handle.getRoute(), /destroyed/);
  assert.throws(() => runtime.getStats(), /destroyed/);
  checks += 7;

  const remounted = await context.BeefwifeCanvas.mount(canvas, {
    autoStart: false,
    descriptors: [namedDescriptor("again")],
  });
  assert.equal(remounted.getActors()[0].name, "again");
  remounted.destroy();
  checks++;

  const duplicateCanvas = new Canvas();
  let errored = 0;
  let failedRuntime = null;
  duplicateCanvas.addEventListener("beefwifecanvaserror", (event) => {
    errored++;
    failedRuntime = event.detail.controller;
    assert.equal(context.BeefwifeCanvas.get(duplicateCanvas), failedRuntime);
  });
  await assert.rejects(
    context.BeefwifeCanvas.mount(duplicateCanvas, {
      autoStart: false,
      descriptors: [namedDescriptor("same"), namedDescriptor("same")],
    }),
    /duplicate beefwife name/,
  );
  assert.equal(errored, 1);
  assert.equal(Object.isFrozen(failedRuntime), true);
  assert.equal(duplicateCanvas.dataset.beefwifeState, "error");
  assert.equal(context.BeefwifeCanvas.get(duplicateCanvas), null);
  const recovered = await context.BeefwifeCanvas.mount(duplicateCanvas, {
    autoStart: false,
    descriptors: [namedDescriptor("ok")],
  });
  assert.equal(recovered.getActors()[0].name, "ok");
  recovered.destroy();
  checks += 7;

  const invalidCanvas = new Canvas({
    "data-beefwife-canvas": "",
    "data-beefwife-antialias": "sometimes",
  });
  let invalidEvent = null;
  invalidCanvas.addEventListener("beefwifecanvaserror", (event) => {
    invalidEvent = event;
    assert.equal(
      context.BeefwifeCanvas.get(invalidCanvas),
      event.detail.controller,
    );
  });
  await assert.rejects(
    context.BeefwifeCanvas.mount(invalidCanvas),
    /true or false/,
  );
  assert.equal(invalidCanvas.dataset.beefwifeState, "error");
  assert.equal(invalidEvent.detail.error.name, "TypeError");
  assert.equal(Object.isFrozen(invalidEvent.detail.controller), true);
  assert.equal(context.BeefwifeCanvas.get(invalidCanvas), null);
  invalidCanvas.attributes.find(
    (attribute) => attribute.name === "data-beefwife-antialias",
  ).value = "false";
  const corrected = await context.BeefwifeCanvas.mount(invalidCanvas, {
    autoStart: false,
    descriptors: [namedDescriptor("corrected")],
  });
  assert.equal(corrected.getActors()[0].name, "corrected");
  corrected.destroy();
  checks += 7;

  const scannedCanvas = new Canvas({
    "data-beefwife-canvas": "",
    "data-beefwife-manifest": "https://example.test/cast/manifest.json",
  });
  document.querySelectorAll = () => [scannedCanvas];
  assert.equal(context.BeefwifeCanvas.scan(), undefined);
  const scanned = context.BeefwifeCanvas.get(scannedCanvas);
  assert.ok(scanned);
  assert.equal(await scanned.ready, scanned);
  context.BeefwifeCanvas.scan();
  assert.equal(context.BeefwifeCanvas.get(scannedCanvas), scanned);
  scanned.destroy();
  checks += 4;

  const additiveCanvas = new Canvas();
  const additive = await context.BeefwifeCanvas.mount(additiveCanvas, {
    autoStart: false,
    manifest: {
      schemaVersion: 1,
      sources: [{ src: "https://example.test/cast/a.json", weight: 2 }],
    },
    sources: { src: "https://example.test/cast/b.json", weight: 3 },
    descriptors: {
      descriptor: namedDescriptor("c"),
      weight: 4,
    },
  });
  const additiveOptions = hosts.at(-1).options;
  assert.deepEqual(Object.keys(additiveOptions.cast), ["c", "a", "b"]);
  assert.equal(
    JSON.stringify(additiveOptions.castWeights),
    '{"c":4,"a":2,"b":3}',
  );
  additive.destroy();
  checks += 2;

  console.log(`BeefwifeCanvas: ${checks} public-boundary checks passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
