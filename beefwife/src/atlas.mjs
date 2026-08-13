/**
 * One texture holding every shape a Beefwife places, so its feet, plates and
 * ornaments draw as particles out of a shared frame instead of a Graphics
 * apiece. The work splits three ways: a plan names the frames from the
 * descriptor alone, packing measures and places them, and only the bake needs
 * a GPU. Naming is what a population repeats, so it is the step kept free of
 * the other two.
 */

import { PIXI } from "./pixi.mjs";
import { contextFor } from "./display.mjs";

/* A particle samples its frame where a Graphics rasterises its path afresh,
   so a frame carrying one texel per drawn pixel loses the silhouette as soon
   as it turns. Four holds it; the frames are tens of texels across, so the
   texture stays small either way. */
const BAKE_SUPERSAMPLE = 4;
/* A context's bounds already carry half a stroke width, and a miter reaches
   past that on a sharp enough corner, so a whole width is left around the
   drawn shape. The one texel floor keeps an unstroked frame off its
   neighbour. */
const PAD_STROKES = 1;
const MIN_PAD_TEXELS = 1;
const ATLAS_TEXEL_LIMIT = 2048;

/* Every creature compiles its own model, so shapes and paints sharing a value
   are separate objects. Frames are named by what they draw, which is what
   makes one bake serve a whole population. */
const frameKeyFor = (shape, paint, scale) =>
  `${shape.path}|${paint.fill}|${paint.stroke}|${paint.strokeWidth}|${scale}`;

const baked = new WeakMap();

/**
 * Names the frames a model needs, and nothing else. Measuring a frame means
 * building its context, which is most of what an atlas costs, so a plan holds
 * none: a population plans once per creature but bakes once in total, and the
 * creatures that find the bake already done never pay for the measurement.
 */
const planAtlas = (model, renderResolution) => {
  const resolution = renderResolution * BAKE_SUPERSAMPLE;
  const specs = new Map();
  /* Frames are baked at the largest a part ever draws, so a live particle
     only ever scales down and never magnifies its own texels. */
  const claim = (shape, paint, scale) => {
    // A plate profiled down to nothing draws nothing, and needs no frame.
    if (!(scale > 0)) return null;
    const key = frameKeyFor(shape, paint, scale);
    if (!specs.has(key)) specs.set(key, { key, shape, paint, scale });
    return key;
  };

  const foot = model.legs.skin.foot;
  // A creature with no pairs stands on nothing and needs no foot frame.
  const feet = model.legs.pairs
    ? claim(foot.shape, foot.paint, foot.scale * Math.max(1, foot.plantedScale))
    : null;
  /* Contact runs 0 to 1, so a plate is largest at whichever end of the load
     the descriptor's sign puts it. An ornament holds one scale for life. */
  const load = 1 + Math.max(0, model.skin.loadScale);
  const plates = model.skin.platesTailFirst.map((plate) =>
    claim(
      plate.shape,
      plate.paint,
      plate.scale * model.chunks[plate.chunk].plateScale * load,
    ),
  );
  const ornaments = model.skin.ornaments.map((ornament) =>
    claim(ornament.shape, ornament.paint, ornament.scale),
  );

  return {
    /* Sorted, so two models that name the same frames in a different order
       still share one bake. */
    key: `${resolution}\n${[...specs.keys()].sort().join("\n")}`,
    resolution,
    frames: [...specs.values()],
    feet,
    plates,
    ornaments,
  };
};

/**
 * Measures each frame and lays the sheet out. The entries come back carrying
 * a live context apiece, which the bake draws and then destroys.
 */
