/** Schema-v1 Verlet chain. Private state is owned by one Beefwife instance. */

import { positiveModulo } from "./drive.mjs";
import { ChainTables } from "./tables.mjs";
import { carryChunks } from "./carry.mjs";

const TAU = Math.PI * 2;
const PHYSICS_STEP = 1 / 60;
/* Link relaxation converges on passes per second, so this and the substep
   rate trade against each other: their product is the budget, and 480 a
   second holds the shipped descriptors inside 6.6% link error. A slower
   substep rate needs proportionally more passes to hold the same chain.
   Grip and jointCorrection do not trade this way; both take a fixed share
   per substep, so changing the rate alone changes how far a creature
   travels in a second. */
const RELAX_PASSES = 8;
const AXIS_RATE = 1.5;
/* Bend displaces a chunk and relaxation pulls back only a `linkCorrection`
   share, so a soft material lets each substep add more than it removes and
   the chain scatters without bound. This is the hard ceiling every link is
   held to whatever its material says. The widest stretch any shipped
   descriptor reaches is 1.63, so it engages only on a chain running away. */
const MAX_LINK_STRETCH = 3;
const magnitude = (x, y) => Math.sqrt(x * x + y * y);
const compareGain = (chunks, before, after) =>
  chunks[before].gain - chunks[after].gain || before - after;

const selectLowest = (order, chunks, count) => {
  if (count <= 0 || count >= order.length) return;
  const target = count - 1;
  let left = 0;
  let right = order.length - 1;
  while (left < right) {
    const pivot = order[(left + right) >> 1];
    let lower = left;
    let upper = right;
    while (lower <= upper) {
      while (lower <= right && compareGain(chunks, order[lower], pivot) < 0)
        lower++;
      while (upper >= left && compareGain(chunks, pivot, order[upper]) < 0)
        upper--;
      if (lower <= upper) {
        const swap = order[lower];
        order[lower++] = order[upper];
        order[upper--] = swap;
      }
    }
    if (target <= upper) right = upper;
    else if (target >= lower) left = lower;
    else return;
  }
};

class Body {
  constructor(model, gait, breathingPhase = gait.phase) {
    this.model = model;
    this.gait = gait;
    this.breathingPhase = breathingPhase;
    this.breathingScale = 0;
    this.accumulator = 0;
    this.axis = { x: 1, y: 0 };
    this.steeringBias = 0;
    this.chunks = model.chunks.map(() => ({
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      dx: 1,
      dy: 0,
      idle: 0,
      gain: 0,
      gaitContact: 1,
      contact: 1,
    }));
    this.linkTargets = new Float64Array(model.links.length);
    this.breathingShiftX = new Float64Array(model.chunks.length);
    this.breathingShiftY = new Float64Array(model.chunks.length);
    this.liftOrder = model.chunks.map((_, index) => index);
    this.liftTargets = new Float64Array(model.chunks.length);
    this.correction = { x: 0, y: 0 };
    this.tables = new ChainTables(model, model.gait, PHYSICS_STEP, RELAX_PASSES);
  }

  reconfigure(model, gait, throttle = 1, breathingPhase = this.breathingPhase) {
    if (model.chunks.length !== this.chunks.length)
      throw new Error("cannot reconfigure a different chunk count");
    this.model = model;
    this.gait = gait;
    this.breathingPhase = breathingPhase;
    this.tables.refresh(model, model.gait, PHYSICS_STEP, RELAX_PASSES);
    this.refreshContacts(throttle);
  }

  place(position, direction) {
    this.chunks.forEach((chunk, index) => {
      const distance = this.model.chunks[index].restDistance;
      chunk.x = position.x - direction.x * distance;
      chunk.y = position.y - direction.y * distance;
      chunk.px = chunk.x;
      chunk.py = chunk.y;
      chunk.dx = direction.x;
      chunk.dy = direction.y;
      chunk.idle = 0;
      chunk.gain = 0;
    });
    this.axis = { ...direction };
    this.steeringBias = 0;
    this.accumulator = 0;
    this.breathingScale = 0;
    this.refreshContacts(1);
  }

