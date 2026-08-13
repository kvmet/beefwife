/** Vertex math and pixel snapping for a Beefwife's meshes and outlines. */

/* A limb is one closed outline, wound hip, knee, foot down one side and foot,
   knee, hip back up the other. Both halves take the knee from one position,
   so they cannot part company there.

   The knee is the same count of points on both sides so one index list fits
   every pose: the outside of the bend sweeps them as an arc, the inside
   stacks them all on its one corner. Four segments hold the widest limb in
   the fixtures within 0.36px of a true arc at a full fold, under the pixel
   the vertices snap to. */
const KNEE_SEGMENTS = 4;
const KNEE_POINTS = KNEE_SEGMENTS + 1;
const LIMB_SIDE_POINTS = KNEE_POINTS + 2;
const LIMB_VERTICES = LIMB_SIDE_POINTS * 2;
const LIMB_FLOATS = LIMB_VERTICES * 2;

/* Both sides run head to foot, so the second one is read backwards and the
   strip between them is a quad per step. */
const limbIndicesFor = (legCount) => {
  const quads = LIMB_SIDE_POINTS - 1;
  const indices = new Uint32Array(legCount * quads * 6);
  let at = 0;
  for (let leg = 0; leg < legCount; leg++) {
    const first = leg * LIMB_VERTICES;
    const last = first + LIMB_VERTICES - 1;
    for (let step = 0; step < quads; step++) {
      const down = first + step;
      const back = last - step;
      indices.set([down, back, down + 1, down + 1, back, back - 1], at);
      at += 6;
    }
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
  /* Inside the bend the two offset edges cross, and that crossing is the
     armpit: a real corner of the shape, however far out it lands. It stops
     being one once it passes the end of a bone, where it leaves the limb
     altogether and would draw a spike over open ground. A leg folded flat
     has no crossing at all and keeps the thigh's offset. */
  const spread = 1 + thighNormalX * shinNormalX + thighNormalY * shinNormalY;
  let cornerX = thighNormalX;
  let cornerY = thighNormalY;
  if (spread > 1e-6) {
    cornerX = (thighNormalX + shinNormalX) / spread;
    cornerY = (thighNormalY + shinNormalY) / spread;
    /* The corner leans back along the thigh by as much as it leans on down
       the shin, so one measurement answers for both bones. Folding the other
       way puts the same lean on the other side of the knee and so signs the
       projection the other way, while the length that outruns the bone is the
       same either way: the magnitude is what the bone has to hold. */
    const along = Math.abs(
      ((cornerX * thighX + cornerY * thighY) / thighLength) * half,
    );
    const bone = Math.min(thighLength, shinLength);
    if (along > bone) {
      cornerX = (cornerX * bone) / along;
      cornerY = (cornerY * bone) / along;
    }
  }
  /* Outside the bend the offset turns through the same angle the bones do,
     one segment at a time, every point of it half a width from the knee. The
     normals turn with the bones, so which side that is comes off the same
     sign. */
  const sweep = Math.atan2(
    thighNormalX * shinNormalY - thighNormalY * shinNormalX,
    thighNormalX * shinNormalX + thighNormalY * shinNormalY,
  );
  const stepCosine = Math.cos(sweep / KNEE_SEGMENTS);
  const stepSine = Math.sin(sweep / KNEE_SEGMENTS);
  const arcLeads = sweep <= 0;
  let arcX = thighNormalX;
  let arcY = thighNormalY;
  const footAt = offset + (KNEE_POINTS + 1) * 2;
  const heelAt = offset + LIMB_FLOATS - 2;
  positions[offset] = hipX + thighNormalX * half;
  positions[offset + 1] = hipY + thighNormalY * half;
  positions[footAt] = footX + shinNormalX * half;
  positions[footAt + 1] = footY + shinNormalY * half;
  positions[footAt + 2] = footX - shinNormalX * half;
  positions[footAt + 3] = footY - shinNormalY * half;
  positions[heelAt] = hipX - thighNormalX * half;
  positions[heelAt + 1] = hipY - thighNormalY * half;
  for (let step = 0; step < KNEE_POINTS; step++) {
    const leadX = arcLeads ? arcX : cornerX;
    const leadY = arcLeads ? arcY : cornerY;
    const trailX = arcLeads ? cornerX : arcX;
    const trailY = arcLeads ? cornerY : arcY;
    const leadAt = offset + (1 + step) * 2;
    // The second side meets the first one turn for turn, read backwards.
    const trailAt = offset + (2 * KNEE_POINTS + 2 - step) * 2;
    positions[leadAt] = kneeX + leadX * half;
    positions[leadAt + 1] = kneeY + leadY * half;
    positions[trailAt] = kneeX - trailX * half;
    positions[trailAt + 1] = kneeY - trailY * half;
    const turnedX = arcX * stepCosine - arcY * stepSine;
    arcY = arcX * stepSine + arcY * stepCosine;
    arcX = turnedX;
  }
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
  KNEE_POINTS,
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
