/** Schema-v1 Verlet chain. Private state is owned by one Beefwife instance. */

import { positiveModulo } from "./drive.mjs";
import { ChainTables } from "./tables.mjs";
import { ChainState } from "./chain.mjs";
import { carryChunks } from "./carry.mjs";
import { Bend } from "./bend.mjs";

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
const compareGain = (gain, before, after) =>
  gain[before] - gain[after] || before - after;

const selectLowest = (order, gain, count) => {
  if (count <= 0 || count >= order.length) return;
  const target = count - 1;
  let left = 0;
  let right = order.length - 1;
  while (left < right) {
    const pivot = order[(left + right) >> 1];
    let lower = left;
    let upper = right;
    while (lower <= upper) {
      while (lower <= right && compareGain(gain, order[lower], pivot) < 0)
        lower++;
      while (upper >= left && compareGain(gain, pivot, order[upper]) < 0)
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
    this.chain = new ChainState(model.chunks.length);
    this.linkTargets = new Float64Array(model.links.length);
    this.bend = new Bend(model.chunks.length);
    this.breathingShiftX = new Float64Array(model.chunks.length);
    this.breathingShiftY = new Float64Array(model.chunks.length);
    this.liftOrder = model.chunks.map((_, index) => index);
    this.liftTargets = new Float64Array(model.chunks.length);
    this.tables = new ChainTables(
      model,
      model.gait,
      PHYSICS_STEP,
      RELAX_PASSES,
    );
  }

  reconfigure(model, gait, throttle = 1, breathingPhase = this.breathingPhase) {
    if (model.chunks.length !== this.chain.count)
      throw new Error("cannot reconfigure a different chunk count");
    this.model = model;
    this.gait = gait;
    this.breathingPhase = breathingPhase;
    this.tables.refresh(model, model.gait, PHYSICS_STEP, RELAX_PASSES);
    this.refreshContacts(throttle);
  }

  place(position, direction) {
    const { x, y, px, py, dx, dy, idle, gain, count } = this.chain;
    for (let index = 0; index < count; index++) {
      const distance = this.model.chunks[index].restDistance;
      x[index] = position.x - direction.x * distance;
      y[index] = position.y - direction.y * distance;
      px[index] = x[index];
      py[index] = y[index];
      dx[index] = direction.x;
      dy[index] = direction.y;
      idle[index] = 0;
      gain[index] = 0;
    }
    this.axis = { ...direction };
    this.steeringBias = 0;
    this.accumulator = 0;
    this.breathingScale = 0;
    this.refreshContacts(1);
  }

  /* Takes on the state of the body it replaces. The chain itself is carried
     chunk by chunk; these are the values that belong to the whole creature. */
  adopt(previous) {
    carryChunks(this.chain, this.model, previous.chain, previous.model);
    this.axis = { ...previous.axis };
    this.steeringBias = previous.steeringBias;
    this.accumulator = previous.accumulator;
    this.breathingScale = previous.breathingScale;
  }

  refreshContacts(throttle) {
    const autoLift = this.model.physics.autoLift;
    const { idle, gaitContact, contact, count } = this.chain;
    for (let index = 0; index < count; index++) {
      const spec = this.model.chunks[index];
      gaitContact[index] = this.gait.contactAt(
        spec.restDistance,
        throttle,
        spec.motionScale.contact,
      );
      contact[index] = Math.max(
        0,
        Math.min(
          1,
          gaitContact[index] * (1 - autoLift.amount * idle[index] * throttle),
        ),
      );
    }
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
    this._updateLinkTargets(throttle);
    this.bend.update(
      this.model,
      this.gait,
      this.tables,
      this.linkTargets,
      throttle,
      this._steer(direction, dt),
    );
    this.bend.relax(this.chain, this.tables.jointCorrectionHalf);
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
    const { x, y, px, py, dx, dy, count: chunkCount } = this.chain;
    let meanX = 0;
    let meanY = 0;
    for (let index = 0; index < chunkCount; index++) {
      const position =
        index < start
          ? middle
          : index >= end
            ? -middle
            : middle - (index - start);
      const tangent = index < start ? start : index >= end ? end - 1 : index;
      const distance = position * spacing * scaleChange;
      const shiftX = dx[tangent] * distance;
      const shiftY = dy[tangent] * distance;
      this.breathingShiftX[index] = shiftX;
      this.breathingShiftY[index] = shiftY;
      meanX += shiftX / chunkCount;
      meanY += shiftY / chunkCount;
    }
    for (let index = 0; index < chunkCount; index++) {
      const shiftX = this.breathingShiftX[index] - meanX;
      const shiftY = this.breathingShiftY[index] - meanY;
      x[index] += shiftX;
      y[index] += shiftY;
      px[index] += shiftX;
      py[index] += shiftY;
    }
  }

  _updateTangentsAndAxis(dt) {
    const { x, y, px, py, dx, dy, count } = this.chain;
    const last = count - 1;
    let axisX = 0;
    let axisY = 0;
    for (let index = 0; index < count; index++) {
      const ahead = index === 0 ? 0 : index - 1;
      const behind = index === last ? last : index + 1;
      const spanX = x[ahead] - x[behind];
      const spanY = y[ahead] - y[behind];
      const tangentLength = Math.sqrt(spanX * spanX + spanY * spanY);
      if (tangentLength >= 1e-9) {
        dx[index] = spanX / tangentLength;
        dy[index] = spanY / tangentLength;
      }
      axisX += x[index] - px[index];
      axisY += y[index] - py[index];
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
    const gait = this.gait.gait;
    const phase = this.gait.phase;
    const contactChannel = gait.contact;
    const thrust = gait.thrust;
    const contactHarmonic = contactChannel.harmonic;
    const thrustHarmonic = thrust.harmonic;
    const contactPhaseOffset = contactChannel.phaseOffset;
    const thrustPhaseOffset = thrust.phaseOffset;
    const contactDuty = contactChannel.dutyCycle;
    const thrustDuty = thrust.dutyCycle;
    const contactAmplitude = contactChannel.amplitude;
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
    const { x, y, px, py, dx, dy, idle, gain, gaitContact, contact, count } =
      this.chain;

    for (let index = 0; index < count; index++) {
      const hold = retention[index];
      const startX = x[index];
      const startY = y[index];
      const velocityX = (startX - px[index]) * hold;
      const velocityY = (startY - py[index]) * hold;
      px[index] = startX;
      py[index] = startY;
      const movedX = startX + velocityX;
      const movedY = startY + velocityY;

      const tangentX = dx[index];
      const tangentY = dy[index];
      /* Read back as a difference rather than reused from `velocity`: the sum
         above rounds, and the solver is held to the same bits it produced. */
      const spanX = movedX - startX;
      const spanY = movedY - startY;
      const along = spanX * tangentX + spanY * tangentY;
      const lateral = spanX * -tangentY + spanY * tangentX;

      const lagged = phase - phaseLag[index];
      const contactCycle =
        positiveModulo(contactHarmonic * lagged + contactPhaseOffset, TAU) /
        TAU;
      const cycleContact =
        contactCycle >= contactDuty
          ? 1
          : 1 -
            contactAmplitude *
              motionContact[index] *
              throttle *
              Math.sin((Math.PI * contactCycle) / contactDuty);
      gaitContact[index] = cycleContact;
      const grounded = Math.max(
        0,
        Math.min(1, cycleContact * (1 - autoLift * idle[index] * throttle)),
      );
      contact[index] = grounded;

      const retainedAlong =
        along *
        (1 - grounded * (along < 0 ? gripBackward[index] : gripForward[index]));
      const retainedLateral = lateral * (1 - grounded * gripLateral[index]);
      const heldX =
        startX + tangentX * retainedAlong - tangentY * retainedLateral;
      const heldY =
        startY + tangentY * retainedAlong + tangentX * retainedLateral;
      gain[index] = -(
        (along - retainedAlong) * (tangentX * axisX + tangentY * axisY) +
        (lateral - retainedLateral) * (-tangentY * axisX + tangentX * axisY)
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
      x[index] = heldX + tangentX * acceleration * dtSquared;
      y[index] = heldY + tangentY * acceleration * dtSquared;
    }
  }

  _steer(direction, dt) {
    const steering = this.model.physics.steering;
    const { dx, dy } = this.chain;
    const error = Math.atan2(
      dx[0] * direction.y - dy[0] * direction.x,
      dx[0] * direction.x + dy[0] * direction.y,
    );
    const wanted = -Math.max(
      -steering.limit,
      Math.min(steering.limit, error * steering.gain),
    );
    this.steeringBias +=
      (wanted - this.steeringBias) * Math.min(1, dt * steering.rate);
    return this.steeringBias;
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
        linkRestLength[index] *
        gather *
        (linkBreathes[index] ? 1 + breathing : 1);
    }
  }

  /* Link k joins chunks k and k+1, so the chunk this link ends on is the one
     the next link starts from and the walk carries it forward. */
  _relaxLinks() {
    const { x, y } = this.chain;
    const targets = this.linkTargets;
    const correctionHalf = this.tables.linkCorrectionHalf;
    const count = targets.length;
    let beforeX = x[0];
    let beforeY = y[0];
    for (let index = 0; index < count; index++) {
      const afterX = x[index + 1];
      const afterY = y[index + 1];
      const spanX = afterX - beforeX;
      const spanY = afterY - beforeY;
      const distance = Math.sqrt(spanX * spanX + spanY * spanY) || 0.001;
      const shift =
        ((distance - targets[index]) / distance) * correctionHalf[index];
      x[index] = beforeX + spanX * shift;
      y[index] = beforeY + spanY * shift;
      beforeX = afterX - spanX * shift;
      beforeY = afterY - spanY * shift;
    }
    x[count] = beforeX;
    y[count] = beforeY;
  }

  /* Holding the head still keeps a clamped chain's reported pose where the
     host last saw it, and the sweep moves only the trailing chunk, so the
     link just fixed cannot be disturbed by the next one. */
  _clampLinks() {
    const { x, y } = this.chain;
    const targets = this.linkTargets;
    const count = targets.length;
    let beforeX = x[0];
    let beforeY = y[0];
    for (let index = 0; index < count; index++) {
      const limit = targets[index] * MAX_LINK_STRETCH;
      const spanX = x[index + 1] - beforeX;
      const spanY = y[index + 1] - beforeY;
      const distance = Math.sqrt(spanX * spanX + spanY * spanY);
      if (distance > limit) {
        const scale = limit / distance;
        beforeX = beforeX + spanX * scale;
        beforeY = beforeY + spanY * scale;
        x[index + 1] = beforeX;
        y[index + 1] = beforeY;
      } else {
        beforeX = x[index + 1];
        beforeY = y[index + 1];
      }
    }
  }

  _applyAutoLift(dt, throttle) {
    const autoLift = this.model.physics.autoLift;
    if (!autoLift.amount) return;
    const { idle, gain, gaitContact, contact, count } = this.chain;
    const lifted = Math.round(autoLift.share * count);
    selectLowest(this.liftOrder, gain, lifted);
    this.liftTargets.fill(0);
    for (let index = 0; index < lifted; index++)
      this.liftTargets[this.liftOrder[index]] = throttle;
    const amount = Math.min(1, dt * autoLift.rate);
    for (let index = 0; index < count; index++) {
      idle[index] += (this.liftTargets[index] - idle[index]) * amount;
      contact[index] = Math.max(
        0,
        Math.min(
          1,
          gaitContact[index] * (1 - autoLift.amount * idle[index] * throttle),
        ),
      );
    }
  }

  getPose(pose) {
    const { x, y, dx, dy, count } = this.chain;
    const headX = x[0] - x[1];
    const headY = y[0] - y[1];
    const distance = magnitude(headX, headY);
    if (distance < 1e-9) {
      pose.direction.x = dx[0];
      pose.direction.y = dy[0];
    } else {
      pose.direction.x = headX / distance;
      pose.direction.y = headY / distance;
    }
    let centerX = 0;
    let centerY = 0;
    for (let index = 0; index < count; index++) {
      centerX += x[index] / count;
      centerY += y[index] / count;
    }
    pose.head.x = x[0];
    pose.head.y = y[0];
    pose.center.x = centerX;
    pose.center.y = centerY;
    return pose;
  }
}

export { Body, PHYSICS_STEP, MAX_LINK_STRETCH };
