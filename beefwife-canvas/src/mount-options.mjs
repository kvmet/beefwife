/** Public mount-option and declarative-attribute validation. */

const BOOLEAN = new Set(["true", "false"]);
// JavaScript-only options have `attribute: false`. Defaults here are
// BeefwifeCanvas opinions; otherwise the owning runtime layer supplies one.
const OPTIONS = {
  antialias: { type: "boolean", default: false },
  arrivalRadius: { type: "number" },
  autoStart: { type: "boolean", default: true },
  avoid: { type: "string", default: ".beefwife-avoid" },
  count: { type: "number" },
  debugRoutes: { type: "boolean", default: false },
  debugTargets: { type: "boolean", default: false },
  debugTerrain: { type: "boolean", default: false },
  descriptors: { attribute: false },
  drawFps: { type: "number" },
  edgeMargin: { type: "number", default: 25 },
  escapeReplanSeconds: { type: "number" },
  filters: { attribute: false },
  imageRendering: { type: "string", default: "pixelated" },
  kneePerspective: { type: "number", default: 0.002 },
  kneeProjectionCenter: { type: "string" },
  manifest: { type: "string" },
  maxKneeOffset: { type: "number" },
  maxPixelRatio: { type: "number", default: 2 },
  obstaclePadding: { type: "number", default: 0 },
  pauseHidden: { type: "boolean", default: true },
  pauseOffscreen: { type: "boolean", default: true },
  pointerInput: { type: "string", default: "none" },
  random: { attribute: false },
  resolutionScale: { type: "number", default: 0.25 },
  roundVertices: { type: "boolean", default: true },
  simulationFps: { type: "number" },
  sources: { type: "sources" },
  stuckReplanSeconds: { type: "number" },
  targetMode: { type: "string", default: "wander" },
  throttleEase: { type: "number" },
  timeScale: { type: "number" },
  waypointRadius: { type: "number" },
  wanderDelay: { type: "number" },
};
const kebab = (key) =>
  key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const ATTRIBUTES = {};
const DEFAULTS = {};
for (const [key, rule] of Object.entries(OPTIONS)) {
  if (rule.attribute !== false)
    ATTRIBUTES[`data-beefwife-${kebab(key)}`] = [key, rule.type];
  if (rule.default !== undefined) DEFAULTS[key] = rule.default;
}

const parseAttribute = (value, type, name) => {
  if (type === "string") return value;
  if (type === "sources")
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  if (type === "boolean") {
    if (!BOOLEAN.has(value))
      throw new TypeError(`${name} must be true or false`);
    return value === "true";
  }
  const number = Number(value);
  if (!Number.isFinite(number))
    throw new TypeError(`${name} must be a finite number`);
  return number;
};

const attributesOf = (canvas) => {
  const options = {};
  for (const attribute of canvas.attributes) {
    if (!attribute.name.startsWith("data-beefwife-")) continue;
    if (
      attribute.name === "data-beefwife-canvas" ||
      attribute.name === "data-beefwife-state"
    )
      continue;
    const rule = ATTRIBUTES[attribute.name];
    if (!rule) throw new TypeError(`${attribute.name} is unknown`);
    options[rule[0]] = parseAttribute(attribute.value, rule[1], attribute.name);
  }
  return options;
};

const optionsOf = (canvas, supplied) => {
  if (
    supplied === null ||
    typeof supplied !== "object" ||
    Array.isArray(supplied)
  )
    throw new TypeError("options must be an object");
  for (const key of Object.keys(supplied)) {
    if (!OPTIONS[key]) throw new TypeError(`options.${key} is unknown`);
  }
  const options = { ...DEFAULTS, ...attributesOf(canvas), ...supplied };
  for (const [key, rule] of Object.entries(OPTIONS)) {
    const value = options[key];
    if (value === undefined) continue;
    if (rule.type === "boolean" && typeof value !== "boolean")
      throw new TypeError(`${key} must be true or false`);
    if (rule.type === "number" && !Number.isFinite(value))
      throw new TypeError(`${key} must be a finite number`);
    if (key === "avoid" && typeof value !== "string")
      throw new TypeError("avoid must be a selector string");
  }
  if (options.count !== undefined && !Number.isInteger(options.count))
    throw new TypeError("count must be an integer");
  if (options.random !== undefined && typeof options.random !== "function")
    throw new TypeError("random must be a function");
  if (options.filters !== undefined && !Array.isArray(options.filters))
    throw new TypeError("filters must be an array");
  if (!["auto", "pixelated"].includes(options.imageRendering))
    throw new RangeError("imageRendering must be auto or pixelated");
  if (!["none", "click", "move"].includes(options.pointerInput))
    throw new RangeError("pointerInput must be none, click, or move");
  if (!["wander", "manual"].includes(options.targetMode))
    throw new RangeError("targetMode must be wander or manual");
  for (const key of [
    "edgeMargin",
    "escapeReplanSeconds",
    "kneePerspective",
    "maxKneeOffset",
    "obstaclePadding",
    "stuckReplanSeconds",
    "wanderDelay",
  ]) {
    if (options[key] < 0) throw new RangeError(`${key} must be nonnegative`);
  }
  if (options.arrivalRadius !== undefined && options.arrivalRadius <= 1)
    throw new RangeError("arrivalRadius must be greater than 1");
  if (options.waypointRadius !== undefined && options.waypointRadius <= 1)
    throw new RangeError("waypointRadius must be greater than 1");
  if (options.throttleEase !== undefined && options.throttleEase <= 0)
    throw new RangeError("throttleEase must be positive");
  return options;
};

const ROAM_KEYS = {
  arrivalRadius: "arrivalRadius",
  throttleEase: "ease",
  stuckReplanSeconds: "patience",
  escapeReplanSeconds: "replan",
  waypointRadius: "waypointRadius",
};
const roamOf = (options) => {
  const roam = {};
  for (const [option, key] of Object.entries(ROAM_KEYS)) {
    if (options[option] !== undefined) roam[key] = options[option];
  }
  return roam;
};

const TERRAIN_KEYS = ["avoid", "edgeMargin", "obstaclePadding"];
const terrainOf = (options) => {
  const terrain = {};
  for (const key of TERRAIN_KEYS) {
    if (options[key] !== undefined) terrain[key] = options[key];
  }
  return terrain;
};

export { optionsOf, roamOf, terrainOf };
