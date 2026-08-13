/** Route following and Beefwife control for one host-owned plan. */

import { Beefwife } from "../../beefwife/src/beefwife.mjs";
import {
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
  newRoute,
  stepRoute,
} from "./steering.mjs";

const BEEFWIFE_CANVAS_ACTOR_LOST_MARGIN = 200;

const actorRandomBetween = (random, a, b) => a + random() * (b - a);

class BeefwifeCanvasActor {
  static MAX_TIME_SCALE = 16;

  static timeScaleOf(value) {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > BeefwifeCanvasActor.MAX_TIME_SCALE
    )
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
      field: { dx: 0, dy: 0, distance: 0 },
    };
    this.route = newRoute();
    this.planner = options.planner || router;
    this.throttle = 1;
    this.renderSnapshot = {
      display: null,
      head: null,
      route: null,
      target: null,
    };
    this.spawn();
  }

  /**
   * Somewhere in bounds along any bearing, out of step with its siblings, or
   * where the caller says. The body is rebuilt rather than moved, so its legs
   * and ornaments start settled.
   */
  spawn(at, heading) {
    const viewport = this.router.viewport();
    const where = at ||
      this.router.randomPoint() || {
        x: viewport.width / 2,
        y: viewport.height / 2,
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

  /**
   * Reconfigures the live body and keeps the canonical copy as the spec, so a
   * later respawn rebuilds the creature as it is now, not as it was cast.
   */
  setDescriptor(descriptor) {
    this.beefwife.setDescriptor(descriptor);
    this.spec = this.beefwife.descriptor;
    this.name = this.spec.name;
    return this;
  }

  /** A carried-off creature returns just inside a random viewport edge. */
  _reentry() {
    const { width, height } = this.router.viewport();
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

  /**
   * The centroid trails the head by up to the chain's rest length, so a long
   * creature walking in plain sight has a centroid far outside the viewport.
   * Carrying the whole rest length recycles one only once no part of it can
   * still be on screen.
   */
  _lost(center) {
    const { width, height } = this.router.viewport();
    const margin = BEEFWIFE_CANVAS_ACTOR_LOST_MARGIN + this.beefwife.restLength;
    return (
      center.x < -margin ||
      center.y < -margin ||
      center.x > width + margin ||
      center.y > height + margin
    );
  }

  renderState() {
    this.renderSnapshot.display = this.beefwife;
    this.renderSnapshot.head = this.beefwife.getPose().head;
    this.renderSnapshot.route = this.route.path;
    this.renderSnapshot.target = this.planner?.goal || null;
    return this.renderSnapshot;
  }

  update(dt, timeScale) {
    if (!Number.isFinite(dt) || dt < 0)
      throw new RangeError("dt must be nonnegative seconds");
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
    this.beefwife.step(scaledDt, this.controls);
  }
}

export { BeefwifeCanvasActor };