  /* Takes on the state of the body it replaces. The chain itself is carried
     chunk by chunk; these are the values that belong to the whole creature. */
  adopt(previous) {
    carryChunks(this.chunks, this.model, previous.chunks, previous.model);
    this.axis = { ...previous.axis };
    this.steeringBias = previous.steeringBias;
    this.accumulator = previous.accumulator;
    this.breathingScale = previous.breathingScale;
  }

  refreshContacts(throttle) {
    const autoLift = this.model.physics.autoLift;
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      const spec = this.model.chunks[index];
      chunk.gaitContact = this.gait.contactAt(
        spec.restDistance,
        throttle,
        spec.motionScale.contact,
      );
      chunk.contact = Math.max(
        0,
        Math.min(
          1,
          chunk.gaitContact * (1 - autoLift.amount * chunk.idle * throttle),
        ),
      );
    }
  }

  translate(offset) {
    this.chunks.forEach((chunk) => {
      chunk.x += offset.x;
      chunk.y += offset.y;
      chunk.px += offset.x;
      chunk.py += offset.y;
    });
  }

  fitsTranslation(offset, limit) {
    return this.chunks.every((chunk) =>
      ["x", "y", "px", "py"].every((key) => {
        const axisOffset = key.endsWith("x") ? offset.x : offset.y;
        const next = chunk[key] + axisOffset;
        return Number.isFinite(next) && Math.abs(next) <= limit;
      }),
    );
  }

  worldCorrection(limit) {
    let minimumX = Infinity;
    let maximumX = -Infinity;
    let minimumY = Infinity;
    let maximumY = -Infinity;
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      minimumX = Math.min(minimumX, chunk.x, chunk.px);
      maximumX = Math.max(maximumX, chunk.x, chunk.px);
      minimumY = Math.min(minimumY, chunk.y, chunk.py);
      maximumY = Math.max(maximumY, chunk.y, chunk.py);
    }
    const correction = (minimum, maximum) => {
      if (maximum > limit) return limit - maximum;
      if (minimum < -limit) return -limit - minimum;
      return 0;
    };
    this.correction.x = correction(minimumX, maximumX);
    this.correction.y = correction(minimumY, maximumY);
    return this.correction;
  }

  step(dt, throttle, direction, afterSubstep) {
    this.accumulator += dt;
    let stepped = false;
    while (this.accumulator >= PHYSICS_STEP) {
      this.accumulator -= PHYSICS_STEP;
      this._substep(PHYSICS_STEP, throttle, direction);
      if (afterSubstep) afterSubstep(PHYSICS_STEP);
      stepped = true;
    }
    return stepped;
  }

  _substep(dt, throttle, direction) {
    this.gait.advance(dt, throttle);
    this.breathingPhase =
      (this.breathingPhase + TAU * this.model.breathing.cyclesPerSecond * dt) %
      TAU;
    this._updateTangentsAndAxis(dt);
    this._applyBreathing();
    this._integrate(dt, throttle);
    this._applyBend(throttle, this._steer(direction, dt));
    this._updateLinkTargets(throttle);
    for (let pass = 0; pass < RELAX_PASSES; pass++) this._relaxLinks();
    this._clampLinks();
    this._applyAutoLift(dt, throttle);
  }

  _applyBreathing() {
    const nextScale =
      this.model.breathing.strain * Math.sin(this.breathingPhase);
    const scaleChange = nextScale - this.breathingScale;
    this.breathingScale = nextScale;
    if (Math.abs(scaleChange) < 1e-15) return;
    const { start, end, count, spacing } = this.model.sections.trunk;
    const middle = (count - 1) / 2;
    const front = this.chunks[start];
    const rear = this.chunks[end - 1];
    let meanX = 0;
    let meanY = 0;
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      const position =
        index < start
          ? middle
          : index >= end
            ? -middle
            : middle - (index - start);
      const tangent = index < start ? front : index >= end ? rear : chunk;
      const distance = position * spacing * scaleChange;
      const x = tangent.dx * distance;
      const y = tangent.dy * distance;
      this.breathingShiftX[index] = x;
      this.breathingShiftY[index] = y;
      meanX += x / this.chunks.length;
      meanY += y / this.chunks.length;
    }
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      const x = this.breathingShiftX[index] - meanX;
      const y = this.breathingShiftY[index] - meanY;
      chunk.x += x;
      chunk.y += y;
      chunk.px += x;
      chunk.py += y;
    }
  }

  _updateTangentsAndAxis(dt) {
    const chunks = this.chunks;
    const count = chunks.length;
    const last = count - 1;
    let axisX = 0;
    let axisY = 0;
    for (let index = 0; index < count; index++) {
      const chunk = chunks[index];
      const ahead = chunks[index === 0 ? 0 : index - 1];
      const behind = chunks[index === last ? last : index + 1];
      const x = ahead.x - behind.x;
      const y = ahead.y - behind.y;
      const tangentLength = Math.sqrt(x * x + y * y);
      if (tangentLength >= 1e-9) {
        chunk.dx = x / tangentLength;
        chunk.dy = y / tangentLength;
      }
      axisX += chunk.x - chunk.px;
      axisY += chunk.y - chunk.py;
    }
    const axisLength = Math.sqrt(axisX * axisX + axisY * axisY);
    if (axisLength < 1e-9) return;
    const amount = Math.min(1, dt * AXIS_RATE);
    this.axis.x += (axisX / axisLength - this.axis.x) * amount;
    this.axis.y += (axisY / axisLength - this.axis.y) * amount;
    const length = magnitude(this.axis.x, this.axis.y) || 1;
    this.axis.x /= length;
    this.axis.y /= length;
  }

  _integrate(dt, throttle) {
    const dtSquared = dt * dt;
    const chunks = this.chunks;
    const count = chunks.length;
    const gait = this.gait.gait;
    const phase = this.gait.phase;
    const contact = gait.contact;
    const thrust = gait.thrust;
    const contactHarmonic = contact.harmonic;
    const thrustHarmonic = thrust.harmonic;
    const contactPhaseOffset = contact.phaseOffset;
    const thrustPhaseOffset = thrust.phaseOffset;
    const contactDuty = contact.dutyCycle;
    const thrustDuty = thrust.dutyCycle;
    const contactAmplitude = contact.amplitude;
    const thrustAcceleration = thrust.acceleration;
    const autoLift = this.model.physics.autoLift.amount;
    const axisX = this.axis.x;
    const axisY = this.axis.y;
    const {
      retention,
      gripForward,
      gripBackward,
      gripLateral,
      motionContact,
      motionThrust,
      phaseLag,
    } = this.tables;

    for (let index = 0; index < count; index++) {
      const chunk = chunks[index];
      const hold = retention[index];
      const velocityX = (chunk.x - chunk.px) * hold;
      const velocityY = (chunk.y - chunk.py) * hold;
      chunk.px = chunk.x;
      chunk.py = chunk.y;
      chunk.x += velocityX;
      chunk.y += velocityY;

      const dx = chunk.dx;
      const dy = chunk.dy;
      const x = chunk.x - chunk.px;
      const y = chunk.y - chunk.py;
      const along = x * dx + y * dy;
      const lateral = x * -dy + y * dx;

      const lagged = phase - phaseLag[index];
      const contactCycle =
        positiveModulo(
          contactHarmonic * lagged + contactPhaseOffset,
          TAU,
        ) / TAU;
      const gaitContact =
        contactCycle >= contactDuty
          ? 1
          : 1 -
            contactAmplitude *
              motionContact[index] *
              throttle *
              Math.sin((Math.PI * contactCycle) / contactDuty);
      chunk.gaitContact = gaitContact;
      const grounded = Math.max(
        0,
        Math.min(1, gaitContact * (1 - autoLift * chunk.idle * throttle)),
      );
      chunk.contact = grounded;

      const retainedAlong =
        along *
        (1 -
          grounded * (along < 0 ? gripBackward[index] : gripForward[index]));
      const retainedLateral = lateral * (1 - grounded * gripLateral[index]);
      chunk.x = chunk.px + dx * retainedAlong - dy * retainedLateral;
      chunk.y = chunk.py + dy * retainedAlong + dx * retainedLateral;
      chunk.gain = -(
        (along - retainedAlong) * (dx * axisX + dy * axisY) +
        (lateral - retainedLateral) * (-dy * axisX + dx * axisY)
      );

      const thrustCycle =
        positiveModulo(thrustHarmonic * lagged + thrustPhaseOffset, TAU) / TAU;
      const acceleration =
        thrustCycle >= thrustDuty
          ? 0
          : thrustAcceleration *
            motionThrust[index] *
            throttle *
            Math.sin((Math.PI * thrustCycle) / thrustDuty);
      chunk.x += dx * acceleration * dtSquared;
      chunk.y += dy * acceleration * dtSquared;
    }
  }

  _steer(direction, dt) {
    const steering = this.model.physics.steering;
    const head = this.chunks[0];
    const error = Math.atan2(
      head.dx * direction.y - head.dy * direction.x,
      head.dx * direction.x + head.dy * direction.y,
    );
    const wanted = -Math.max(
      -steering.limit,
      Math.min(steering.limit, error * steering.gain),
    );
    this.steeringBias +=
      (wanted - this.steeringBias) * Math.min(1, dt * steering.rate);
    return this.steeringBias;
  }

  _applyBend(throttle, bias) {
    const channel = this.model.gait.bend;
    const phase = channel.harmonic * this.gait.phase;
    const phaseSine = Math.sin(phase);
    const phaseCosine = Math.cos(phase);
    const chunks = this.chunks;
    const last = chunks.length - 1;
    const amplitude = channel.amplitude;
    const biasThrottle = bias * throttle;
    const {
      motionBend,
      bendPhaseSine,
      bendPhaseCosine,
      bendScale,
      jointCorrectionHalf,
    } = this.tables;
    let before = chunks[0];
    let chunk = chunks[1];
    for (let index = 1; index < last; index++) {
      const after = chunks[index + 1];
      const ax = chunk.x - before.x;
      const ay = chunk.y - before.y;
      const bx = after.x - chunk.x;
      const by = after.y - chunk.y;
      const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      const bend =
        amplitude *
        motionBend[index] *
        throttle *
        (phaseSine * bendPhaseCosine[index] +
          phaseCosine * bendPhaseSine[index]);
      const target = (bend + biasThrottle) * bendScale[index];
      const correction = (target - turn) * jointCorrectionHalf[index];
      const cosine = Math.cos(correction);
      const sine = Math.sin(correction);
      const nextBeforeX = chunk.x - (ax * cosine + ay * sine);
      const nextBeforeY = chunk.y - (ay * cosine - ax * sine);
      const nextAfterX = chunk.x + (bx * cosine - by * sine);
      const nextAfterY = chunk.y + (bx * sine + by * cosine);
      const shiftX = (nextBeforeX - before.x + (nextAfterX - after.x)) / 3;
      const shiftY = (nextBeforeY - before.y + (nextAfterY - after.y)) / 3;
      before.x = nextBeforeX - shiftX;
      before.y = nextBeforeY - shiftY;
      after.x = nextAfterX - shiftX;
      after.y = nextAfterY - shiftY;
      chunk.x -= shiftX;
      chunk.y -= shiftY;
      before = chunk;
      chunk = after;
    }
  }

  _updateLinkTargets(throttle) {
    const channel = this.model.gait.gather;
    const phase = channel.harmonic * this.gait.phase;
    const phaseSine = Math.sin(phase);
    const phaseCosine = Math.cos(phase);
    const amplitude = channel.amplitude;
    const breathing = this.breathingScale;
    const targets = this.linkTargets;
    const {
      linkRestLength,
      gatherScale,
      gatherPhaseSine,
      gatherPhaseCosine,
      linkBreathes,
    } = this.tables;
    for (let index = 0; index < targets.length; index++) {
      const wave =
        phaseCosine * gatherPhaseCosine[index] -
        phaseSine * gatherPhaseSine[index];
      const gather = 1 + amplitude * gatherScale[index] * throttle * wave;
      targets[index] =
        linkRestLength[index] * gather * (linkBreathes[index] ? 1 + breathing : 1);
    }
  }

  /* Link k joins chunks k and k+1, so the chunk this link ends on is the one
     the next link starts from and the walk carries it forward. */
  _relaxLinks() {
    const chunks = this.chunks;
    const targets = this.linkTargets;
    const correctionHalf = this.tables.linkCorrectionHalf;
    const count = targets.length;
    let before = chunks[0];
    for (let index = 0; index < count; index++) {
      const after = chunks[index + 1];
      const x = after.x - before.x;
      const y = after.y - before.y;
      const distance = Math.sqrt(x * x + y * y) || 0.001;
      const shift =
        ((distance - targets[index]) / distance) * correctionHalf[index];
      before.x += x * shift;
      before.y += y * shift;
      after.x -= x * shift;
      after.y -= y * shift;
      before = after;
    }
  }

  /* Holding the head still keeps a clamped chain's reported pose where the
     host last saw it, and the sweep moves only the trailing chunk, so the
     link just fixed cannot be disturbed by the next one. */
  _clampLinks() {
    const chunks = this.chunks;
    const targets = this.linkTargets;
    const count = targets.length;
    let before = chunks[0];
    for (let index = 0; index < count; index++) {
      const after = chunks[index + 1];
      const limit = targets[index] * MAX_LINK_STRETCH;
      const x = after.x - before.x;
      const y = after.y - before.y;
      const distance = Math.sqrt(x * x + y * y);
      if (distance > limit) {
        const scale = limit / distance;
        after.x = before.x + x * scale;
        after.y = before.y + y * scale;
      }
      before = after;
    }
  }

  _applyAutoLift(dt, throttle) {
    const autoLift = this.model.physics.autoLift;
    if (!autoLift.amount) return;
    const lifted = Math.round(autoLift.share * this.chunks.length);
    selectLowest(this.liftOrder, this.chunks, lifted);
    this.liftTargets.fill(0);
    for (let index = 0; index < lifted; index++)
      this.liftTargets[this.liftOrder[index]] = throttle;
    const amount = Math.min(1, dt * autoLift.rate);
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      chunk.idle += (this.liftTargets[index] - chunk.idle) * amount;
      chunk.contact = Math.max(
        0,
        Math.min(
          1,
          chunk.gaitContact * (1 - autoLift.amount * chunk.idle * throttle),
        ),
      );
    }
  }

  getPose(pose) {
    const head = this.chunks[0];
    const behind = this.chunks[1];
    const dx = head.x - behind.x;
    const dy = head.y - behind.y;
    const distance = magnitude(dx, dy);
    if (distance < 1e-9) {
      pose.direction.x = head.dx;
      pose.direction.y = head.dy;
    } else {
      pose.direction.x = dx / distance;
      pose.direction.y = dy / distance;
    }
    let centerX = 0;
    let centerY = 0;
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      centerX += chunk.x / this.chunks.length;
      centerY += chunk.y / this.chunks.length;
    }
    pose.head.x = head.x;
    pose.head.y = head.y;
    pose.center.x = centerX;
    pose.center.y = centerY;
    return pose;
  }
}

export { Body, PHYSICS_STEP, MAX_LINK_STRETCH };
