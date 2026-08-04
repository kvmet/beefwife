/**
 * Where to go, and the way there.
 *
 * A target is supplied by the host or drawn uniformly over the viewport, then
 * moved to the nearest legal point. The run to it is terrain's, which already
 * holds the rectangles and the free space between them.
 *
 *   const router = new BeefwifeCanvasRouter(terrain);
 *   router.plan(head);  // [{x, y}, ...], last one the goal, or null
 *   router.planTo(head, target);
 */

class BeefwifeCanvasRouter {
  constructor(terrain, random = Math.random) {
    this.terrain = terrain;
    this.random = random;
  }

  get ready() {
    return this.terrain.ready && this.terrain.cells.length > 0;
  }

  /** Somewhere legal to stand, for a creature being put on the page. */
  randomPoint() {
    return this.ready ? this._somewhere() : null;
  }

  plan(head) {
    if (!this.ready) return null;
    return this.planTo(head, this._somewhere());
  }

  planTo(head, target) {
    if (!this.ready) return null;
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y))
      throw new TypeError("target must have finite x and y coordinates");
    const path = this.terrain.route(head, target);
    // Widgets can leave the page in separate regions, and nothing walks
    // between them.
    if (!path) return null;
    // The run opens on the head's landed position: its own, and nowhere to go,
    // when it is already in bounds, and the way back in when a widget has
    // appeared over it.
    const lead = Math.hypot(path[0].x - head.x, path[0].y - head.y) < 1 ? 1 : 0;
    const waypoints = path.slice(lead);
    // A goal drawn on top of the head leaves nothing to walk to, and a caller
    // handed an empty run would replan every frame.
    return waypoints.length ? waypoints : null;
  }

  _somewhere() {
    const t = this.terrain;
    const x = t.x0 + this.random() * (t.x1 - t.x0);
    const y = t.y0 + this.random() * (t.y1 - t.y0);
    const at = t.at(x, y);
    return at.d === 0 ? { x, y } : { x: x + at.dx * at.d, y: y + at.dy * at.d };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BeefwifeCanvasRouter };
}