const packAtlas = (plan) => {
  const resolution = plan.resolution;
  const entries = plan.frames.map(({ key, shape, paint, scale }) => {
    const context = contextFor(shape, paint, scale);
    const bounds = context.bounds;
    const pad = Math.max(
      MIN_PAD_TEXELS,
      Math.ceil(paint.strokeWidth * scale * PAD_STROKES * resolution),
    );
    return {
      key,
      scale,
      context,
      pad,
      /* Where the shape's own origin sits inside the frame, rounded out to a
         whole texel so the bake lands on the texture's grid. */
      originX: pad + Math.ceil(-bounds.minX * resolution),
      originY: pad + Math.ceil(-bounds.minY * resolution),
      width: Math.ceil(bounds.width * resolution) + pad * 2,
      height: Math.ceil(bounds.height * resolution) + pad * 2,
    };
  });

  // Shelf packed tallest first, which is enough for a handful of frames.
  entries.sort((a, b) => b.height - a.height);
  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;
  let width = 0;
  for (const entry of entries) {
    if (shelfX > 0 && shelfX + entry.width > ATLAS_TEXEL_LIMIT) {
      shelfX = 0;
      shelfY += shelfHeight;
      shelfHeight = 0;
    }
    entry.x = shelfX;
    entry.y = shelfY;
    shelfX += entry.width;
    shelfHeight = Math.max(shelfHeight, entry.height);
    width = Math.max(width, shelfX);
  }
  const height = shelfY + shelfHeight;

  /* Wrapping bounds the width unless one frame is wider than the whole sheet,
     and nothing bounds the height at all. A texture past what the GPU takes
     comes back blank rather than refused, so say which way it went over. */
  if (width > ATLAS_TEXEL_LIMIT || height > ATLAS_TEXEL_LIMIT) {
    for (const entry of entries) entry.context.destroy();
    throw new RangeError(
      `atlas needs ${width} by ${height} texels at resolution ${resolution}, past the ${ATLAS_TEXEL_LIMIT} limit`,
    );
  }

  return { resolution, width, height, entries };
};

const bakeAtlas = (plan, renderer) => {
  const sheet = packAtlas(plan);
  const texel = 1 / sheet.resolution;
  const target = PIXI.RenderTexture.create({
    width: sheet.width * texel,
    height: sheet.height * texel,
    resolution: sheet.resolution,
    antialias: false,
    scaleMode: "nearest",
  });
  const frames = new Map();
  let clear = true;
  for (const entry of sheet.entries) {
    const graphics = new PIXI.Graphics(entry.context);
    renderer.render({
      container: graphics,
      target,
      clear,
      transform: new PIXI.Matrix(
        1,
        0,
        0,
        1,
        (entry.x + entry.originX) * texel,
        (entry.y + entry.originY) * texel,
      ),
    });
    clear = false;
    graphics.destroy();
    entry.context.destroy();
    frames.set(entry.key, {
      texture: new PIXI.Texture({
        source: target.source,
        frame: new PIXI.Rectangle(
          entry.x * texel,
          entry.y * texel,
          entry.width * texel,
          entry.height * texel,
        ),
      }),
      scale: entry.scale,
      anchorX: entry.originX / entry.width,
      anchorY: entry.originY / entry.height,
    });
  }
  return { key: plan.key, renderer, target, frames };
};

/**
 * Hands back the atlas a plan names, baking it the first time anyone asks.
 * Populations share one descriptor's frames, and a live edit that abandons a
 * set of frames takes the texture with it. Held per renderer, because a page
 * mounting two canvases gives each its own, and a texture belongs to the one
 * that made it.
 */
const acquireAtlas = (plan, renderer) => {
  if (!plan.frames.length) return null;
  let sheets = baked.get(renderer);
  if (!sheets) baked.set(renderer, (sheets = new Map()));
  let held = sheets.get(plan.key);
  if (!held) {
    held = { atlas: bakeAtlas(plan, renderer), uses: 0 };
    sheets.set(plan.key, held);
  }
  held.uses++;
  return held.atlas;
};

const releaseAtlas = (atlas) => {
  const sheets = atlas && baked.get(atlas.renderer);
  const held = sheets && sheets.get(atlas.key);
  if (!held || --held.uses > 0) return;
  sheets.delete(atlas.key);
  for (const frame of atlas.frames.values()) frame.texture.destroy();
  /* A Pixi bind group destroys itself when a source it holds announces its own
     destruction, and the group belongs to the one particle shader every
     particle container in the renderer draws through. Dropping the listeners
     leaves that group pointing at a spent source instead, which the next
     particle draw overwrites on its way in. Nothing but a bind group listens
     for a source's change. */
  atlas.target.source.removeAllListeners("change");
  atlas.target.destroy(true);
};

export {
  planAtlas,
  packAtlas,
  bakeAtlas,
  acquireAtlas,
  releaseAtlas,
  BAKE_SUPERSAMPLE,
  ATLAS_TEXEL_LIMIT,
};
