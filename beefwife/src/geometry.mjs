/** Vertex math and pixel snapping for a Beefwife's meshes and outlines. */

/* A limb is one closed outline, wound down one side and back up the other:
   hip, knee, foot, foot, knee, hip. Both halves share each knee vertex, so
   they cannot part company there. */
const LIMB_VERTICES = 6;
const LIMB_FLOATS = LIMB_VERTICES * 2;

const limbIndicesFor = (legCount) => {
  const indices = new Uint32Array(legCount * 12);
  for (let leg = 0; leg < legCount; leg++) {
    const vertex = leg * LIMB_VERTICES;
    indices.set(
      [
        vertex,
        vertex + 5,
        vertex + 1,
        vertex + 1,
        vertex + 5,
        vertex + 4,
        vertex + 1,
        vertex + 4,
        vertex + 2,
        vertex + 2,
        vertex + 4,
        vertex + 3,
      ],
      leg * 12,
    );
  }
  return indices;
};

/* Each end of the ribbon closes with a half turn of rim points fanned from
   a hub at the chunk. Twelve segments hold a 20px cap within a third of a
   pixel of a true arc. */
const CAP_SEGMENTS = 12;
const CAP_VERTICES = CAP_SEGMENTS + 2;
const CAP_COSINE = new Float64Array(CAP_SEGMENTS + 1);
const CAP_SINE = new Float64Array(CAP_SEGMENTS + 1);
for (let step = 0; step <= CAP_SEGMENTS; step++) {
  const angle = (Math.PI * step) / CAP_SEGMENTS;
  CAP_COSINE[step] = Math.cos(angle);
  CAP_SINE[step] = Math.sin(angle);
}

const ribbonPositionsFor = (chunkCount) =>
  new Float32Array((chunkCount * 2 + CAP_VERTICES * 2) * 2);

const ribbonIndicesFor = (chunkCount) => {
  const quads = Math.max(0, chunkCount - 1);
  const indices = new Uint32Array(quads * 6 + CAP_SEGMENTS * 6);
  let at = 0;
  for (let chunk = 0; chunk < quads; chunk++) {
    const vertex = chunk * 2;
    indices.set(
      [vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3],
      at,
    );
    at += 6;
  }
  for (const hub of [chunkCount * 2, chunkCount * 2 + CAP_VERTICES]) {
    for (let step = 0; step < CAP_SEGMENTS; step++) {
      indices.set([hub, hub + 1 + step, hub + 2 + step], at);
      at += 3;
    }
  }
  return indices;
};

const snapCoordinate = (value, pixelResolution, inversePixelResolution) =>
  pixelResolution === 1
    ? Math.round(value)
    : pixelResolution > 0
      ? Math.round(value * pixelResolution) * inversePixelResolution
      : value;

const snapPositions = (
  positions,
  start,
  end,
  pixelResolution,
  inversePixelResolution,
) => {
  if (pixelResolution === 1)
    for (let index = start; index < end; index++)
      positions[index] = Math.round(positions[index]);
  else if (pixelResolution > 0)
    for (let index = start; index < end; index++)
      positions[index] =
        Math.round(positions[index] * pixelResolution) * inversePixelResolution;
};

/* Sweeps the rim a half turn from `fromX,fromY` through `overX,overY` to the
   opposite of `from`, so its two ends land on the ribbon's own edge vertices.
   Both directions are unit and perpendicular. */
const writeCap = (
  positions,
  offset,
  x,
  y,
  radius,
  fromX,
  fromY,
  overX,
  overY,
  pixelResolution,
  inversePixelResolution,
) => {
  positions[offset] = x;
  positions[offset + 1] = y;
  for (let step = 0; step <= CAP_SEGMENTS; step++) {
    const at = offset + 2 + step * 2;
    const cosine = CAP_COSINE[step];
    const sine = CAP_SINE[step];
    positions[at] = x + radius * (cosine * fromX + sine * overX);
    positions[at + 1] = y + radius * (cosine * fromY + sine * overY);
  }
  snapPositions(
    positions,
    offset,
    offset + CAP_VERTICES * 2,
    pixelResolution,
    inversePixelResolution,
  );
};

/* Each side of the outline turns a corner at the knee where its two offset
   edges cross. A leg folded back on itself throws that crossing towards
   infinity, so the reach is capped; the outline stays closed either way. */
const LIMB_CORNER_REACH = 4;

const writeLimb = (
  positions,
  offset,
  hipX,
  hipY,
  kneeX,
  kneeY,
  footX,
  footY,
  width,
  pixelResolution = 0,
  inversePixelResolution = 0,
) => {
  const half = width * 0.5;
  const thighX = kneeX - hipX;
  const thighY = kneeY - hipY;
  const thighLength = Math.hypot(thighX, thighY) || 1;
  const shinX = footX - kneeX;
  const shinY = footY - kneeY;
  const shinLength = Math.hypot(shinX, shinY) || 1;
  const thighNormalX = -thighY / thighLength;
  const thighNormalY = thighX / thighLength;
  const shinNormalX = -shinY / shinLength;
  const shinNormalY = shinX / shinLength;
  const spread = 1 + thighNormalX * shinNormalX + thighNormalY * shinNormalY;
  let cornerX = thighNormalX;
  let cornerY = thighNormalY;
  if (spread > 1e-6) {
    cornerX = (thighNormalX + shinNormalX) / spread;
    cornerY = (thighNormalY + shinNormalY) / spread;
    const reach = Math.hypot(cornerX, cornerY);
    if (reach > LIMB_CORNER_REACH) {
      cornerX = (cornerX / reach) * LIMB_CORNER_REACH;
      cornerY = (cornerY / reach) * LIMB_CORNER_REACH;
    }
  }
  positions[offset] = hipX + thighNormalX * half;
  positions[offset + 1] = hipY + thighNormalY * half;
  positions[offset + 2] = kneeX + cornerX * half;
  positions[offset + 3] = kneeY + cornerY * half;
  positions[offset + 4] = footX + shinNormalX * half;
  positions[offset + 5] = footY + shinNormalY * half;
  positions[offset + 6] = footX - shinNormalX * half;
  positions[offset + 7] = footY - shinNormalY * half;
  positions[offset + 8] = kneeX - cornerX * half;
  positions[offset + 9] = kneeY - cornerY * half;
  positions[offset + 10] = hipX - thighNormalX * half;
  positions[offset + 11] = hipY - thighNormalY * half;
  snapPositions(
    positions,
    offset,
    offset + LIMB_FLOATS,
    pixelResolution,
    inversePixelResolution,
  );
};

export {
  LIMB_FLOATS,
  CAP_SEGMENTS,
  CAP_VERTICES,
  limbIndicesFor,
  ribbonPositionsFor,
  ribbonIndicesFor,
  snapCoordinate,
  snapPositions,
  writeCap,
  writeLimb,
};
