/** Destination ownership and satisfaction policy for routed runtime. */

const BeefwifeCanvasTargeting = (() => {
  const pointOf = (value, path = "target") => {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y))
      throw new TypeError(`${path} must have finite x and y coordinates`);
    return { x: value.x, y: value.y };
  };
  const targetingOf = (value) => {
    if (!["wander", "click", "pointer", "manual"].includes(value))
      throw new RangeError(
        "targeting must be wander, click, pointer, or manual",
      );
    return value;
  };
  const wanderDelayOf = (value) => {
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError("wanderDelay must be a nonnegative number");
    return value;
  };

  class BeefwifeCanvasTargetPolicy {
    constructor(router, targeting, options = {}) {
      this.router = router;
      this.terrain = router.terrain;
      this.targeting = targetingOf(targeting);
      this.random = options.random || Math.random;
      this.wanderDelay = wanderDelayOf(options.wanderDelay ?? 4);
      this.goal = null;
      this.delay = 0;
    }

    get readyToPlan() {
      return (
        Boolean(this.goal) || (this.targeting === "wander" && this.delay <= 0)
      );
    }

    advance(dt) {
      this.delay = Math.max(0, this.delay - dt);
    }

    plan(head) {
      if (!this.goal && this.targeting === "wander")
        this.goal = this.router.randomPoint();
      return this.goal ? this.router.planTo(head, this.goal) : null;
    }

    satisfy() {
      this.goal = null;
      this.delay =
        this.targeting === "wander" ? this.random() * this.wanderDelay : 0;
    }

    setTarget(target) {
      this.goal = pointOf(target);
      this.delay = 0;
    }

    clearTarget() {
      this.goal = null;
      this.delay =
        this.targeting === "wander" ? this.random() * this.wanderDelay : 0;
    }

    setTargeting(targeting) {
      this.targeting = targetingOf(targeting);
      this.goal = null;
      this.delay = 0;
    }
  }

  return {
    BeefwifeCanvasTargetPolicy,
    pointOf,
    targetingOf,
    wanderDelayOf,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeCanvasTargeting;
}
