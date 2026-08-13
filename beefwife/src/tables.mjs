/**
 * The model, flattened for the solver. Every per-chunk and per-link constant
 * a substep reads, unpacked from the model's nested records into parallel
 * typed arrays: the substep runs over every chunk many times a second, and a
 * frozen `spec.material.grip.forward` is four loads where an array index is
 * one. Nothing here is state; rebuilding it from the same model, gait and
 * substep gives the same numbers.
 */

/* Grip and jointCorrection take a share of the gap once a substep, and
   linkCorrection takes one once a relaxation pass, so what a descriptor's
   number means depends on how often it is applied. These are the rates it
   means it at: they define the shares, and deliberately do not read the
   solver's own constants. Deriving them from PHYSICS_STEP would cancel out
   and leave the substep rate changing how far every creature travels, which
   is the thing this exists to stop. Change these only to redefine what every
   shipped descriptor's grip means. */
const REFERENCE_SUBSTEP_RATE = 60;
const REFERENCE_LINK_SOLVE_RATE = 480;

/* Shares compound, so matching a second of them is a power, not a product.
   The endpoints are held exactly: 0 never corrects and 1 closes in one go
   however often that is. */
const shareAtRate = (share, rate, referenceRate) => {
  /* Running at the rate the share is stated at hands it back untouched.
     Rescaling would round-trip it through 1 - (1 - share), which does not
     land back on the number the descriptor wrote. */
  if (rate === referenceRate) return share;
  if (!(share > 0)) return 0;
  if (share >= 1) return 1;
  return 1 - Math.pow(1 - share, referenceRate / rate);
};

class ChainTables {
  constructor(model, gait, substep, relaxPasses) {
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
    this.refresh(model, gait, substep, relaxPasses);
  }

  /* Reconfiguring holds the chunk count, so the arrays outlive any model the
     same body can be handed and only their contents are rewritten. */
  refresh(model, gait, substep, relaxPasses) {
    const lag = gait.phaseLagRadiansPerPixel;
    const substepRate = 1 / substep;
    const linkSolveRate = relaxPasses / substep;
    const perSubstep = (share) =>
      shareAtRate(share, substepRate, REFERENCE_SUBSTEP_RATE);
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
      this.gripForward[index] = perSubstep(grip.forward);
      this.gripBackward[index] = perSubstep(grip.backward);
      this.gripLateral[index] = perSubstep(grip.lateral);
      this.motionThrust[index] = spec.motionScale.thrust;
      this.motionContact[index] = spec.motionScale.contact;
      this.motionBend[index] = spec.motionScale.bend;
      this.bendScale[index] = spec.bendScale;
      this.bendPhaseSine[index] = spec.bendPhaseSine;
      this.bendPhaseCosine[index] = spec.bendPhaseCosine;
      /* Halved because both ends of the joint move, so the pair closes the
         share between them. */
      this.jointCorrectionHalf[index] =
        perSubstep(spec.material.jointCorrection) * 0.5;
      this.phaseLag[index] = spec.restDistance * lag;
    }
    for (let index = 0; index < model.links.length; index++) {
      const link = model.links[index];
      this.linkRestLength[index] = link.restLength;
      this.linkCorrectionHalf[index] =
        shareAtRate(
          link.linkCorrection,
          linkSolveRate,
          REFERENCE_LINK_SOLVE_RATE,
        ) * 0.5;
      this.gatherScale[index] = link.gatherScale;
      this.gatherPhaseSine[index] = link.gatherPhaseSine;
      this.gatherPhaseCosine[index] = link.gatherPhaseCosine;
      this.linkBreathes[index] = link.breathingScale ? 1 : 0;
    }
  }
}

export { ChainTables };
