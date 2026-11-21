/** Schema-v1 planted-foot state. Private to one Beefwife instance. */

const lerp = (start, end, amount) => start + (end - start) * amount;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const magnitude = (x, y) => Math.sqrt(x * x + y * y);

const limbLength = (reach, scale, fold) => {
  const amount =
    fold <= 0.5
      ? lerp(0.9, 1.35, fold * 2)
      : lerp(1.35, 1.72, (fold - 0.5) * 2);
  return reach * scale * amount;
};

class Legs {
  constructor(model, body, gait, random) {
    this.model = model;
    this.body = body;
    this.gait = gait;
    this.random = random;
    this.legs = [];
    this._build();
  }

  /* Re-anchors the existing pairs on the new chain. Feet keep their world
     positions and their random draws, so a pair whose anchor moved walks to
     its new stance instead of being replanted under it, and a jitter edit
     rescales the same draws. */
  reconfigure(model, body, gait) {
    this.model = model;
    this.body = body;
    this.gait = gait;
    const anchors = this._anchors();
    this.legs.forEach((leg) => {
      leg.anchor = anchors[leg.pair];
      this._scale(leg);
    });
  }

  _signedRandom() {
    return this.random() * 2 - 1;
  }

  /* Draws are -1 to 1 and scales are derived from them, so jitter and the
     lift threshold apply to every leg as soon as the model changes. */
  _scale(leg) {
    const { jitter, liftThreshold, reach, spread } = this.model.legs;
    const { stance, step, character } = leg.draws;
    leg.reachScale = 1 + jitter * 0.28 * stance.reach;
    leg.spreadScale = 1 + jitter * 0.3 * stance.spread;
    leg.leadScale = 1 + jitter * 0.45 * stance.lead;
    leg.dragScale =
      (1 + jitter * 0.4 * step.drag) * (1 + jitter * 0.35 * character);
    leg.swingScale = 1 + jitter * 0.3 * step.swing;
    leg.liftAt = clamp(liftThreshold + jitter * 0.2 * character, 0, 1);
    const scatterRadius = Math.max(reach, spread) * jitter * 0.1;
    leg.scatter = {
      x: scatterRadius * step.scatterX,
      y: scatterRadius * step.scatterY,
    };
  }

  _anchors() {
    const { pairs, start, end } = this.model.legs;
    if (!pairs) return [];
    const firstDistance = this.model.chunks[start].restDistance;
    const lastDistance = this.model.chunks[end - 1].restDistance;
    return Array.from({ length: pairs }, (_, pair) => {
      const amount = pairs === 1 ? 0.5 : pair / (pairs - 1);
      const target = lerp(firstDistance, lastDistance, amount);
      let nearest = start;
      for (let index = start + 1; index < end; index++)
        if (
          Math.abs(this.model.chunks[index].restDistance - target) <
          Math.abs(this.model.chunks[nearest].restDistance - target)
        )
          nearest = index;
      return nearest;
    });
  }

  _build() {
    this._anchors().forEach((anchor, pair) => {
      [
        ["left", -1],
        ["right", 1],
      ].forEach(([side, sideSign]) => {
        const character = this._signedRandom();
        const leg = {
          pair,
          anchor,
          side,
          sideSign,
          draws: {
            character,
            stance: {
              reach: this._signedRandom(),
              spread: this._signedRandom(),
              lead: this._signedRandom(),
            },
            step: null,
          },
          reachScale: 1,
          spreadScale: 1,
          leadScale: 1,
          dragScale: 1,
          swingScale: 1,
          liftAt: 0,
          scatter: { x: 0, y: 0 },
          plantSpan: 0,
          progress: 1,
          contactLow: false,
          foot: { x: 0, y: 0 },
          hold: { x: 0, y: 0 },
          from: { x: 0, y: 0 },
        };
        this._rollStep(leg);
        const planted = this._plantAt(leg);
        Object.assign(leg.foot, planted);
        Object.assign(leg.hold, planted);
        Object.assign(leg.from, planted);
        leg.plantSpan = magnitude(
          planted.x - this.body.chain.x[anchor],
          planted.y - this.body.chain.y[anchor],
        );
        this.legs.push(leg);
      });
    });
  }

