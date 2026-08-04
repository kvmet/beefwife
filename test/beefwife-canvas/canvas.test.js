/**
 * Does the public canvas boundary preserve its element, load atomically, and
 * keep targets and projection policy in the host? Parsed descriptors are the
 * control. It fails on attribute precedence, nonlocal clicks, duplicate names,
 * lifecycle leaks, or descriptor/goal policy entering Beefwife.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

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
const newHost = (options) => {
  const actor = {
    name: Object.keys(options.cast)[0],
    beefwife: { getPose: () => ({ head: { x: 4, y: 5 } }) },
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
    rebuild: () => calls.push(["rebuild"]),
    refreshTerrain: () => calls.push(["refreshTerrain"]),
    respawn: (one) => calls.push(["respawn", one]),
    setCount: (count) => calls.push(["setCount", count]),
    setDebug: (debug) => calls.push(["setDebug", debug]),
    setTarget: (point, one) => calls.push(["setTarget", point, one]),
    setTargeting: (mode, one) => calls.push(["setTargeting", mode, one]),
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
  readyState: "complete",
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
  BeefwifeDescriptor: {
    read(value) {
      if (!value || typeof value.name !== "string")
        throw new TypeError("descriptor needs a name");
      return JSON.parse(JSON.stringify(value));
    },
  },
  BeefwifeCanvasRuntime: { create: async (options) => newHost(options) },
  document,
  fetch: async (url) => {
    const values = {
      "https://example.test/cast/manifest.json": {
        schemaVersion: 1,
        sources: ["a.json", { src: "b.json", weight: 4 }],
      },
      "https://example.test/cast/a.json": { name: "a" },
      "https://example.test/cast/b.json": { name: "b" },
    };
    return { ok: true, json: async () => values[url] };
  },
  IntersectionObserver: undefined,
  queueMicrotask,
  ResizeObserver: undefined,
  setTimeout,
  URL,
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(
    `${__dirname}/../../beefwife-canvas/beefwife-canvas-cast.js`,
    "utf8",
  ),
  context,
  { filename: "beefwife-canvas-cast.js" },
);
vm.runInContext(
  fs.readFileSync(
    `${__dirname}/../../beefwife-canvas/beefwife-canvas.js`,
    "utf8",
  ),
  context,
  { filename: "beefwife-canvas.js" },
);

(async () => {
  let checks = 0;
  const canvas = new Canvas({
    "data-beefwife-canvas": "",
    "data-beefwife-manifest": "https://example.test/cast/manifest.json",
    "data-beefwife-count": "9",
    "data-beefwife-debug-targets": "true",
    "data-beefwife-targeting": "click",
    "data-beefwife-wander-delay": "7",
    "data-beefwife-projection-center": "viewport",
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
  assert.equal(created.options.count, 5);
  assert.equal(
    JSON.stringify(created.options.debug),
    '{"navigation":false,"routes":true,"targets":true,"terrain":false}',
  );
  assert.equal(created.options.targeting, "click");
  assert.equal(created.options.wanderDelay, 7);
  assert.equal(created.options.projectionCenter, "viewport");
  assert.equal(created.options.castWeights.a, 1);
  assert.equal(created.options.castWeights.b, 4);
  assert.equal(created.options.filters.length, 1);
  assert.equal(created.options.filters[0], suppliedFilter);
  assert.equal(context.BeefwifeCanvas.get(canvas), runtime);
  checks += 12;

  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(runtime.host, undefined);
  assert.equal(runtime.options, undefined);
  assert.equal(await runtime.ready, runtime);
  assert.equal("arrive" in created.options.roam, false);
  assert.equal(created.options.terrain.avoid, undefined);
  checks += 6;

  canvas.dispatchEvent({ type: "click", clientX: 340, clientY: 250 });
  assert.equal(calls.at(-1)[0], "setTarget");
  assert.equal(JSON.stringify(calls.at(-1)[1]), '{"x":300,"y":180}');
  runtime.setTargeting("pointer");
  canvas.dispatchEvent({ type: "pointermove", clientX: 140, clientY: 170 });
  assert.equal(JSON.stringify(calls.at(-1)[1]), '{"x":100,"y":100}');
  const callsBeforeLeave = calls.length;
  canvas.dispatchEvent({ type: "pointerleave" });
  assert.equal(calls.length, callsBeforeLeave);
  runtime
    .start()
    .stop()
    .setCount(3)
    .setTimeScale(0.5)
    .setDebug({ navigation: true })
    .refreshTerrain();
  assert.equal(canvas.dataset.beefwifeState, "stopped");
  assert.deepEqual(
    calls.slice(-6).map((call) => call[0]),
    [
      "start",
      "stop",
      "setCount",
      "setTimeScale",
      "setDebug",
      "refreshTerrain",
    ],
  );
  checks += 5;

  const handle = runtime.getBeefwives()[0];
  assert.equal(handle.name, "a");
  assert.deepEqual(handle.getPose(), { head: { x: 4, y: 5 } });
  handle.setTarget({ x: 12, y: 14 });
  assert.equal(calls.at(-1)[2], created.host.actors[0]);
  checks += 3;

  runtime.destroy();
  assert.equal(created.host.destroyed, true);
  assert.equal(canvas.dataset.beefwifeState, "destroyed");
  assert.equal(canvas.style.imageRendering, "crisp-edges");
  assert.equal(context.BeefwifeCanvas.get(canvas), null);
  assert.throws(() => handle.setTarget({ x: 1, y: 2 }), /destroyed/);
  checks += 5;

  const remounted = await context.BeefwifeCanvas.mount(canvas, {
    autoStart: false,
    descriptors: [{ name: "again" }],
  });
  assert.equal(remounted.getBeefwives()[0].name, "again");
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
      descriptors: [{ name: "same" }, { name: "same" }],
    }),
    /duplicate beefwife name/,
  );
  assert.equal(errored, 1);
  assert.equal(Object.isFrozen(failedRuntime), true);
  assert.equal(duplicateCanvas.dataset.beefwifeState, "error");
  assert.equal(context.BeefwifeCanvas.get(duplicateCanvas), null);
  const recovered = await context.BeefwifeCanvas.mount(duplicateCanvas, {
    autoStart: false,
    descriptors: [{ name: "ok" }],
  });
  assert.equal(recovered.getBeefwives()[0].name, "ok");
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
    descriptors: [{ name: "corrected" }],
  });
  assert.equal(corrected.getBeefwives()[0].name, "corrected");
  corrected.destroy();
  checks += 7;

  console.log(`BeefwifeCanvas: ${checks} public-boundary checks passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
