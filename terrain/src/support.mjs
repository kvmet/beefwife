const NEXT_BUFFER = new ArrayBuffer(8);
const NEXT_VIEW = new DataView(NEXT_BUFFER);

const nextFloat = (value, up) => {
  if (value === 0) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
  NEXT_VIEW.setFloat64(0, value);
  let bits = NEXT_VIEW.getBigUint64(0);
  bits += (value > 0) === up ? 1n : -1n;
  NEXT_VIEW.setBigUint64(0, bits);
  return NEXT_VIEW.getFloat64(0);
};

const outside = (value, up) => {
  for (let i = 0; i < 2; i++) value = nextFloat(value, up);
  return value;
};

export const below = (value) => outside(value, false);
export const above = (value) => outside(value, true);

export const TERRAIN_CONFIG = Object.freeze({
  avoid: ".beefwife-avoid",
  edgeMargin: 25,
  obstaclePadding: 0,
  funnel: true,
});

const TERRAIN_OPTIONS = new Set([
  "avoid",
  "edgeMargin",
  "funnel",
  "obstaclePadding",
  "root",
  "viewport",
]);

export const finite = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${path} must be a finite number`);
  return value;
};

export const point = (value, path) => {
  if (!value || typeof value !== "object")
    throw new TypeError(`${path} must contain finite x and y coordinates`);
  return { x: finite(value.x, `${path}.x`), y: finite(value.y, `${path}.y`) };
};

export const optionsOf = (supplied) => {
  if (
    supplied === null ||
    typeof supplied !== "object" ||
    Array.isArray(supplied)
  )
    throw new TypeError("options must be an object");

  for (const key of Object.keys(supplied)) {
    if (!TERRAIN_OPTIONS.has(key))
      throw new TypeError(`options.${key} is unknown`);
  }

  const options = { ...TERRAIN_CONFIG, ...supplied };
  for (const key of ["edgeMargin", "obstaclePadding"]) {
    finite(options[key], `options.${key}`);
    if (options[key] < 0)
      throw new RangeError(`options.${key} must be nonnegative`);
  }
  if (typeof options.funnel !== "boolean")
    throw new TypeError("options.funnel must be true or false");

  const avoidType = typeof options.avoid;
  if (
    avoidType !== "string" &&
    avoidType !== "function" &&
    !options.avoid?.[Symbol.iterator]
  )
    throw new TypeError(
      "options.avoid must be a selector, iterable, or function",
    );
  if (
    options.root !== undefined &&
    typeof options.root?.querySelectorAll !== "function"
  )
    throw new TypeError("options.root must support querySelectorAll()");

  const viewportType = typeof options.viewport;
  if (
    options.viewport !== undefined &&
    viewportType !== "function" &&
    (options.viewport === null || viewportType !== "object")
  )
    throw new TypeError("options.viewport must be a rectangle or function");
  return Object.freeze(options);
};

/** Twice the signed area of a triangle. Its sign selects a side of ab. */
export const cross2 = (a, b, c) =>
  (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);

export const minHeapPush = (nodes, scores, node, score) => {
  let i = nodes.length;
  nodes.push(node);
  scores.push(score);
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (scores[parent] <= score) break;
    nodes[i] = nodes[parent];
    scores[i] = scores[parent];
    i = parent;
  }
  nodes[i] = node;
  scores[i] = score;
};

export const minHeapPop = (nodes, scores) => {
  const root = nodes[0];
  const node = nodes.pop();
  const score = scores.pop();
  if (!nodes.length) return root;

  let i = 0;
  while (true) {
    const left = 2 * i + 1;
    if (left >= nodes.length) break;
    const right = left + 1;
    const child =
      right < nodes.length && scores[right] < scores[left] ? right : left;
    if (scores[child] >= score) break;
    nodes[i] = nodes[child];
    scores[i] = scores[child];
    i = child;
  }
  nodes[i] = node;
  scores[i] = score;
  return root;
};
