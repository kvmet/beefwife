/**
 * Nearest legal points and routes through a configured CSS-pixel viewport
 * outside keep-out DOMRects. build() caches layout; at() returns { dx, dy, d };
 * route() returns [{ x, y }, ...] or null.
 */

// px kept between closed DOMRect edges and landing or routing geometry
const CLEAR = 0.5;

// Defaults for any option the constructor's options object leaves unset.
const TERRAIN_CONFIG = {
  avoid: ".beefwife-avoid", // elements that are out of bounds
  edgeMargin: 25, // px inset from the viewport edge, out of bounds like an element
  obstaclePadding: 0, // px grown around each keep-out rect
  funnel: true, // pull a route taut, instead of a point at every gate crossed
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
  constructor(options = null) {
    this.options = options;
    this.rects = [];
    // Inset viewport bounds.
    this.x0 = 0;
    this.y0 = 0;
    this.x1 = 0;
    this.y1 = 0;
    // Segments use { v, c, lo, hi }, with v selecting a vertical segment.
    this.edges = [];
    this.cells = [];
    this.gates = [];
    this.width = 0;
    this.height = 0;
    this.viewport = { left: 0, top: 0, width: 0, height: 0 };
  }

  get ready() {
    return this.x1 > this.x0 && this.y1 > this.y0;
  }

  build() {
    const viewport = this._viewport();
    const width = Math.max(0, viewport.width);
    const height = Math.max(0, viewport.height);
    const margin = Math.max(0, this._value("edgeMargin"));
    this.viewport = viewport;
    this.width = width;
    this.height = height;
    this.x0 = Math.min(margin, width / 2);
    this.y0 = Math.min(margin, height / 2);
    this.x1 = width - this.x0;
    this.y1 = height - this.y0;
    this.rects = this._measure();
    this.edges = this._border();
    this._buildSlabs();
  }

  avoidElements() {
    const source = this._value("avoid");
    if (typeof source === "function") return Array.from(source());
    if (typeof source !== "string") return Array.from(source || []);
    const root = this.options?.root || document;
    return Array.from(root.querySelectorAll(source));
  }

  _value(name) {
    const value = this.options?.[name];
    return value !== undefined ? value : TERRAIN_CONFIG[name];
  }

  _viewport() {
    const configured = this.options?.viewport;
    const viewport =
      typeof configured === "function" ? configured() : configured;
    if (viewport) {
      const { left = 0, top = 0, width, height } = viewport;
      if (![left, top, width, height].every(Number.isFinite))
        throw new TypeError("terrain viewport must contain finite dimensions");
      return { left, top, width, height };
    }
    return {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  /** Snapshot DOMRects so at() and route() never trigger layout. */
  _measure() {
    const out = [];
    const padding = Math.max(0, this._value("obstaclePadding"));
    const viewport = this.viewport;
    this.avoidElements().forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const rect = {
        left: r.left - viewport.left - padding,
        top: r.top - viewport.top - padding,
        right: r.right - viewport.left + padding,
        bottom: r.bottom - viewport.top + padding,
      };
      if (
        rect.right <= 0 ||
        rect.bottom <= 0 ||
        rect.left >= this.width ||
        rect.top >= this.height
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

  /** Open stretches on one line, optionally outside expanded rectangles. */
  _open(vertical, c, lo, hi, out, clear = 0) {
    const near = vertical ? this.x0 : this.y0;
    const far = vertical ? this.x1 : this.y1;
    if (c < near || c > far) return;

    let open = Math.max(lo, vertical ? this.y0 : this.x0);
    const end = Math.min(hi, vertical ? this.y1 : this.x1);
    if (open >= end) return;

    const blocked = [];
    for (const r of this.rects) {
      if (vertical) {
        if (c >= r.left - clear && c <= r.right + clear) {
          blocked.push([r.top - clear, r.bottom + clear]);
        }
      } else if (c >= r.top - clear && c <= r.bottom + clear) {
        blocked.push([r.left - clear, r.right + clear]);
      }
    }

    blocked.sort((a, b) => a[0] - b[0]);
    for (const [from, to] of blocked) {
      if (from >= end) break;
      if (from > open) {
        out.push({ v: vertical, c, lo: open, hi: Math.min(from, end) });
      }
      if (to > open) open = to;
      if (open >= end) return;
    }
    out.push({ v: vertical, c, lo: open, hi: end });
  }

  _border() {
    const out = [];
    for (const r of this.rects) {
      this._open(true, r.left - CLEAR, r.top, r.bottom, out);
      this._open(true, r.right + CLEAR, r.top, r.bottom, out);
      this._open(false, r.top - CLEAR, r.left, r.right, out);
      this._open(false, r.bottom + CLEAR, r.left, r.right, out);
    }
    this._open(true, this.x0, this.y0, this.y1, out);
    this._open(true, this.x1, this.y0, this.y1, out);
    this._open(false, this.y0, this.x0, this.x1, out);
    this._open(false, this.y1, this.x0, this.x1, out);
    return out.filter((edge) => {
      const loCovered = edge.v
        ? this._covered(edge.c, edge.lo)
        : this._covered(edge.lo, edge.c);
      const hiCovered = edge.v
        ? this._covered(edge.c, edge.hi)
        : this._covered(edge.hi, edge.c);
      const inset = Math.min(CLEAR, (edge.hi - edge.lo) / 4);
      if (loCovered) edge.lo += inset;
      if (hiCovered) edge.hi -= inset;
      return edge.hi > edge.lo;
    });
  }

  at(x, y, result = {}) {
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

    let nearD2 = Infinity;
    let nearX = 0;
    let nearY = 0;
    const edges = this.edges;
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      let toX;
      let toY;
      if (edge.v) {
        toX = edge.c - x;
        toY = (y < edge.lo ? edge.lo : y > edge.hi ? edge.hi : y) - y;
      } else {
        toX = (x < edge.lo ? edge.lo : x > edge.hi ? edge.hi : x) - x;
        toY = edge.c - y;
      }
      const d2 = toX * toX + toY * toY;
      if (d2 < nearD2) {
        nearD2 = d2;
        nearX = toX;
        nearY = toY;
      }
    }

    if (nearD2 === Infinity || nearD2 < 1e-12) {
      result.dx = 0;
      result.dy = 0;
      result.d = 0;
      return result;
    }
    const d = Math.sqrt(nearD2);
    result.dx = nearX / d;
    result.dy = nearY / d;
    result.d = d;
    return result;
  }

  /**
   * Decompose space around rectangles expanded by CLEAR. Cuts at every
   * expanded x edge make occupancy constant within each slab; gaps no wider
   * than 2 * CLEAR are intentionally absent from the route graph.
   */
  _buildSlabs() {
    const cuts = [this.x0, this.x1];
    for (const r of this.rects) {
      for (const c of [r.left - CLEAR, r.right + CLEAR]) {
        if (c > this.x0 && c < this.x1) cuts.push(c);
      }
    }
    cuts.sort((a, b) => a - b);

    this.cells = [];
    this.gates = [];
    let behind = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const left = cuts[i];
      const right = cuts[i + 1];
      if (right - left < 1e-6) continue;

      const spans = [];
      this._open(true, (left + right) / 2, this.y0, this.y1, spans, CLEAR);
      const slab = [];
      for (const s of spans) {
        const cell = {
          left,
          right,
          lo: s.lo,
          hi: s.hi,
          gates: [],
        };
        this.cells.push(cell);
        slab.push(cell);
      }
      behind.forEach((a) => slab.forEach((b) => this._gate(a, b)));
      behind = slab;
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
      mid: { x, y: (lo + hi) / 2 },
      a, // lower-x cell
      b, // higher-x cell
    };
    a.gates.push(gate);
    b.gates.push(gate);
    this.gates.push(gate);
  }

  _land(p) {
    const f = this.at(p.x, p.y);
    if (f.d === 0) return { x: p.x, y: p.y };
    return { x: p.x + f.dx * f.d, y: p.y + f.dy * f.d };
  }

  /** Nearest clearance cell reachable without crossing a keep-out. */
  _seat(p) {
    let best = null;
    let bestD = Infinity;
    for (const cell of this.cells) {
      const point = {
        x: Math.max(cell.left, Math.min(cell.right, p.x)),
        y: Math.max(cell.lo, Math.min(cell.hi, p.y)),
      };
      const d = (point.x - p.x) ** 2 + (point.y - p.y) ** 2;
      if (d === 0) return { cell, point: { x: p.x, y: p.y } };
      if (d < bestD && this._visible(p, point)) {
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
      let enter = 0;
      let leave = 1;
      const sides = [
        [-dx, a.x - r.left],
        [dx, r.right - a.x],
        [-dy, a.y - r.top],
        [dy, r.bottom - a.y],
      ];
      let misses = false;
      for (const [step, room] of sides) {
        if (Math.abs(step) < 1e-12) {
          if (room < 0) misses = true;
          continue;
        }
        const at = room / step;
        if (step < 0) enter = Math.max(enter, at);
        else leave = Math.min(leave, at);
      }
      if (!misses && enter <= leave) return false;
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

  /** Shortest path through the gates; reverse crossings swap portal sides. */
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
   * A route between landed endpoints, seated into the clearance mesh when
   * needed. `funnel` keeps only turns; disabling it keeps gate centers.
   */
  route(a, b) {
    if (!this.ready || !this.cells.length) return null;

    const landedStart = this._land(a);
    const landedGoal = this._land(b);
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
      points = this._value("funnel")
        ? this._taut(start, crossings, goal)
        : [start, ...crossings.map((c) => ({ ...c.gate.mid })), goal];
    }

    const route = [landedStart, ...points, landedGoal];
    return route.filter(
      (p, i) =>
        i === 0 ||
        Math.hypot(p.x - route[i - 1].x, p.y - route[i - 1].y) > 1e-6,
    );
  }
}
