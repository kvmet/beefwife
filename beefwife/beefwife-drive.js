/** Schema-v1 gait clock and spatial channels. Private to the Beefwife runtime. */

const BeefwifeGait = (() => {
  const TAU = Math.PI * 2;

  const positiveModulo = (value, divisor) =>
    ((value % divisor) + divisor) % divisor;

  class BeefwifeGait {
    constructor(gait, phase = 0) {
      this.gait = gait;
      this.phase = positiveModulo(phase, TAU);
    }

    advance(dt, throttle) {
      this.phase = positiveModulo(
        this.phase + TAU * this.gait.cyclesPerSecond * throttle * dt,
        TAU,
      );
    }

    _phaseAt(distance, channel, phaseOffset = 0) {
      return (
        channel.harmonic *
          (this.phase - distance * this.gait.phaseLagRadiansPerPixel) +
        channel.phaseOffset +
        phaseOffset
      );
    }

    _pulseAt(distance, channel, phaseOffset = 0) {
      const cycle =
        positiveModulo(this._phaseAt(distance, channel, phaseOffset), TAU) /
        TAU;
      if (cycle >= channel.dutyCycle) return 0;
      return Math.sin((Math.PI * cycle) / channel.dutyCycle);
    }

    bendAt(distance, throttle, scale) {
      const channel = this.gait.bend;
      return (
        channel.amplitude *
        scale *
        throttle *
        Math.sin(this._phaseAt(distance, channel))
      );
    }

    thrustAt(distance, throttle, scale) {
      const channel = this.gait.thrust;
      return (
        channel.acceleration *
        scale *
        throttle *
        this._pulseAt(distance, channel)
      );
    }

    restAt(distance, throttle, scale) {
      const channel = this.gait.gather;
      return (
        1 +
        channel.amplitude *
          scale *
          throttle *
          Math.cos(this._phaseAt(distance, channel))
      );
    }

    contactAt(distance, throttle, scale, phaseOffset = 0) {
      const channel = this.gait.contact;
      return (
        1 -
        channel.lift *
          scale *
          throttle *
          this._pulseAt(distance, channel, phaseOffset)
      );
    }
  }

  return BeefwifeGait;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BeefwifeGait };
}
