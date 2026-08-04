var Terrain = (() => {
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
const below = (value) => outside(value, false);
const above = (value) => outside(value, true);
// Defaults for any option the constructor's options object leaves unset.
const TERRAIN_CONFIG = Object.freeze({
  avoid: ".beefwife-avoid", // elements that are out of bounds
  edgeMargin: 25, // px inset from the viewport edge, out of bounds like an element
  obstaclePadding: 0, // px grown around each keep-out rect
  funnel: true, // pull a route taut, instead of a point at every gate crossed
});
const TERRAIN_OPTIONS = new Set(
  ["avoid", "edgeMargin", "funnel", "obstaclePadding", "root", "viewport"],
);
const finite = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${path} must be a finite number`);
  return value;
};
const point = (value, path) => {
  if (!value || typeof value !== "object")
    throw new TypeError(`${path} must contain finite x and y coordinates`);
  return { x: finite(value.x, `${path}.x`), y: finite(value.y, `${path}.y`) };
};
const optionsOf = (supplied) => {
  if (supplied === null || typeof supplied !== "object" || Array.isArray(supplied))
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
    throw new TypeError("options.avoid must be a selector, iterable, or function");
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
/** Twice the signed area of a triangle. Sign says which side of ab c is on. */
const cross2 = (a, b, c) =>
  (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
const minHeapPush = (nodes, scores, node, score) => {
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
const minHeapPop = (nodes, scores) => {
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
class Terrain {
  constructor(options = {}) {
    this.options = optionsOf(options);
    this._reset();
  }

  get ready() {
    return this._built && this.cells.length > 0;
  }
  build() {
    this._reset();
    const viewport = this._viewport();
    const margin = this.options.edgeMargin;
    this.viewport = viewport;
    this.width = viewport.width;
    this.height = viewport.height;
    this.x0 = Math.min(margin, this.width / 2);
    this.y0 = Math.min(margin, this.height / 2);
    this.x1 = this.width - this.x0;
    this.y1 = this.height - this.y0;
    this.rects = this._measure();
    this._buildSlabs();
    this._built = true;
    return this;
  }
  avoidElements() {
    let source = this.options.avoid;
    const supplied = typeof source === "function";
    if (supplied) source = source();
    if (typeof source === "string") {
      if (supplied) throw new TypeError("options.avoid() must return an iterable");
      const root = this.options.root || globalThis.document;
      if (typeof root?.querySelectorAll !== "function")
        throw new Error("a document or options.root is required for a selector");
      return Array.from(root.querySelectorAll(source));
    }
    if (!source?.[Symbol.iterator])
      throw new TypeError("options.avoid() must return an iterable");
    return Array.from(source);
  }
  _viewport() {
    const configured = this.options.viewport;
    if (configured !== undefined) {
      const viewport =
        typeof configured === "function" ? configured() : configured;
      if (!viewport || typeof viewport !== "object")
        throw new TypeError("viewport must be a rectangle");
      const { left = 0, top = 0, width, height } = viewport;
      finite(left, "viewport.left");
      finite(top, "viewport.top");
      finite(width, "viewport.width");
      finite(height, "viewport.height");
      if (width < 0 || height < 0)
        throw new RangeError("viewport width and height must be nonnegative");
      return { left, top, width, height };
    }
    const view = globalThis.window;
    if (!view)
      throw new Error("a window or options.viewport is required to build");
    const viewport = {
      left: 0,
      top: 0,
      width: finite(view.innerWidth, "window.innerWidth"),
      height: finite(view.innerHeight, "window.innerHeight"),
    };
    if (viewport.width < 0 || viewport.height < 0)
      throw new RangeError("viewport width and height must be nonnegative");
    return viewport;
  }
  _reset() {
    this._built = false;
    this.rects = [];
    this.cells = [];
    this.slabs = [];
    this.gates = [];
    this.x0 = this.y0 = this.x1 = this.y1 = 0;
    this.width = this.height = 0;
    this.viewport = { left: 0, top: 0, width: 0, height: 0 };
  }
  /** Snapshot DOMRects so at() and route() never trigger layout. */
  _measure() {
    const out = [];
    const padding = this.options.obstaclePadding;
    const viewport = this.viewport;
    const elements = [...new Set(this.avoidElements())];
    elements.forEach((el, index) => {
      if (typeof el?.getBoundingClientRect !== "function")
        throw new TypeError(`avoid[${index}] must support getBoundingClientRect()`);
      const r = el.getBoundingClientRect();
      if (!r || typeof r !== "object")
        throw new TypeError(`avoid[${index}] returned an invalid rectangle`);
      for (const side of ["left", "top", "right", "bottom"])
        finite(r[side], `avoid[${index}].${side}`);
      if (r.right < r.left || r.bottom < r.top)
        throw new RangeError(`avoid[${index}] rectangle is inverted`);
      const rect = {
        left: r.left - viewport.left - padding,
        top: r.top - viewport.top - padding,
        right: r.right - viewport.left + padding,
        bottom: r.bottom - viewport.top + padding,
      };
      for (const side of ["left", "top", "right", "bottom"])
        finite(rect[side], `avoid[${index}].expanded.${side}`);
      if (
        rect.right < 0 ||
        rect.bottom < 0 ||
        rect.left > this.width ||
        rect.top > this.height
      )
        return;
      out.push(rect);
    });
    return out;
  }
  _covered(x, y) {
    const list = this.rects;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return true;
      }
    }
    return false;
  }
  /** Open y spans on a line through the guarded obstacle mesh. */
  _open(c, out) {
    if (c < this.x0 || c > this.x1) return;
    let open = this.y0;
    const end = this.y1;
    if (open >= end) return;
    const blocked = [];
    for (const r of this.rects) {
      if (c > below(r.left) && c < above(r.right))
        blocked.push([below(r.top), above(r.bottom)]);
    }
    blocked.sort((a, b) => a[0] - b[0]);
    for (const [from, to] of blocked) {
      if (from >= end) break;
      if (from > open) out.push({ lo: open, hi: Math.min(from, end) });
      if (to > open) open = to;
      if (open >= end) return;
    }
    out.push({ lo: open, hi: end });
  }
  at(x, y, result = {}) {
    finite(x, "x");
    finite(y, "y");
    if (!result || typeof result !== "object")
      throw new TypeError("result must be an object");
    if (!this.ready) return null;
    if (
      x >= this.x0 &&
      x <= this.x1 &&
      y >= this.y0 &&
      y <= this.y1 &&
      !this._covered(x, y)
    ) {
      result.dx = 0;
      result.dy = 0;
      result.d = 0;
      return result;
    }
    let nearD = Infinity;
    let nearX = 0;
    let nearY = 0;
    for (const slab of this.slabs) {
      const cells = slab.cells;
      if (!cells.length) continue;
      const toX = Math.max(slab.left, Math.min(slab.right, x)) - x;
      if (Math.abs(toX) >= nearD) continue;
      let lo = 0;
      let hi = cells.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cells[mid].hi < y) lo = mid + 1;
        else hi = mid;
      }
      const first = Math.max(0, lo - 1);
      const last = Math.min(cells.length - 1, lo);
      for (let index = first; index <= last; index++) {
        const cell = cells[index];
        const toY = Math.max(cell.lo, Math.min(cell.hi, y)) - y;
        const d = Math.hypot(toX, toY);
        if (d < nearD) {
          nearD = d;
          nearX = toX;
          nearY = toY;
        }
      }
    }
    if (nearD === Infinity || nearD === 0) return null;
    result.dx = nearX / nearD;
    result.dy = nearY / nearD;
    result.d = above(nearD);
    return result;
  }
  /**
   * Cuts just outside every x edge make occupancy constant within each slab.
   * The small floating-point guard keeps closed obstacle edges out of cells.
   */
  _buildSlabs() {
    const cuts = [this.x0, this.x1];
    for (const r of this.rects) {
      for (const c of [below(r.left), above(r.right)]) {
        if (c > this.x0 && c < this.x1) cuts.push(c);
      }
    }
    cuts.sort((a, b) => a - b);
    this.cells = [];
    this.slabs = [];
    this.gates = [];
    let behind = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const left = cuts[i];
      const right = cuts[i + 1];
      if (right <= left) continue;
      const spans = [];
      this._open(left / 2 + right / 2, spans);
      const slab = [];
      for (const s of spans) {
        const cell = { left, right, lo: s.lo, hi: s.hi, gates: [] };
        this.cells.push(cell);
        slab.push(cell);
      }
      this.slabs.push({ left, right, cells: slab });
      this._connect(behind, slab);
      behind = slab;
    }
  }
  _connect(left, right) {
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      const a = left[i];
      const b = right[j];
      this._gate(a, b);
      if (a.hi <= b.hi) i++;
      if (b.hi <= a.hi) j++;
    }
  }
  _gate(a, b) {
    const lo = Math.max(a.lo, b.lo);
    const hi = Math.min(a.hi, b.hi);
    if (hi <= lo) return;
    const x = a.right;
    const gate = {
      id: this.gates.length,
      x,
      lo,
      hi,
      low: { x, y: lo },
      high: { x, y: hi },
      mid: { x, y: lo / 2 + hi / 2 },
      a, b,
    };
    a.gates.push(gate);
    b.gates.push(gate);
    this.gates.push(gate);
  }
  _land(p) {
    const f = this.at(p.x, p.y);
    if (!f) return null;
    if (f.d === 0) return { x: p.x, y: p.y };
    return { x: p.x + f.dx * f.d, y: p.y + f.dy * f.d };
  }
  _seat(p) {
    for (const slab of this.slabs) {
      if (p.x < slab.left || p.x > slab.right) continue;
      let lo = 0;
      let hi = slab.cells.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (slab.cells[mid].hi < p.y) lo = mid + 1;
        else hi = mid;
      }
      const cell = slab.cells[lo];
      if (cell && p.y >= cell.lo)
        return { cell, point: { x: p.x, y: p.y } };
    }
    let best = null;
    let bestD = Infinity;
    for (const cell of this.cells) {
      const x = Math.max(cell.left, Math.min(cell.right, p.x));
      const y = Math.max(cell.lo, Math.min(cell.hi, p.y));
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d === 0) return { cell, point: { x: p.x, y: p.y } };
      if (d >= bestD) continue;
      const point = { x, y };
      if (this._visible(p, point)) {
        bestD = d;
        best = { cell, point };
      }
    }
    return best;
  }
  _visible(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    for (const r of this.rects) {
      if (
        Math.max(a.x, b.x) < r.left ||
        Math.min(a.x, b.x) > r.right ||
        Math.max(a.y, b.y) < r.top ||
        Math.min(a.y, b.y) > r.bottom
      )
        continue;
      let enter = 0;
      let leave = 1;
      if (dx === 0) {
        if (a.x < r.left || a.x > r.right) continue;
      } else {
        const left = (r.left - a.x) / dx;
        const right = (r.right - a.x) / dx;
        enter = Math.max(enter, Math.min(left, right));
        leave = Math.min(leave, Math.max(left, right));
        if (enter > leave) continue;
      }
      if (dy === 0) {
        if (a.y < r.top || a.y > r.bottom) continue;
      } else {
        const top = (r.top - a.y) / dy;
        const bottom = (r.bottom - a.y) / dy;
        enter = Math.max(enter, Math.min(top, bottom));
        leave = Math.min(leave, Math.max(top, bottom));
        if (enter > leave) continue;
      }
      return false;
    }
    return true;
  }
  /**
   * A* over directed gate crossings. 2 * id enters a; 2 * id + 1 enters b.
   * Costs and the Euclidean goal heuristic use gate centers; the funnel only
   * shortens the selected corridor.
   */
  _cross(from, start, to, goal) {
    const size = 2 * this.gates.length;
    const cost = new Float64Array(size).fill(Infinity);
    const prev = new Int32Array(size).fill(-1);
    const done = new Uint8Array(size);
    const heapNodes = [];
    const heapScores = [];
    for (const g of from.gates) {
      const k = 2 * g.id + (g.a === from ? 1 : 0);
      const first = Math.hypot(g.mid.x - start.x, g.mid.y - start.y);
      cost[k] = first;
      minHeapPush(
        heapNodes,
        heapScores,
        k,
        first + Math.hypot(g.mid.x - goal.x, g.mid.y - goal.y),
      );
    }
    while (heapNodes.length) {
      const k = minHeapPop(heapNodes, heapScores);
      if (done[k]) continue;
      done[k] = 1;
      const gate = this.gates[k >> 1];
      const cell = k & 1 ? gate.b : gate.a;
      if (cell === to) {
        const walk = [];
        for (let at = k; at >= 0; at = prev[at]) walk.push(at);
        walk.reverse();
        return walk.map((at) => ({
          gate: this.gates[at >> 1],
          forward: (at & 1) === 1,
        }));
      }
      const low = cost[k];
      for (const next of cell.gates) {
        if (next === gate) continue;
        const n = 2 * next.id + (next.a === cell ? 1 : 0);
        const step =
          low + Math.hypot(next.mid.x - gate.mid.x, next.mid.y - gate.mid.y);
        if (step >= cost[n]) continue;
        cost[n] = step;
        prev[n] = k;
        minHeapPush(
          heapNodes,
          heapScores,
          n,
          step + Math.hypot(next.mid.x - goal.x, next.mid.y - goal.y),
        );
      }
    }
    return null;
  }
  _taut(start, crossings, goal) {
    const out = [start];
    let apex = start;
    let left = start;
    let right = start;
    let apexAt = 0;
    let leftAt = 0;
    let rightAt = 0;
    for (let i = 0; i <= crossings.length; i++) {
      const crossing = crossings[i];
      const gateLeft = crossing
        ? crossing.forward
          ? crossing.gate.high
          : crossing.gate.low
        : goal;
      const gateRight = crossing
        ? crossing.forward
          ? crossing.gate.low
          : crossing.gate.high
        : goal;
      if (cross2(apex, right, gateRight) <= 0) {
        if (right === apex || cross2(apex, left, gateRight) > 0) {
          right = gateRight;
          rightAt = i;
        } else {
          out.push(left);
          apex = left;
          apexAt = leftAt;
          left = apex;
          right = apex;
          leftAt = apexAt;
          rightAt = apexAt;
          i = apexAt;
          continue;
        }
      }
      if (cross2(apex, left, gateLeft) >= 0) {
        if (left === apex || cross2(apex, right, gateLeft) < 0) {
          left = gateLeft;
          leftAt = i;
        } else {
          out.push(right);
          apex = right;
          apexAt = rightAt;
          left = apex;
          right = apex;
          leftAt = apexAt;
          rightAt = apexAt;
          i = apexAt;
          continue;
        }
      }
    }
    out.push(goal);
    return out;
  }
  /**
   * A route between landed endpoints, seated into the free-space mesh when
   * needed. `funnel` keeps only turns; disabling it keeps gate centers.
   */
  route(a, b) {
    const inputStart = point(a, "a");
    const inputGoal = point(b, "b");
    if (!this.ready) return null;
    const landedStart = this._land(inputStart);
    const landedGoal = this._land(inputGoal);
    if (!landedStart || !landedGoal) return null;
    if (this._visible(landedStart, landedGoal)) {
      return [landedStart, landedGoal];
    }
    const from = this._seat(landedStart);
    const to = this._seat(landedGoal);
    if (!from || !to) return null;
    const start = from.point;
    const goal = to.point;
    let points;
    if (from.cell === to.cell) {
      points = [start, goal];
    } else {
      const crossings = this._cross(from.cell, start, to.cell, goal);
      if (!crossings) return null;
      points = this.options.funnel
        ? this._taut(start, crossings, goal)
        : [start, ...crossings.map((c) => ({ ...c.gate.mid })), goal];
    }
    const route = [landedStart, ...points, landedGoal];
    return route.filter(
      (p, i) =>
        i === 0 ||
        p.x !== route[i - 1].x ||
        p.y !== route[i - 1].y,
    );
  }
}
Object.defineProperty(Terrain, "DEFAULTS", {
  value: TERRAIN_CONFIG,
  enumerable: true,
});
return Terrain;
})();
if (typeof module !== "undefined" && module.exports) module.exports = Terrain;
