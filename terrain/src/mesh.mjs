import { above, below, finite, optionsOf } from "./support.mjs";

export class TerrainMesh {
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
      if (supplied)
        throw new TypeError("options.avoid() must return an iterable");
      const root = this.options.root || globalThis.document;
      if (typeof root?.querySelectorAll !== "function")
        throw new Error("a document or options.root is required for a selector");
      return Array.from(root.querySelectorAll(source));
    }
    if (!source?.[Symbol.iterator])
      throw new TypeError("options.avoid() must return an iterable");
    return Array.from(source);
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
        throw new TypeError(
          `avoid[${index}] must support getBoundingClientRect()`,
        );
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
    for (const r of this.rects) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
        return true;
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

  /** Build the free-space slabs and their shared gates. */
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
      a,
      b,
    };
    a.gates.push(gate);
    b.gates.push(gate);
    this.gates.push(gate);
  }
}
