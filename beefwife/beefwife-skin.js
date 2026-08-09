/** Schema-v1 ornament motion and renderer snapshots. */

const BeefwifeSkin = (() => {
  const RENDER_LAYOUT = Object.freeze({
    chunkStride: 4,
    legStride: 11,
    ornamentStride: 6,
    plateStride: 5,
  });
  /* Root rates that deflect a react-1 ornament by one radian. */
  const RADIAN_TURN_RATE = 13;
  const RADIAN_LATERAL_RATE = 290;
  const MIN_DAMPING_RATIO = 0.02;
  const MAX_DEFLECTION = Math.PI / 2;
  const magnitude = (x, y) => Math.sqrt(x * x + y * y);

  /* Exact step of theta'' = rate^2 (target - theta) - 2 zeta rate theta',
     as x' = Ax + Bv, v' = Cx + Dv on x = theta - target. Exactness keeps any
     recover and wobble stable at any dt. */
  const springCoefficients = (ornament, rate, zeta, dt) => {
    const angularDt = rate * dt;
    if (angularDt < 1e-9) {
      ornament.positionPosition = 1;
      ornament.positionVelocity = dt;
      ornament.velocityPosition = 0;
      ornament.velocityVelocity = 1;
      return;
    }
    const decay = Math.exp(-zeta * angularDt);
    if (zeta >= 1 - 1e-8) {
      ornament.positionPosition = decay * (1 + angularDt);
      ornament.positionVelocity = decay * dt;
      ornament.velocityPosition = -decay * rate * angularDt;
      ornament.velocityVelocity = decay * (1 - angularDt);
      return;
    }
    const ringRate = rate * Math.sqrt(1 - zeta * zeta);
    const cosine = Math.cos(ringRate * dt);
    const sine = Math.sin(ringRate * dt);
    const lean = (zeta * rate) / ringRate;
    ornament.positionPosition = decay * (cosine + lean * sine);
    ornament.positionVelocity = (decay * sine) / ringRate;
    ornament.velocityPosition = (-decay * rate * rate * sine) / ringRate;
    ornament.velocityVelocity = decay * (cosine - lean * sine);
  };

  const rootFor = (ornament, body, root) => {
    const chunk = body.chunks[ornament.chunk];
    root.x =
      chunk.x +
      chunk.dx * ornament.offset.forward -
      chunk.dy * ornament.offset.outward * ornament.sideSign;
    root.y =
      chunk.y +
      chunk.dy * ornament.offset.forward +
      chunk.dx * ornament.offset.outward * ornament.sideSign;
    root.dx = chunk.dx * ornament.angleCosine - chunk.dy * ornament.angleSine;
    root.dy = chunk.dy * ornament.angleCosine + chunk.dx * ornament.angleSine;
    return root;
  };

  /* `bow` carries both which way the joint leaves the hip-foot line and how
     far along it travels; at zero the joint sits on the line. */
  const jointFor = (hip, foot, arm, bow, joint) => {
    const x = foot.x - hip.x;
    const y = foot.y - hip.y;
    const distance = magnitude(x, y);
    const normalX = distance > 0.001 ? -y / distance : -hip.dy;
    const normalY = distance > 0.001 ? x / distance : hip.dx;
    const halfBone = arm / 2;
    const halfSpan = Math.min(distance, arm) / 2;
    const bend = Math.sqrt(Math.max(0, halfBone ** 2 - halfSpan ** 2));
    joint.x = hip.x + x / 2 + normalX * bend * bow;
    joint.y = hip.y + y / 2 + normalY * bend * bow;
    return joint;
  };

  class Skin {
    constructor(model, body, legs) {
      this.model = model;
      this.body = body;
      this.legs = legs;
      this.joint = { x: 0, y: 0 };
      this.ornaments = [];
      this._buildOrnaments();
    }

    reconfigure(model, body, legs) {
      this.model = model;
      this.body = body;
      this.legs = legs;
    }

    _buildOrnaments() {
      this.ornaments = this.model.skin.ornaments.map((spec) => {
        const root = rootFor(spec, this.body, {});
        return {
          spec,
          root,
          nextRoot: { ...root },
          angle: 0,
          velocity: 0,
          directionX: root.dx,
          directionY: root.dy,
          coefficientDt: null,
          positionPosition: 1,
          positionVelocity: 0,
          velocityPosition: 0,
          velocityVelocity: 1,
        };
      });
    }

    _createRenderState() {
      return {
        layout: RENDER_LAYOUT,
        model: this.model,
        chunks: new Float64Array(
          this.body.chunks.length * RENDER_LAYOUT.chunkStride,
        ),
        legs: new Float64Array(this.legs.legs.length * RENDER_LAYOUT.legStride),
        ornaments: new Float64Array(
          this.ornaments.length * RENDER_LAYOUT.ornamentStride,
        ),
        plates: new Float64Array(
          this.model.skin.platesTailFirst.length * RENDER_LAYOUT.plateStride,
        ),
      };
    }

    writeRenderState(state) {
      if (!state || state.model !== this.model)
        state = this._createRenderState();
      const chunkStride = RENDER_LAYOUT.chunkStride;
      for (let index = 0; index < this.body.chunks.length; index++) {
        const chunk = this.body.chunks[index];
        const offset = index * chunkStride;
        state.chunks[offset] = chunk.x;
        state.chunks[offset + 1] = chunk.y;
        state.chunks[offset + 2] = chunk.dx;
        state.chunks[offset + 3] = chunk.dy;
      }

      const foot = this.model.legs.skin.foot;
      const legStride = RENDER_LAYOUT.legStride;
      const sectionStart = this.legs.legs.length
        ? this.model.chunks[this.model.legs.start].restDistance
        : 0;
      const sectionSpan = this.legs.legs.length
        ? this.model.chunks[this.model.legs.end - 1].restDistance - sectionStart
        : 0;
      const { jointBend, jointLeanCenter } = this.model.legs;
      for (let index = 0; index < this.legs.legs.length; index++) {
        const leg = this.legs.legs[index];
        const hip = this.body.chunks[leg.anchor];
        const arm = this.legs.armLength(leg);
        const joint = jointFor(
          hip,
          leg.foot,
          arm,
          leg.sideSign * jointBend,
          this.joint,
        );
        /* -1 at the head end of the leg section, 1 at the tail end. Taken
           from where the anchor sits, so pairs sharing one lean alike. */
        const chainPosition = sectionSpan
          ? (2 * (this.model.chunks[leg.anchor].restDistance - sectionStart)) /
              sectionSpan -
            1
          : 0;
        const offset = index * legStride;
        state.legs[offset] = hip.x;
        state.legs[offset + 1] = hip.y;
        state.legs[offset + 2] = joint.x;
        state.legs[offset + 3] = joint.y;
        state.legs[offset + 4] = leg.foot.x;
        state.legs[offset + 5] = leg.foot.y;
        state.legs[offset + 6] = hip.dx;
        state.legs[offset + 7] = hip.dy;
        state.legs[offset + 8] =
          foot.scale *
          this.model.skin.scale *
          (leg.progress < 1 ? 1 : foot.plantedScale);
        state.legs[offset + 9] = leg.sideSign;
        // How far this knee travels at jointLean 1, signed toward the head.
        state.legs[offset + 10] = (chainPosition - jointLeanCenter) * arm;
      }

      const ornamentStride = RENDER_LAYOUT.ornamentStride;
      for (let index = 0; index < this.ornaments.length; index++) {
        const ornament = this.ornaments[index];
        const offset = index * ornamentStride;
        state.ornaments[offset] = ornament.root.x;
        state.ornaments[offset + 1] = ornament.root.y;
        state.ornaments[offset + 2] = ornament.directionX;
        state.ornaments[offset + 3] = ornament.directionY;
        state.ornaments[offset + 4] =
          ornament.spec.scale * this.model.skin.scale;
        state.ornaments[offset + 5] = ornament.spec.sideSign;
      }

      const plates = this.model.skin.platesTailFirst;
      const plateStride = RENDER_LAYOUT.plateStride;
      for (let index = 0; index < plates.length; index++) {
        const plate = plates[index];
        const chunk = this.body.chunks[plate.chunk];
        const offset = index * plateStride;
        state.plates[offset] = chunk.x;
        state.plates[offset + 1] = chunk.y;
        state.plates[offset + 2] = chunk.dx;
        state.plates[offset + 3] = chunk.dy;
        state.plates[offset + 4] =
          plate.scale *
          this.model.chunks[plate.chunk].plateScale *
          this.model.skin.scale *
          (1 +
            this.model.skin.loadScale * this.body.chunks[plate.chunk].contact);
      }
      return state;
    }

    update(dt) {
      for (let index = 0; index < this.ornaments.length; index++) {
        const ornament = this.ornaments[index];
        const { spec } = ornament;
        const previousRoot = ornament.root;
        const root = rootFor(spec, this.body, ornament.nextRoot);
        if (ornament.coefficientDt !== dt) {
          ornament.coefficientDt = dt;
          springCoefficients(
            ornament,
            spec.recover,
            1 - spec.wobble * (1 - MIN_DAMPING_RATIO),
            dt,
          );
        }

        const turnRate =
          Math.atan2(
            previousRoot.dx * root.dy - previousRoot.dy * root.dx,
            previousRoot.dx * root.dx + previousRoot.dy * root.dy,
          ) / dt;
        const lateralRate =
          ((root.x - previousRoot.x) * -root.dy +
            (root.y - previousRoot.y) * root.dx) /
          dt;
        /* The deviation opposes the root's motion, so positive react trails
           and negative react leads. */
        const target = Math.min(
          MAX_DEFLECTION,
          Math.max(
            -MAX_DEFLECTION,
            (spec.waveGain * -turnRate) / RADIAN_TURN_RATE +
              (spec.physGain * -lateralRate) / RADIAN_LATERAL_RATE,
          ),
        );

        const deviation = ornament.angle - target;
        let angle =
          target +
          deviation * ornament.positionPosition +
          ornament.velocity * ornament.positionVelocity;
        let velocity =
          deviation * ornament.velocityPosition +
          ornament.velocity * ornament.velocityVelocity;
        /* At low wobble a resonant drive can wind the spring through full
           turns; the rail keeps the deflection readable. */
        if (angle > MAX_DEFLECTION) {
          angle = MAX_DEFLECTION;
          velocity = 0;
        } else if (angle < -MAX_DEFLECTION) {
          angle = -MAX_DEFLECTION;
          velocity = 0;
        }
        ornament.angle = angle;
        ornament.velocity = velocity;

        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        ornament.directionX = root.dx * cosine - root.dy * sine;
        ornament.directionY = root.dy * cosine + root.dx * sine;
        ornament.root = root;
        ornament.nextRoot = previousRoot;
      }
    }

    translate(offset) {
      this.ornaments.forEach((ornament) => {
        ornament.root.x += offset.x;
        ornament.root.y += offset.y;
      });
    }
  }

  return Skin;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BeefwifeSkin };
}
