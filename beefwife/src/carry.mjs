/**
 * Moving chunk state onto a chain whose section counts changed. A chunk the
 * descriptor still names keeps its position and velocity; an added one is
 * seeded from its neighbours. The creature settles from where it was rather
 * than snapping straight, and since head always holds a chunk the new chain
 * always has something to carry from.
 */

const nameOf = (spec) => `${spec.section}:${spec.localIndex}`;

/* Writes into `chunks` in place and reports nothing: the caller owns the
   chain and carries the whole-body values that are not per chunk. */
const carryChunks = (chunks, model, previousChunks, previousModel) => {
  const source = new Map();
  previousModel.chunks.forEach((spec, index) =>
    source.set(nameOf(spec), previousChunks[index]),
  );
  const carried = model.chunks.map((spec, index) => {
    const from = source.get(nameOf(spec));
    if (!from) return false;
    const chunk = chunks[index];
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
  for (let index = 0; index < chunks.length; index++) {
    if (carried[index]) continue;
    let before = index - 1;
    while (before >= 0 && !carried[before]) before--;
    let after = index + 1;
    while (after < chunks.length && !carried[after]) after++;
    const chunk = chunks[index];
    if (before >= 0 && after < chunks.length) {
      const start = chunks[before];
      const end = chunks[after];
      const along = (index - before) / (after - before);
      chunk.x = start.x + (end.x - start.x) * along;
      chunk.y = start.y + (end.y - start.y) * along;
      chunk.px = start.px + (end.px - start.px) * along;
      chunk.py = start.py + (end.py - start.py) * along;
      chunk.dx = start.dx;
      chunk.dy = start.dy;
    } else {
      /* dx points headward, so a chunk added past the tail extends the other
         way. A chunk that did not exist carries no velocity. */
      const anchorIndex = before >= 0 ? before : after;
      const anchor = chunks[anchorIndex];
      const heading = before >= 0 ? -1 : 1;
      const link = model.links[before >= 0 ? index - 1 : index];
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
};

export { carryChunks };
