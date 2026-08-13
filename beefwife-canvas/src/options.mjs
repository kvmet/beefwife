/** Limits and scalar option validation for the BeefwifeCanvasRuntime frame host. */

import { BeefwifeCanvasActor as ActorClass } from "./actor.mjs";

const DEBUG_KEYS = new Set(["routes", "targets", "terrain"]);
// Step bounds are owned by BeefwifeCanvasActor; the host only re-exposes them.
const config = {
  MAX_DT: ActorClass.MAX_DT,
  /* A guard against a mistyped `count` on a mount, not a structural limit:
     nothing here is sized against it. Set past where a page is unusable
     anyway, so it never binds a real population. The cheapest shipped cast
     costs 11.2us a creature a frame, which is 11.5ms of a 16.7ms frame at
     this many. */
  MAX_COUNT: 1024,
  MAX_TIME_SCALE: ActorClass.MAX_TIME_SCALE,
  REBUILD_DELAY: 150, // ms debounce for terrain measurements
};

const countOf = (value) => {
  if (!Number.isInteger(value) || value < 0 || value > config.MAX_COUNT)
    throw new RangeError(
      `count must be an integer from 0 to ${config.MAX_COUNT}`,
    );
  return value;
};
const timeScaleOf = ActorClass.timeScaleOf;
const debugOf = (value, current) => {
  const result = current
    ? { ...current }
    : { routes: false, targets: false, terrain: false };
  if (value === undefined) return result;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("debug must be an object");
  for (const [key, enabled] of Object.entries(value)) {
    if (!DEBUG_KEYS.has(key)) throw new TypeError(`debug.${key} is unknown`);
    if (typeof enabled !== "boolean")
      throw new TypeError(`debug.${key} must be a boolean`);
    result[key] = enabled;
  }
  return result;
};
const resolutionScaleOf = (value) => {
  if (!Number.isFinite(value) || value < 0.125 || value > 1)
    throw new RangeError("resolutionScale must be from 0.125 to 1");
  return value;
};
const imageRenderingOf = (value) => {
  if (!["auto", "pixelated"].includes(value))
    throw new RangeError("imageRendering must be auto or pixelated");
  return value;
};
const renderFpsOf = (value) => {
  if (value === undefined || value === 0) return 0;
  if (!Number.isFinite(value) || value < 1 || value > 240)
    throw new RangeError("renderFps must be 0 or from 1 to 240");
  return value;
};
const physicsFpsOf = (value) => {
  if (value === undefined || value === 0) return 0;
  if (!Number.isFinite(value) || value < 1 || value > 240)
    throw new RangeError("physicsFps must be 0 or from 1 to 240");
  return value;
};
const chooseName = (cast, weights, random) => {
  const names = Object.keys(cast);
  if (!names.length) throw new Error("cast must contain at least one beefwife");
  const weighted = names.map((name) => {
    const weight = weights?.[name] ?? 1;
    if (!Number.isFinite(weight) || weight <= 0)
      throw new RangeError(`weight for ${name} must be positive`);
    return { name, weight };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let sample = random() * total;
  for (const entry of weighted) {
    sample -= entry.weight;
    if (sample < 0) return entry.name;
  }
  return weighted[weighted.length - 1].name;
};

export {
  config,
  chooseName,
  countOf,
  debugOf,
  imageRenderingOf,
  physicsFpsOf,
  renderFpsOf,
  resolutionScaleOf,
  timeScaleOf,
};