  _rollStep(leg) {
    leg.draws.step = {
      drag: this._signedRandom(),
      swing: this._signedRandom(),
      scatterX: this._signedRandom(),
      scatterY: this._signedRandom(),
    };
    this._scale(leg);
  }

  _plantAt(leg) {
    const options = this.model.legs;
    const { x, y, dx, dy } = this.body.chain;
    const anchor = leg.anchor;
    const reach = options.reach * leg.reachScale;
    const ahead = reach * (0.5 + options.lead * 0.5) * leg.leadScale;
    const outward = options.spread * leg.spreadScale * leg.sideSign;
    return {
      x: x[anchor] + dx[anchor] * ahead - dy[anchor] * outward,
      y: y[anchor] + dy[anchor] * ahead + dx[anchor] * outward,
    };
  }

  contactFor(leg, throttle) {
    const chunk = this.model.chunks[leg.anchor];
    const phaseOffset =
      leg.side === "right" ? Math.PI * this.model.legs.sidePhase : 0;
    return clamp(
      this.gait.contactAt(
        chunk.restDistance,
        throttle,
        chunk.motionScale.contact,
        phaseOffset,
      ) *
        (1 -
          this.model.physics.autoLift.amount *
            this.body.chain.idle[leg.anchor] *
            throttle),
      0,
      1,
    );
  }

  update(dt, throttle) {
    const options = this.model.legs;
    const chain = this.body.chain;
    for (let index = 0; index < this.legs.length; index++) {
      const leg = this.legs[index];
      const hipX = chain.x[leg.anchor];
      const hipY = chain.y[leg.anchor];
      const hipDx = chain.dx[leg.anchor];
      const hipDy = chain.dy[leg.anchor];
      const low = this.contactFor(leg, throttle) < leg.liftAt;
      const released = low && !leg.contactLow;
      leg.contactLow = low;

      if (leg.progress < 1) {
        const seconds = options.swingSeconds * leg.swingScale;
        leg.progress = Math.min(1, leg.progress + dt / seconds);
        const arc = Math.sin(Math.PI * leg.progress) * options.swingArc;
        leg.foot.x =
          lerp(leg.from.x, leg.hold.x, leg.progress) -
          hipDy * arc * leg.sideSign;
        leg.foot.y =
          lerp(leg.from.y, leg.hold.y, leg.progress) +
          hipDx * arc * leg.sideSign;
        continue;
      }

      Object.assign(leg.foot, leg.hold);
      const footX = leg.foot.x - hipX;
      const footY = leg.foot.y - hipY;
      const forward = footX * hipDx + footY * hipDy;
      const reach = options.reach * leg.reachScale;
      const behind = reach * (0.5 - options.lead * 0.5);
      const trailed = forward < -behind * leg.dragScale;
      const nominalSpan = magnitude(reach, options.spread * leg.spreadScale);
      const overextended =
        magnitude(footX, footY) > Math.max(nominalSpan, leg.plantSpan) * 1.55;
      if (released || trailed || overextended) {
        Object.assign(leg.from, leg.foot);
        const planted = this._plantAt(leg);
        leg.hold.x = planted.x + leg.scatter.x;
        leg.hold.y = planted.y + leg.scatter.y;
        leg.plantSpan = magnitude(leg.hold.x - hipX, leg.hold.y - hipY);
        leg.progress = 0;
        this._rollStep(leg);
        leg.contactLow = this.contactFor(leg, throttle) < leg.liftAt;
      }
    }
  }

  translate(offset) {
    this.legs.forEach((leg) => {
      [leg.foot, leg.hold, leg.from].forEach((point) => {
        point.x += offset.x;
        point.y += offset.y;
      });
    });
  }

  armLength(leg) {
    return limbLength(
      this.model.legs.reach,
      leg.reachScale,
      this.model.legs.fold,
    );
  }
}

export { Legs, limbLength };
