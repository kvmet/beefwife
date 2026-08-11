/**
 * Where to go, and the way there.
 *
 * A target is supplied by the host or drawn uniformly over the viewport, then
 * moved to the nearest legal point. The run to it is terrain's, which already
 * holds the rectangles and the free space between them.
 *
 *   const router = new BeefwifeCanvasRouter(terrain, viewportOf, options);
 *   router.plan(head);  // [{x, y}, ...], last one the goal, or null
 *   router.planTo(head, target);
 */

class BeefwifeCanvasRouter {
  constructor(terrain, viewportOf, options = {}) {
    if (typeof viewportOf !== "function")
      throw new TypeError("viewportOf must be a function");
    const edgeMargin = options.edgeMargin ?? 0;
    if (!Number.isFinite(edgeMargin) || edgeMargin < 0)
      throw new RangeError("edgeMargin must be nonnegative");
    if (options.random !== undefined && typeof options.random !== "function")
      throw new TypeError("random must be a function");
    this.terrain = terrain;
    this.viewportOf = viewportOf;
    this.edgeMargin = edgeMargin;
    this.random = options.random || Math.random;
  }

  get ready() {
    return this.terrain.ready;
  }

  viewport() {
    const viewport = this.viewportOf();
    if (
      !viewport ||
      !Number.isFinite(viewport.width) ||
      !Number.isFinite(viewport.height) ||
      viewport.width < 0 ||
      viewport.height < 0
    )
      throw new TypeError("viewport must have nonnegative finite dimensions");
    return viewport;
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
    const { width, height } = this.viewport();
    const x0 = Math.min(this.edgeMargin, width / 2);
    const y0 = Math.min(this.edgeMargin, height / 2);
    const x = x0 + this.random() * (width - 2 * x0);
    const y = y0 + this.random() * (height - 2 * y0);
    const nearest = this.terrain.nearest(x, y);
    return nearest ? { x: nearest.x, y: nearest.y } : null;
  }
}

export { BeefwifeCanvasRouter };
