/** Route following and Beefwife control for one host-owned plan. */

const BEEFWIFE_CANVAS_ACTOR_LOST_MARGIN = 200;

const actorRandomBetween = (random, a, b) => a + random() * (b - a);

class BeefwifeCanvasActor {
  // Longest simulated step (s) accepted after a stalled host frame.
  static MAX_DT = 0.05;
  // At most this many Beefwife steps per longest frame.
  static MAX_TIME_SCALE = 16;

  static timeScaleOf(value) {
    if (!Number.isFinite(value) || value < 0 || value > BeefwifeCanvasActor.MAX_TIME_SCALE)
      throw new RangeError(
        `timeScale must be from 0 to ${BeefwifeCanvasActor.MAX_TIME_SCALE}`,
      );
    return value;
  }

  constructor(terrain, router, spec, options = {}) {
    this.terrain = terrain;
    this.router = router;
    this.spec = spec;
    this.name = spec.name;
    this.random = options.random || Math.random;
    this.roam = options.roam || BEEFWIFE_CANVAS_ROUTE_DEFAULTS;
    this.renderOptions = options.render || null;
    // The bearing handed to the beefwife last frame, retained without a route.
    this.heading = { x: 1, y: 0 };
    this.controls = { throttle: 1, direction: this.heading };
    this.routeStep = {
      target: null,
      bearing: null,
      direction: { x: 1, y: 0 },
      field: { dx: 0, dy: 0, d: 0 },
    };
    this.route = newRoute();
    this.planner = options.planner || router;
    this.throttle = 1;
    this.spawn();
  }

  /**
   * Somewhere in bounds along any bearing, out of step with its siblings, or
   * where the caller says. The body is rebuilt rather than moved, so its legs
   * and ornaments start settled.
   */
  spawn(at, heading) {
    const terrain = this.terrain;
    const where = at ||
      this.router.randomPoint() || {
        x: (terrain.x0 + terrain.x1) / 2,
        y: (terrain.y0 + terrain.y1) / 2,
      };
    const angle = actorRandomBetween(this.random, 0, Math.PI * 2);
    const bearing = heading || { x: Math.cos(angle), y: Math.sin(angle) };
    this.heading.x = bearing.x;
    this.heading.y = bearing.y;
    const previous = this.beefwife;
    const beefwifeOptions = {
      position: where,
      direction: bearing,
      phase: actorRandomBetween(this.random, 0, Math.PI * 2),
      random: this.random,
    };
    if (this.renderOptions) beefwifeOptions.render = this.renderOptions;
    this.beefwife = new Beefwife(this.spec, beefwifeOptions);
    this.route = newRoute();
    this.throttle = this.planner.readyToPlan === false ? 0 : 1;
    if (previous) previous.destroy();
  }

  /** A carried-off creature returns just inside a random viewport edge. */
  _reentry() {
    const width = this.terrain.width;
    const height = this.terrain.height;
    const back = 24;
    const side = Math.floor(actorRandomBetween(this.random, 0, 4));
    if (side === 0)
      return {
        at: { x: -back, y: actorRandomBetween(this.random, 0, height) },
        to: { x: 1, y: 0 },
      };
    if (side === 1)
      return {
        at: {
          x: width + back,
          y: actorRandomBetween(this.random, 0, height),
        },
        to: { x: -1, y: 0 },
      };
    if (side === 2)
      return {
        at: { x: actorRandomBetween(this.random, 0, width), y: -back },
        to: { x: 0, y: 1 },
      };
    return {
      at: {
        x: actorRandomBetween(this.random, 0, width),
        y: height + back,
      },
      to: { x: 0, y: -1 },
    };
  }

  _lost(center) {
    const margin = BEEFWIFE_CANVAS_ACTOR_LOST_MARGIN;
    return (
      center.x < -margin ||
      center.y < -margin ||
      center.x > this.terrain.width + margin ||
      center.y > this.terrain.height + margin
    );
  }

  update(dt, timeScale) {
    if (!Number.isFinite(dt) || dt < 0 || dt > BeefwifeCanvasActor.MAX_DT)
      throw new RangeError(`dt must be from 0 to ${BeefwifeCanvasActor.MAX_DT}`);
    BeefwifeCanvasActor.timeScaleOf(timeScale);
    const scaledDt = dt * timeScale;
    const pose = this.beefwife.getPose();
    if (this._lost(pose.center)) {
      const back = this._reentry();
      this.spawn(back.at, back.to);
      return;
    }

    const { target, bearing } = stepRoute(
      this.route,
      this.planner,
      pose.head,
      scaledDt,
      this.roam,
      this.routeStep,
    );
    const wanted = target ? 1 : 0;
    this.throttle +=
      (wanted - this.throttle) * Math.min(1, scaledDt * this.roam.ease);
    if (bearing) {
      this.heading.x = bearing.x;
      this.heading.y = bearing.y;
    }
    this.controls.throttle = this.throttle;
    let remaining = scaledDt;
    while (remaining > 0) {
      const seconds = Math.min(remaining, Beefwife.MAX_STEP_SECONDS);
      this.beefwife.step(seconds, this.controls);
      remaining -= seconds;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeCanvasActor;
}
