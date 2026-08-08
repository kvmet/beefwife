/** Schema-v1 ornament motion and renderer snapshots. */

const BeefwifeSkin = (() => {
  const RENDER_LAYOUT = Object.freeze({
    chunkStride: 4,
    legStride: 11,
    ornamentStride: 6,
    plateStride: 5,
  });
  const magnitude = (x, y) => Math.sqrt(x * x + y * y);

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
        const tip = {
          x: root.x + root.dx * spec.length,
          y: root.y + root.dy * spec.length,
          px: root.x + root.dx * spec.length,
          py: root.y + root.dy * spec.length,
        };
        return {
          spec,
          root,
          nextRoot: { ...root },
          tip,
          directionX: root.dx,
          directionY: root.dy,
          coefficientDt: null,
          damping: 0,
          snap: 0,
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
        const { spec, tip } = ornament;
        const previousRoot = ornament.root;
        const root = rootFor(spec, this.body, ornament.nextRoot);
        const carryX = (root.x - previousRoot.x) * spec.carry;
        const carryY = (root.y - previousRoot.y) * spec.carry;
        tip.x += carryX;
        tip.y += carryY;
        tip.px += carryX;
        tip.py += carryY;

        if (ornament.coefficientDt !== dt) {
          ornament.coefficientDt = dt;
          ornament.damping = Math.exp(-spec.dampingRate * dt);
          ornament.snap = 1 - Math.exp(-spec.snapRate * dt);
        }
        const velocityX = (tip.x - tip.px) * ornament.damping;
        const velocityY = (tip.y - tip.py) * ornament.damping;
        tip.px = tip.x;
        tip.py = tip.y;
        tip.x += velocityX;
        tip.y += velocityY;

        const targetX = root.x + root.dx * spec.length;
        const targetY = root.y + root.dy * spec.length;
        tip.x += (targetX - tip.x) * ornament.snap;
        tip.y += (targetY - tip.y) * ornament.snap;

        const x = tip.x - root.x;
        const y = tip.y - root.y;
        const distance = magnitude(x, y);
        if (distance < 1e-9) {
          tip.x = targetX;
          tip.y = targetY;
          ornament.directionX = root.dx;
          ornament.directionY = root.dy;
        } else {
          ornament.directionX = x / distance;
          ornament.directionY = y / distance;
          tip.x = root.x + ornament.directionX * spec.length;
          tip.y = root.y + ornament.directionY * spec.length;
        }
        ornament.root = root;
        ornament.nextRoot = previousRoot;
      }
    }

    translate(offset) {
      this.ornaments.forEach((ornament) => {
        ornament.root.x += offset.x;
        ornament.root.y += offset.y;
        ornament.tip.x += offset.x;
        ornament.tip.y += offset.y;
        ornament.tip.px += offset.x;
        ornament.tip.py += offset.y;
      });
    }
  }

  return Skin;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BeefwifeSkin };
}
