/**
 * Moving chunk state onto a chain whose section counts changed. A chunk the
 * descriptor still names keeps its position and velocity; an added one is
 * seeded from its neighbours. The creature settles from where it was rather
 * than snapping straight, and since head always holds a chunk the new chain
 * always has something to carry from.
 */

const nameOf = (spec) => `${spec.section}:${spec.localIndex}`;
const FIELDS = ["x", "y", "px", "py", "dx", "dy", "idle", "gain"];

/* Writes into `chain` in place and reports nothing: the caller owns the chain
   and carries the whole-body values that are not per chunk. */
const carryChunks = (chain, model, previousChain, previousModel) => {
  const source = new Map();
  previousModel.chunks.forEach((spec, index) =>
    source.set(nameOf(spec), index),
  );
  const carried = model.chunks.map((spec, index) => {
    const from = source.get(nameOf(spec));
    if (from === undefined) return false;
    for (const field of FIELDS)
      chain[field][index] = previousChain[field][from];
    return true;
  });
  const { x, y, px, py, dx, dy, idle, gain, count } = chain;
  for (let index = 0; index < count; index++) {
    if (carried[index]) continue;
    let before = index - 1;
    while (before >= 0 && !carried[before]) before--;
    let after = index + 1;
    while (after < count && !carried[after]) after++;
    if (before >= 0 && after < count) {
      const along = (index - before) / (after - before);
      x[index] = x[before] + (x[after] - x[before]) * along;
      y[index] = y[before] + (y[after] - y[before]) * along;
      px[index] = px[before] + (px[after] - px[before]) * along;
      py[index] = py[before] + (py[after] - py[before]) * along;
      dx[index] = dx[before];
      dy[index] = dy[before];
    } else {
      /* dx points headward, so a chunk added past the tail extends the other
         way. A chunk that did not exist carries no velocity. */
      const anchor = before >= 0 ? before : after;
      const heading = before >= 0 ? -1 : 1;
      const link = model.links[before >= 0 ? index - 1 : index];
      const reach = (link ? link.restLength : 0) * Math.abs(index - anchor);
      x[index] = x[anchor] + dx[anchor] * heading * reach;
      y[index] = y[anchor] + dy[anchor] * heading * reach;
      px[index] = x[index];
      py[index] = y[index];
      dx[index] = dx[anchor];
      dy[index] = dy[anchor];
    }
    idle[index] = 0;
    gain[index] = 0;
  }
};

export { carryChunks };
