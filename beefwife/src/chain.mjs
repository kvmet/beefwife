/**
 * The chain's mutable state, one typed array per field. The counterpart to
 * ChainTables: that holds what the model says and never changes, this holds
 * what the solver moves. A substep sweeps every chunk several times over, and
 * a run of positions the CPU can prefetch is worth more than a record that
 * keeps each chunk's ten fields together.
 *
 * Also the operations that move or measure the whole chain in the world, which
 * are not solver steps and read nothing but the chain itself.
 */

class ChainState {
  constructor(count) {
    this.count = count;
    this.x = new Float64Array(count);
    this.y = new Float64Array(count);
    this.px = new Float64Array(count);
    this.py = new Float64Array(count);
    this.dx = new Float64Array(count);
    this.dy = new Float64Array(count);
    this.idle = new Float64Array(count);
    this.gain = new Float64Array(count);
    this.gaitContact = new Float64Array(count);
    this.contact = new Float64Array(count);
    this.correction = { x: 0, y: 0 };
    /* A chunk with no tangent is a pose no consumer can use, so an unplaced
       chain points along +x with every chunk down, as a placed one does. */
    this.dx.fill(1);
    this.gaitContact.fill(1);
    this.contact.fill(1);
  }

  translate(offset) {
    const { x, y, px, py, count } = this;
    for (let index = 0; index < count; index++) {
      x[index] += offset.x;
      y[index] += offset.y;
      px[index] += offset.x;
      py[index] += offset.y;
    }
  }

  fitsTranslation(offset, limit) {
    const { x, y, px, py, count } = this;
    const within = (value, shift) => {
      const next = value + shift;
      return Number.isFinite(next) && Math.abs(next) <= limit;
    };
    for (let index = 0; index < count; index++)
      if (
        !within(x[index], offset.x) ||
        !within(y[index], offset.y) ||
        !within(px[index], offset.x) ||
        !within(py[index], offset.y)
      )
        return false;
    return true;
  }

  worldCorrection(limit) {
    const { x, y, px, py, count } = this;
    let minimumX = Infinity;
    let maximumX = -Infinity;
    let minimumY = Infinity;
    let maximumY = -Infinity;
    for (let index = 0; index < count; index++) {
      minimumX = Math.min(minimumX, x[index], px[index]);
      maximumX = Math.max(maximumX, x[index], px[index]);
      minimumY = Math.min(minimumY, y[index], py[index]);
      maximumY = Math.max(maximumY, y[index], py[index]);
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
}

export { ChainState };
