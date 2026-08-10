/** Schema-v1 Verlet chain. Private state is owned by one Beefwife instance. */

const TAU = Math.PI * 2;
const PHYSICS_STEP = 1 / 120;
const RELAX_PASSES = 4;
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
    this.retention = new Float64Array(model.chunks.length);
    this._refreshRetention();
  }

  /* velocityRetention is per second; the substep factor is its dt power.
     pow keeps the endpoints exact: 0 stops in one step, 1 is frictionless. */
  _refreshRetention() {
    for (let index = 0; index < this.model.chunks.length; index++)
      this.retention[index] = Math.pow(
        this.model.chunks[index].material.velocityRetention,
        PHYSICS_STEP,
      );
  }

  reconfigure(model, gait, throttle = 1, breathingPhase = this.breathingPhase) {
    if (model.chunks.length !== this.chunks.length)
      throw new Error("cannot reconfigure a different chunk count");
    this.model = model;
    this.gait = gait;
    this.breathingPhase = breathingPhase;
    this._refreshRetention();
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

  /* Carries chunk state onto a chain whose section counts changed. A chunk
     the descriptor still names keeps its position and velocity; an added one
     is seeded from its neighbours. The creature settles from where it was
     rather than snapping straight, and since head always holds a chunk the
     new chain always has something to carry. */
  adopt(previous) {
    const source = new Map();
    previous.model.chunks.forEach((spec, index) =>
      source.set(`${spec.section}:${spec.localIndex}`, previous.chunks[index]),
    );
    const carried = this.model.chunks.map((spec, index) => {
      const from = source.get(`${spec.section}:${spec.localIndex}`);
      if (!from) return false;
      const chunk = this.chunks[index];
      chunk.x = from.x;
      chunk.y = from.y;
      chunk.px = from.px;
      chunk.py = from.py;
      chunk.dx = from.dx;
      chunk.dy = from.dy;
      chunk.idle = from.idle;
      chunk.gain = from.gain;
      return true;
    });
    for (let index = 0; index < this.chunks.length; index++) {
      if (carried[index]) continue;
      let before = index - 1;
      while (before >= 0 && !carried[before]) before--;
      let after = index + 1;
      while (after < this.chunks.length && !carried[after]) after++;
      const chunk = this.chunks[index];
      if (before >= 0 && after < this.chunks.length) {
        const start = this.chunks[before];
        const end = this.chunks[after];
        const along = (index - before) / (after - before);
        chunk.x = start.x + (end.x - start.x) * along;
        chunk.y = start.y + (end.y - start.y) * along;
        chunk.px = start.px + (end.px - start.px) * along;
        chunk.py = start.py + (end.py - start.py) * along;
        chunk.dx = start.dx;
        chunk.dy = start.dy;
      } else {
        /* dx points headward, so a chunk added past the tail extends the
           other way. A chunk that did not exist carries no velocity. */
        const anchorIndex = before >= 0 ? before : after;
        const anchor = this.chunks[anchorIndex];
        const heading = before >= 0 ? -1 : 1;
        const link = this.model.links[before >= 0 ? index - 1 : index];
        const reach =
          (link ? link.restLength : 0) * Math.abs(index - anchorIndex);
        chunk.x = anchor.x + anchor.dx * heading * reach;
        chunk.y = anchor.y + anchor.dy * heading * reach;
        chunk.px = chunk.x;
        chunk.py = chunk.y;
        chunk.dx = anchor.dx;
        chunk.dy = anchor.dy;
      }
      chunk.idle = 0;
      chunk.gain = 0;
    }
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
    const last = this.chunks.length - 1;
    let axisX = 0;
    let axisY = 0;
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      const ahead = this.chunks[Math.max(0, index - 1)];
      const behind = this.chunks[Math.min(last, index + 1)];
      const x = ahead.x - behind.x;
      const y = ahead.y - behind.y;
      const tangentLength = magnitude(x, y);
      if (tangentLength >= 1e-9) {
        chunk.dx = x / tangentLength;
        chunk.dy = y / tangentLength;
      }
      axisX += chunk.x - chunk.px;
      axisY += chunk.y - chunk.py;
    }
    const axisLength = magnitude(axisX, axisY);
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
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      const spec = this.model.chunks[index];
      const retention = this.retention[index];
      const velocityX = (chunk.x - chunk.px) * retention;
      const velocityY = (chunk.y - chunk.py) * retention;
      chunk.px = chunk.x;
      chunk.py = chunk.y;
      chunk.x += velocityX;
      chunk.y += velocityY;

      const grip = spec.material.grip;
      const x = chunk.x - chunk.px;
      const y = chunk.y - chunk.py;
      const along = x * chunk.dx + y * chunk.dy;
      const lateral = x * -chunk.dy + y * chunk.dx;
      chunk.gaitContact = this.gait.contactAt(
        spec.restDistance,
        throttle,
        spec.motionScale.contact,
      );
      const contact = Math.max(
        0,
        Math.min(
          1,
          chunk.gaitContact *
            (1 - this.model.physics.autoLift.amount * chunk.idle * throttle),
        ),
      );
      chunk.contact = contact;
      const retainedAlong =
        along * (1 - contact * (along < 0 ? grip.backward : grip.forward));
      const retainedLateral = lateral * (1 - contact * grip.lateral);
      chunk.x =
        chunk.px + chunk.dx * retainedAlong - chunk.dy * retainedLateral;
      chunk.y =
        chunk.py + chunk.dy * retainedAlong + chunk.dx * retainedLateral;
      chunk.gain = -(
        (along - retainedAlong) *
          (chunk.dx * this.axis.x + chunk.dy * this.axis.y) +
        (lateral - retainedLateral) *
          (-chunk.dy * this.axis.x + chunk.dx * this.axis.y)
      );

      const acceleration = this.gait.thrustAt(
        spec.restDistance,
        throttle,
        spec.motionScale.thrust,
      );
      chunk.x += chunk.dx * acceleration * dtSquared;
      chunk.y += chunk.dy * acceleration * dtSquared;
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
    for (let index = 1; index < this.chunks.length - 1; index++) {
      const before = this.chunks[index - 1];
      const chunk = this.chunks[index];
      const after = this.chunks[index + 1];
      const ax = chunk.x - before.x;
      const ay = chunk.y - before.y;
      const bx = after.x - chunk.x;
      const by = after.y - chunk.y;
      const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      const spec = this.model.chunks[index];
      const bend =
        channel.amplitude *
        spec.motionScale.bend *
        throttle *
        (phaseSine * spec.bendPhaseCosine + phaseCosine * spec.bendPhaseSine);
      const target = (bend + bias * throttle) * spec.bendScale;
      const correction = (target - turn) * spec.material.jointCorrection * 0.5;
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
    }
  }

  _updateLinkTargets(throttle) {
    const channel = this.model.gait.gather;
    const phase = channel.harmonic * this.gait.phase;
    const phaseSine = Math.sin(phase);
    const phaseCosine = Math.cos(phase);
    for (let index = 0; index < this.model.links.length; index++) {
      const link = this.model.links[index];
      const wave =
        phaseCosine * link.gatherPhaseCosine - phaseSine * link.gatherPhaseSine;
      const gather = 1 + channel.amplitude * link.gatherScale * throttle * wave;
      const breathing = 1 + (link.breathingScale ? this.breathingScale : 0);
      this.linkTargets[index] = link.restLength * gather * breathing;
    }
  }

  _relaxLinks() {
    for (let index = 0; index < this.model.links.length; index++) {
      const link = this.model.links[index];
      const before = this.chunks[link.from];
      const after = this.chunks[link.to];
      const x = after.x - before.x;
      const y = after.y - before.y;
      const distance = magnitude(x, y) || 0.001;
      const shift =
        ((distance - this.linkTargets[index]) / distance) *
        0.5 *
        link.linkCorrection;
      before.x += x * shift;
      before.y += y * shift;
      after.x -= x * shift;
      after.y -= y * shift;
    }
  }

  /* Link k joins chunks k and k+1, so a head-to-tail sweep that moves only
     the trailing chunk settles every link in one pass: the link just fixed
     cannot be disturbed by the next one. Holding the head still also keeps
     a clamped chain's reported pose where the host last saw it. */
  _clampLinks() {
    for (let index = 0; index < this.model.links.length; index++) {
      const limit = this.linkTargets[index] * MAX_LINK_STRETCH;
      const link = this.model.links[index];
      const before = this.chunks[link.from];
      const after = this.chunks[link.to];
      const x = after.x - before.x;
      const y = after.y - before.y;
      const distance = magnitude(x, y);
      if (distance <= limit) continue;
      const scale = limit / distance;
      after.x = before.x + x * scale;
      after.y = before.y + y * scale;
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
