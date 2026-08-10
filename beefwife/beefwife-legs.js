/** Schema-v1 planted-foot state. Private to one Beefwife instance. */

const BeefwifeLegs = (() => {
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

  class BeefwifeLegs {
    constructor(model, body, gait, random) {
      this.model = model;
      this.body = body;
      this.gait = gait;
      this.random = random;
      this.legs = [];
      this._build();
    }

    /* Re-anchors the existing pairs on the new chain. Feet keep their world
       positions and their sampled proportions, so a pair whose anchor moved
       walks to its new stance instead of being replanted under it. */
    reconfigure(model, body, gait) {
      this.model = model;
      this.body = body;
      this.gait = gait;
      const anchors = this._anchors();
      this.legs.forEach((leg) => (leg.anchor = anchors[leg.pair]));
    }

    _signedRandom() {
      return this.random() * 2 - 1;
    }

    _vary(amount) {
      return 1 + amount * this._signedRandom();
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
      const options = this.model.legs;
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
            character,
            reachScale: this._vary(options.jitter * 0.28),
            spreadScale: this._vary(options.jitter * 0.3),
            leadScale: this._vary(options.jitter * 0.45),
            dragScale: 1,
            swingScale: 1,
            liftAt: options.liftThreshold,
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
            planted.x - this.body.chunks[anchor].x,
            planted.y - this.body.chunks[anchor].y,
          );
          this.legs.push(leg);
        });
      });
    }

    _rollStep(leg) {
      const jitter = this.model.legs.jitter;
      leg.dragScale =
        this._vary(jitter * 0.4) * (1 + jitter * 0.35 * leg.character);
      leg.swingScale = this._vary(jitter * 0.3);
      leg.liftAt = clamp(
        this.model.legs.liftThreshold + jitter * 0.2 * leg.character,
        0,
        1,
      );
      const scatterRadius =
        Math.max(this.model.legs.reach, this.model.legs.spread) * jitter * 0.1;
      leg.scatter = {
        x: scatterRadius * this._signedRandom(),
        y: scatterRadius * this._signedRandom(),
      };
    }

    _plantAt(leg) {
      const options = this.model.legs;
      const hip = this.body.chunks[leg.anchor];
      const reach = options.reach * leg.reachScale;
      const ahead = reach * (0.5 + options.lead * 0.5) * leg.leadScale;
      const outward = options.spread * leg.spreadScale * leg.sideSign;
      return {
        x: hip.x + hip.dx * ahead - hip.dy * outward,
        y: hip.y + hip.dy * ahead + hip.dx * outward,
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
              this.body.chunks[leg.anchor].idle *
              throttle),
        0,
        1,
      );
    }

    update(dt, throttle) {
      const options = this.model.legs;
      for (let index = 0; index < this.legs.length; index++) {
        const leg = this.legs[index];
        const hip = this.body.chunks[leg.anchor];
        const low = this.contactFor(leg, throttle) < leg.liftAt;
        const released = low && !leg.contactLow;
        leg.contactLow = low;

        if (leg.progress < 1) {
          const seconds = options.swingSeconds * leg.swingScale;
          leg.progress = Math.min(1, leg.progress + dt / seconds);
          const arc = Math.sin(Math.PI * leg.progress) * options.swingArc;
          leg.foot.x =
            lerp(leg.from.x, leg.hold.x, leg.progress) -
            hip.dy * arc * leg.sideSign;
          leg.foot.y =
            lerp(leg.from.y, leg.hold.y, leg.progress) +
            hip.dx * arc * leg.sideSign;
          continue;
        }

        Object.assign(leg.foot, leg.hold);
        const footX = leg.foot.x - hip.x;
        const footY = leg.foot.y - hip.y;
        const forward = footX * hip.dx + footY * hip.dy;
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
          leg.plantSpan = magnitude(leg.hold.x - hip.x, leg.hold.y - hip.y);
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

  Object.defineProperty(BeefwifeLegs, "limbLength", { value: limbLength });
  return BeefwifeLegs;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    BeefwifeLegs,
    limbLength: BeefwifeLegs.limbLength,
  };
}
