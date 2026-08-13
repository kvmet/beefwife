/**
 * Does the generated bundle execute with exactly one public global? The seeded
 * browser-shaped context is the control. It fails on load-order errors, a
 * missing BeefwifeCanvas API, or any added global besides BeefwifeCanvas.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const bundlePath = path.join(
  __dirname,
  "..",
  "..",
  "beefwife-canvas",
  "beefwife-canvas.js",
);
if (!fs.existsSync(bundlePath))
  throw new Error("run `npm --prefix beefwife-canvas run build` first");

const queuedMicrotasks = [];
const document = {
  readyState: "complete",
  querySelectorAll: () => [],
};
const context = {
  AbortController,
  clearTimeout,
  console,
  CustomEvent: class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  },
  document,
  queueMicrotask: (callback) => queuedMicrotasks.push(callback),
  setTimeout,
  URL,
};
context.window = context;
const seededGlobals = new Set(Reflect.ownKeys(context));

vm.createContext(context);
vm.runInContext(fs.readFileSync(bundlePath, "utf8"), context, {
  filename: bundlePath,
});

const addedGlobals = Reflect.ownKeys(context).filter(
  (key) => !seededGlobals.has(key),
);
assert.deepEqual(addedGlobals, ["BeefwifeCanvas"]);
assert.equal(typeof context.BeefwifeCanvas.get, "function");
assert.equal(typeof context.BeefwifeCanvas.mount, "function");
assert.equal(typeof context.BeefwifeCanvas.scan, "function");
// The one global carries the schema out with it; nothing else can reach it.
for (const key of ["read", "parse", "stringify"])
  assert.equal(typeof context.BeefwifeCanvas.Descriptor[key], "function");
assert.equal(context.BeefwifeCanvas.Descriptor.VERSION, 1);
assert.equal(queuedMicrotasks.length, 1);
queuedMicrotasks.shift()();
assert.deepEqual(
  Reflect.ownKeys(context).filter((key) => !seededGlobals.has(key)),
  ["BeefwifeCanvas"],
);

console.log("BeefwifeCanvas bundle: one global, load order valid");
