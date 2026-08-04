/** Destination ownership and satisfaction policy for routed runtime. */

const BeefwifeCanvasTargeting = (() => {
  const pointOf = (value, path = "target") => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new TypeError(`${path} must be an object`);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError(`${path} must be a plain object`);
    for (const key of Object.keys(value)) {
      if (key !== "x" && key !== "y")
        throw new TypeError(`${path}.${key} is unknown`);
    }
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y))
      throw new TypeError(`${path} must have finite x and y coordinates`);
    return { x: value.x, y: value.y };
  };
  const targetModeOf = (value) => {
    if (!["wander", "manual"].includes(value))
      throw new RangeError("targetMode must be wander or manual");
    return value;
  };
  const wanderDelayOf = (value) => {
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError("wanderDelay must be a nonnegative number");
    return value;
  };

  class BeefwifeCanvasTargetPolicy {
    constructor(router, targetMode, options = {}) {
      this.router = router;
      this.terrain = router.terrain;
      this.targetMode = targetModeOf(targetMode);
      this.random = options.random || Math.random;
      this.wanderDelay = wanderDelayOf(options.wanderDelay ?? 4);
      this.goal = null;
      this.delay = 0;
    }

    get readyToPlan() {
      return (
        Boolean(this.goal) || (this.targetMode === "wander" && this.delay <= 0)
      );
    }

    advance(dt) {
      this.delay = Math.max(0, this.delay - dt);
    }

    plan(head) {
      if (!this.goal && this.targetMode === "wander")
        this.goal = this.router.randomPoint();
      return this.goal ? this.router.planTo(head, this.goal) : null;
    }

    satisfy() {
      this.goal = null;
      this.delay =
        this.targetMode === "wander" ? this.random() * this.wanderDelay : 0;
    }

    setTarget(target) {
      this.goal = pointOf(target);
      this.delay = 0;
    }

    clearTarget() {
      this.goal = null;
      this.delay =
        this.targetMode === "wander" ? this.random() * this.wanderDelay : 0;
    }

    setTargetMode(targetMode) {
      this.targetMode = targetModeOf(targetMode);
      this.goal = null;
      this.delay = 0;
    }
  }

  return {
    BeefwifeCanvasTargetPolicy,
    pointOf,
    targetModeOf,
    wanderDelayOf,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeCanvasTargeting;
}
