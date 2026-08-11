/** Actor collection, spawn queue, cast selection, and target-policy ownership. */

import { BeefwifeCanvasActor as Actor } from "./actor.mjs";
import { config, chooseName, countOf } from "./options.mjs";
import {
  BeefwifeCanvasTargetPolicy,
  pointOf,
  targetModeOf,
  wanderDelayOf,
} from "./targeting.mjs";
import { newRoute as freshRoute } from "./steering.mjs";

class BeefwifeCanvasPopulation {
  constructor(terrain, router, options = {}) {
    this.terrain = terrain;
    this.router = router;
    this.cast = options.cast || null;
    this.castWeights = options.castWeights || null;
    this.random = options.random || Math.random;
    this.renderOptions = options.renderOptions || null;
    this.roam = options.roam;
    this.targetMode = targetModeOf(options.targetMode || "wander");
    this.wanderDelay = wanderDelayOf(options.wanderDelay ?? 4);
    this.actors = [];
    this.renderSnapshots = [];
    this.targetPolicies = new Map();
    const count = options.count === undefined ? 3 : countOf(options.count);
    this.pending = Array(count).fill(null);
  }

  add(name) {
    if (name !== undefined && typeof name !== "string")
      throw new TypeError("name must be a string");
    if (this.actors.length + this.pending.length >= config.MAX_COUNT)
      throw new RangeError(
        `cannot add more than ${config.MAX_COUNT} beefwives`,
      );
    if (!this.router.ready || !this.cast) {
      this.pending.push(name ?? null);
      return null;
    }
    return this._addNow(name);
  }

  _addNow(name) {
    const selectedName =
      name || chooseName(this.cast, this.castWeights, this.random);
    const spec = this.cast[selectedName];
    if (!spec) throw new Error(`no creature named ${name}`);
    const planner = new BeefwifeCanvasTargetPolicy(
      this.router,
      this.targetMode,
      { random: this.random, wanderDelay: this.wanderDelay },
    );
    const actor = new Actor(this.terrain, this.router, spec, {
      planner,
      random: this.random,
      render: this.renderOptions,
      roam: this.roam,
    });
    this.actors.push(actor);
    this.targetPolicies.set(actor, planner);
    return actor;
  }

  spawnPending() {
    while (this.router.ready && this.cast && this.pending.length) {
      const name = this.pending.shift();
      this._addNow(name || undefined);
    }
  }

  remove() {
    if (this.pending.length) this.pending.pop();
    else {
      const actor = this.actors.pop();
      if (actor) {
        this.targetPolicies.delete(actor);
        actor.beefwife.destroy();
      }
    }
  }

  clear() {
    for (const actor of this.actors) actor.beefwife.destroy();
    this.actors = [];
    this.targetPolicies.clear();
    this.pending = [];
  }

  setCount(rawCount) {
    const count = countOf(rawCount);
    while (this.actors.length + this.pending.length > count) this.remove();
    while (this.actors.length + this.pending.length < count) this.add();
  }

  _targets(actor) {
    if (!actor) return this.actors;
    if (!this.targetPolicies.has(actor))
      throw new Error("actor does not belong to this host");
    return [actor];
  }

  setTarget(target, actor = null) {
    const point = pointOf(target);
    for (const creature of this._targets(actor)) {
      this.targetPolicies.get(creature).setTarget(point);
      creature.route = freshRoute();
    }
  }

  clearTarget(actor = null) {
    for (const creature of this._targets(actor)) {
      this.targetPolicies.get(creature).clearTarget();
      creature.route = freshRoute();
    }
  }

  setTargetMode(targetMode, actor = null) {
    const mode = targetModeOf(targetMode);
    if (!actor) this.targetMode = mode;
    for (const creature of this._targets(actor)) {
      this.targetPolicies.get(creature).setTargetMode(mode);
      creature.route = freshRoute();
    }
  }

  respawn(actor = null) {
    for (const creature of this._targets(actor)) creature.spawn();
  }

  update(dt, timeScale) {
    for (let index = 0; index < this.actors.length; index++)
      this.actors[index].update(dt, timeScale);
  }

  renderState() {
    this.renderSnapshots.length = this.actors.length;
    for (let index = 0; index < this.actors.length; index++)
      this.renderSnapshots[index] = this.actors[index].renderState();
    return this.renderSnapshots;
  }

  destroy() {
    this.clear();
  }
}

export { BeefwifeCanvasPopulation };
