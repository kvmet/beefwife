import { TerrainMesh } from "./mesh.mjs";
import {
  cross2,
  minHeapPop,
  minHeapPush,
  point,
  TERRAIN_CONFIG,
} from "./support.mjs";

class Terrain extends TerrainMesh {
  _land(p) {
    const field = this.at(p.x, p.y);
    if (!field) return null;
    if (field.d === 0) return { x: p.x, y: p.y };
    return {
      x: p.x + field.dx * field.d,
      y: p.y + field.dy * field.d,
    };
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

  /** A* over directed gate crossings, using gate centers for graph costs. */
  _cross(from, start, to, goal) {
    const size = 2 * this.gates.length;
    const cost = new Float64Array(size).fill(Infinity);
    const prev = new Int32Array(size).fill(-1);
    const done = new Uint8Array(size);
    const heapNodes = [];
    const heapScores = [];

    for (const gate of from.gates) {
      const key = 2 * gate.id + (gate.a === from ? 1 : 0);
      const first = Math.hypot(gate.mid.x - start.x, gate.mid.y - start.y);
      cost[key] = first;
      minHeapPush(
        heapNodes,
        heapScores,
        key,
        first + Math.hypot(gate.mid.x - goal.x, gate.mid.y - goal.y),
      );
    }

    while (heapNodes.length) {
      const key = minHeapPop(heapNodes, heapScores);
      if (done[key]) continue;
      done[key] = 1;
      const gate = this.gates[key >> 1];
      const cell = key & 1 ? gate.b : gate.a;
      if (cell === to) {
        const walk = [];
        for (let at = key; at >= 0; at = prev[at]) walk.push(at);
        walk.reverse();
        return walk.map((at) => ({
          gate: this.gates[at >> 1],
          forward: (at & 1) === 1,
        }));
      }

      const low = cost[key];
      for (const next of cell.gates) {
        if (next === gate) continue;
        const nextKey = 2 * next.id + (next.a === cell ? 1 : 0);
        const step =
          low + Math.hypot(next.mid.x - gate.mid.x, next.mid.y - gate.mid.y);
        if (step >= cost[nextKey]) continue;
        cost[nextKey] = step;
        prev[nextKey] = key;
        minHeapPush(
          heapNodes,
          heapScores,
          nextKey,
          step + Math.hypot(next.mid.x - goal.x, next.mid.y - goal.y),
        );
      }
    }
    return null;
  }

  /** Pull the selected gate corridor taut. */
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

export default Terrain;
