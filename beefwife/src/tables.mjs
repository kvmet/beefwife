/**
 * The model, flattened for the solver. Every per-chunk and per-link constant
 * a substep reads, unpacked from the model's nested records into parallel
 * typed arrays: the substep runs over every chunk many times a second, and a
 * frozen `spec.material.grip.forward` is four loads where an array index is
 * one. Nothing here is state; rebuilding it from the same model, gait and
 * substep gives the same numbers.
 */

class ChainTables {
  constructor(model, gait, substep) {
    const count = model.chunks.length;
    const linkCount = model.links.length;
    this.retention = new Float64Array(count);
    this.gripForward = new Float64Array(count);
    this.gripBackward = new Float64Array(count);
    this.gripLateral = new Float64Array(count);
    this.motionThrust = new Float64Array(count);
    this.motionContact = new Float64Array(count);
    this.motionBend = new Float64Array(count);
    this.bendScale = new Float64Array(count);
    this.bendPhaseSine = new Float64Array(count);
    this.bendPhaseCosine = new Float64Array(count);
    this.jointCorrectionHalf = new Float64Array(count);
    this.phaseLag = new Float64Array(count);
    this.linkRestLength = new Float64Array(linkCount);
    this.linkCorrectionHalf = new Float64Array(linkCount);
    this.gatherScale = new Float64Array(linkCount);
    this.gatherPhaseSine = new Float64Array(linkCount);
    this.gatherPhaseCosine = new Float64Array(linkCount);
    this.linkBreathes = new Uint8Array(linkCount);
    this.refresh(model, gait, substep);
  }

  /* Reconfiguring holds the chunk count, so the arrays outlive any model the
     same body can be handed and only their contents are rewritten. */
  refresh(model, gait, substep) {
    const lag = gait.phaseLagRadiansPerPixel;
    for (let index = 0; index < model.chunks.length; index++) {
      const spec = model.chunks[index];
      const grip = spec.material.grip;
      /* velocityRetention is per second; the substep factor is its dt power.
         pow keeps the endpoints exact: 0 stops in one step, 1 is
         frictionless. */
      this.retention[index] = Math.pow(
        spec.material.velocityRetention,
        substep,
      );
      this.gripForward[index] = grip.forward;
      this.gripBackward[index] = grip.backward;
      this.gripLateral[index] = grip.lateral;
      this.motionThrust[index] = spec.motionScale.thrust;
      this.motionContact[index] = spec.motionScale.contact;
      this.motionBend[index] = spec.motionScale.bend;
      this.bendScale[index] = spec.bendScale;
      this.bendPhaseSine[index] = spec.bendPhaseSine;
      this.bendPhaseCosine[index] = spec.bendPhaseCosine;
      this.jointCorrectionHalf[index] = spec.material.jointCorrection * 0.5;
      this.phaseLag[index] = spec.restDistance * lag;
    }
    for (let index = 0; index < model.links.length; index++) {
      const link = model.links[index];
      this.linkRestLength[index] = link.restLength;
      this.linkCorrectionHalf[index] = link.linkCorrection * 0.5;
      this.gatherScale[index] = link.gatherScale;
      this.gatherPhaseSine[index] = link.gatherPhaseSine;
      this.gatherPhaseCosine[index] = link.gatherPhaseCosine;
      this.linkBreathes[index] = link.breathingScale ? 1 : 0;
    }
  }
}

export { ChainTables };
