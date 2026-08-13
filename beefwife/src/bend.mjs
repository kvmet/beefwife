/**
 * The chain's angular constraint. One joint on its own reaches the turn it is
 * asked for exactly, but a chain of them barely bends: each joint pushes its
 * outer chunks one way and its middle the other, so a smooth run of targets
 * makes a smooth displacement field, and a joint angle is the second
 * difference of that field. Sweeping wider spans first gives the solver a
 * curvature a single joint cannot see, and the single joints then finish.
 *
 * Nothing here is state between substeps. The arrays are scratch, sized once
 * so a substep allocates nothing.
 */

/* A span pivots its two halves rigidly, so its reach and its lever arm grow
   together. Two chunks either side is where that stops paying: at four,
   `undulating` goes from 19% link error to 98% and loses the wave it was
   tracking. */
const MAX_BEND_SPAN = 2;

class Bend {
  constructor(count) {
    /* The turn each joint was last asked for, and the pose those turns
       describe, walked out so any span's wanted angle can be measured off it
       rather than estimated from the turns. */
    this.targets = new Float64Array(count);
    this.wantedX = new Float64Array(count);
    this.wantedY = new Float64Array(count);
    this.spanX = new Float64Array(count);
    this.spanY = new Float64Array(count);
  }

  /* The shipped gaits ask for up to 48 degrees at a joint, far past where a
     span's angle could be read off the summed headings, so the shape those
     turns describe is walked out in full. */
  update(model, gait, tables, restLengths, throttle, bias) {
    const channel = model.gait.bend;
    const phase = channel.harmonic * gait.phase;
    const phaseSine = Math.sin(phase);
    const phaseCosine = Math.cos(phase);
    const amplitude = channel.amplitude;
    const biasThrottle = bias * throttle;
    const { motionBend, bendPhaseSine, bendPhaseCosine, bendScale } = tables;
    const targets = this.targets;
    const wantedX = this.wantedX;
    const wantedY = this.wantedY;
    const last = targets.length - 1;
    let heading = 0;
    wantedX[0] = 0;
    wantedY[0] = 0;
    for (let index = 0; index < last; index++) {
      if (index > 0) {
        const bend =
          amplitude *
          motionBend[index] *
          throttle *
          (phaseSine * bendPhaseCosine[index] +
            phaseCosine * bendPhaseSine[index]);
        targets[index] = (bend + biasThrottle) * bendScale[index];
        heading += targets[index];
      }
      wantedX[index + 1] =
        wantedX[index] + Math.cos(heading) * restLengths[index];
      wantedY[index + 1] =
        wantedY[index] + Math.sin(heading) * restLengths[index];
    }
  }

  relax(chain, jointCorrectionHalf) {
    for (
      let span = Math.min(MAX_BEND_SPAN, chain.count >> 2);
      span >= 1;
      span >>= 1
    )
      this.relaxSpan(chain, jointCorrectionHalf, span);
  }

  relaxSpan(chain, jointCorrectionHalf, span) {
    const count = chain.count;
    const chunkX = chain.x;
    const chunkY = chain.y;
    const wantedX = this.wantedX;
    const wantedY = this.wantedY;
    const nextX = this.spanX;
    const nextY = this.spanY;
    for (let pivot = span; pivot + span < count; pivot += span) {
      const from = pivot - span;
      const to = pivot + span;
      const pivotX = chunkX[pivot];
      const pivotY = chunkY[pivot];
      const ax = pivotX - chunkX[from];
      const ay = pivotY - chunkY[from];
      const bx = chunkX[to] - pivotX;
      const by = chunkY[to] - pivotY;
      const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      const wx = wantedX[pivot] - wantedX[from];
      const wy = wantedY[pivot] - wantedY[from];
      const vx = wantedX[to] - wantedX[pivot];
      const vy = wantedY[to] - wantedY[pivot];
      const target = Math.atan2(wx * vy - wy * vx, wx * vx + wy * vy);
      const correction = (target - turn) * jointCorrectionHalf[pivot];
      const cosine = Math.cos(correction);
      const sine = Math.sin(correction);
      /* Each half turns about the pivot, so no rest length inside the span
         changes and only the two links at its ends are left to the passes. */
      for (let index = from; index <= to; index++) {
        const x = chunkX[index] - pivotX;
        const y = chunkY[index] - pivotY;
        const away = index < pivot ? -sine : sine;
        nextX[index] = pivotX + x * cosine - y * away;
        nextY[index] = pivotY + x * away + y * cosine;
      }
      /* Turning the two halves opposite ways still leaves the span as a whole
         drifting and spinning, and a span is a lever long enough to throw the
         creature across the world. Take both back out. */
      const width = to - from + 1;
      let driftX = 0;
      let driftY = 0;
      let centerX = 0;
      let centerY = 0;
      for (let index = from; index <= to; index++) {
        driftX += nextX[index] - chunkX[index];
        driftY += nextY[index] - chunkY[index];
        centerX += chunkX[index];
        centerY += chunkY[index];
      }
      driftX /= width;
      driftY /= width;
      centerX /= width;
      centerY /= width;
      let moment = 0;
      let inertia = 0;
      for (let index = from; index <= to; index++) {
        const rx = chunkX[index] - centerX;
        const ry = chunkY[index] - centerY;
        moment +=
          rx * (nextY[index] - chunkY[index] - driftY) -
          ry * (nextX[index] - chunkX[index] - driftX);
        inertia += rx * rx + ry * ry;
      }
      const spin = inertia > 1e-12 ? moment / inertia : 0;
      for (let index = from; index <= to; index++) {
        const rx = chunkX[index] - centerX;
        const ry = chunkY[index] - centerY;
        chunkX[index] = nextX[index] - driftX + spin * ry;
        chunkY[index] = nextY[index] - driftY - spin * rx;
      }
    }
  }

  /* What the gait asked each joint for last substep against the turn it is
     actually making. Read on demand: nothing is accumulated, so a caller
     wanting an average over a cycle has to take its own samples. */
  response(chain, into = []) {
    const targets = this.targets;
    const { x, y, count } = chain;
    into.length = 0;
    for (let index = 1; index < count - 1; index++) {
      const ax = x[index] - x[index - 1];
      const ay = y[index] - y[index - 1];
      const bx = x[index + 1] - x[index];
      const by = y[index + 1] - y[index];
      into.push({
        joint: index,
        commanded: targets[index],
        delivered: Math.atan2(ax * by - ay * bx, ax * bx + ay * by),
      });
    }
    return into;
  }
}

export { Bend, MAX_BEND_SPAN };
