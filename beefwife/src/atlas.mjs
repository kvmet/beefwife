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

// Supersampling preserves small silhouettes when particles rotate.
const BAKE_SUPERSAMPLE = 4;
/* A context's bounds already carry half a stroke width, and a miter reaches
   past that on a sharp enough corner, so a whole width is left around the
   drawn shape. The one texel floor keeps an unstroked frame off its
   neighbour. */
const PAD_STROKES = 1;
const MIN_PAD_TEXELS = 1;
const ATLAS_TEXEL_LIMIT = 2048;
// One frame may occupy at most a quarter of the sheet's texel budget.
const FRAME_TEXEL_LIMIT = ATLAS_TEXEL_LIMIT / 2;

// Matching shape and paint values share a frame at their largest draw scale.
const frameKeyFor = (shape, paint) =>
  `${shape.path}|${paint.fill}|${paint.stroke}|${paint.strokeWidth}`;

const baked = new WeakMap();
const prepared = new WeakMap();

// Planning uses descriptor values; measuring and baking need Pixi contexts.
const planAtlas = (model, renderResolution) => {
  const resolution = renderResolution * BAKE_SUPERSAMPLE;
  const specs = new Map();
  // Request detail for the largest draw scale; packing applies the budget.
  const claim = (shape, paint, scale) => {
    // A plate profiled down to nothing draws nothing, and needs no frame.
    if (!(scale > 0)) return null;
    const key = frameKeyFor(shape, paint);
    const frame = specs.get(key);
    if (frame) frame.scale = Math.max(frame.scale, scale);
    else specs.set(key, { key, shape, paint, scale });
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
    key: `${resolution}\n${[...specs.values()]
      .map(({ key, scale }) => `${key}|${scale}`)
      .sort()
      .join("\n")}`,
    resolution,
    frames: [...specs.values()],
    feet,
    plates,
    ornaments,
  };
};

const arrangeEntries = (entries) => {
  entries.sort((a, b) => b.height - a.height || a.key.localeCompare(b.key));
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
  return { width, height: shelfY + shelfHeight };
};

/** Measure once, then fit frames by reducing their raster scale. */
const packAtlas = (plan) => {
  const resolution = plan.resolution;
  const entries = [];
  try {
    for (const spec of plan.frames) {
      const context = contextFor(spec.shape, spec.paint, spec.scale);
      const entry = { ...spec, context, requestedScale: spec.scale };
      entries.push(entry);
      const bounds = context.bounds;
      entry.bounds = {
        minX: bounds.minX,
        minY: bounds.minY,
        width: bounds.width,
        height: bounds.height,
      };
      if (!Object.values(entry.bounds).every(Number.isFinite))
        throw new RangeError("atlas shape bounds must be finite");
    }
    let frameLimit = FRAME_TEXEL_LIMIT;
    let size;
    for (;;) {
      for (const entry of entries) {
        const { bounds, paint, requestedScale } = entry;
        const stroke =
          paint.strokeWidth * requestedScale * PAD_STROKES * resolution;
        const extent = Math.max(bounds.width, bounds.height) * resolution;
        const fullSize =
          Math.ceil(extent) + 2 * Math.max(MIN_PAD_TEXELS, Math.ceil(stroke));
        // Three texels cover outward rounding and the minimum border.
        const factor =
          fullSize <= frameLimit ? 1 : (frameLimit - 3) / (extent + 2 * stroke);
        entry.scale = requestedScale * factor;
        entry.pad = Math.max(MIN_PAD_TEXELS, Math.ceil(stroke * factor));
        entry.originX =
          entry.pad + Math.ceil(-bounds.minX * factor * resolution);
        entry.originY =
          entry.pad + Math.ceil(-bounds.minY * factor * resolution);
        entry.width =
          Math.ceil(bounds.width * factor * resolution) + entry.pad * 2;
        entry.height =
          Math.ceil(bounds.height * factor * resolution) + entry.pad * 2;
      }
      size = arrangeEntries(entries);
      if (size.width <= ATLAS_TEXEL_LIMIT && size.height <= ATLAS_TEXEL_LIMIT)
        break;
      // Four texels leave room for a shape and its border even at minimum detail.
      if (frameLimit === 4)
        throw new RangeError("too many atlas frames for the texture budget");
      frameLimit = Math.max(4, Math.floor(frameLimit * 0.75));
    }
    for (const entry of entries) {
      if (entry.scale === entry.requestedScale) continue;
      entry.context.destroy();
      entry.context = null;
      entry.context = contextFor(entry.shape, entry.paint, entry.scale);
    }
    return { resolution, ...size, entries };
  } catch (error) {
    for (const entry of entries) entry.context?.destroy();
    throw error;
  }
};

/* Validate before an instance adopts the model. One measurement per shared
   model and resolution keeps population creation independent of cast size. */
const prepareAtlas = (model, renderResolution) => {
  const held = prepared.get(model);
  if (held?.renderResolution === renderResolution) return held.plan;
  if (!Number.isFinite(renderResolution) || renderResolution <= 0)
    throw new RangeError("pixelResolution must be finite and positive");
  const plan = planAtlas(model, renderResolution);
  const sheet = packAtlas(plan);
  for (const entry of sheet.entries) entry.context.destroy();
  prepared.set(model, { renderResolution, plan });
  return plan;
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
  let complete = false;
  try {
    let clear = true;
    for (const entry of sheet.entries) {
      const graphics = new PIXI.Graphics(entry.context);
      try {
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
      } finally {
        graphics.destroy();
      }
      clear = false;
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
    complete = true;
  } finally {
    for (const entry of sheet.entries) entry.context.destroy();
    if (!complete) {
      for (const frame of frames.values()) frame.texture.destroy();
      target.destroy(true);
    }
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
  prepareAtlas,
  packAtlas,
  bakeAtlas,
  acquireAtlas,
  releaseAtlas,
  BAKE_SUPERSAMPLE,
  ATLAS_TEXEL_LIMIT,
};
