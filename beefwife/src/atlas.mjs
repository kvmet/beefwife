/**
 * One texture holding every shape a Beefwife places, so its feet, plates and
 * ornaments draw as particles out of a shared frame instead of a Graphics
 * apiece. Planning is separable from baking: the plan names the frames, sizes
 * them and packs them without a renderer, and only the bake needs a GPU.
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

const baked = new Map();

const planAtlas = (model, renderResolution) => {
  const resolution = renderResolution * BAKE_SUPERSAMPLE;
  const entries = new Map();
  /* Frames are baked at the largest a part ever draws, so a live particle
     only ever scales down and never magnifies its own texels. */
  const claim = (shape, paint, scale) => {
    // A plate profiled down to nothing draws nothing, and needs no frame.
    if (!(scale > 0)) return null;
    const key = frameKeyFor(shape, paint, scale);
    if (entries.has(key)) return key;
    const context = contextFor(shape, paint, scale);
    const bounds = context.bounds;
    const pad = Math.max(
      MIN_PAD_TEXELS,
      Math.ceil(paint.strokeWidth * scale * PAD_STROKES * resolution),
    );
    entries.set(key, {
      key,
      shape,
      paint,
      scale,
      context,
      pad,
      /* Where the shape's own origin sits inside the frame, rounded out to a
         whole texel so the bake lands on the texture's grid. */
      originX: pad + Math.ceil(-bounds.minX * resolution),
      originY: pad + Math.ceil(-bounds.minY * resolution),
      width: Math.ceil(bounds.width * resolution) + pad * 2,
      height: Math.ceil(bounds.height * resolution) + pad * 2,
    });
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

  // Shelf packed tallest first, which is enough for a handful of frames.
  const packed = [...entries.values()].sort((a, b) => b.height - a.height);
  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;
  let width = 0;
  for (const entry of packed) {
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

  return {
    key: `${resolution}\n${packed.map((entry) => entry.key).join("\n")}`,
    resolution,
    width,
    height: shelfY + shelfHeight,
    entries: packed,
    feet,
    plates,
    ornaments,
  };
};

const bakeAtlas = (plan, renderer) => {
  const texel = 1 / plan.resolution;
  const target = PIXI.RenderTexture.create({
    width: plan.width * texel,
    height: plan.height * texel,
    resolution: plan.resolution,
    antialias: false,
    scaleMode: "nearest",
  });
  const frames = new Map();
  let clear = true;
  for (const entry of plan.entries) {
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
    // The context came in from the plan, so destroying the holder keeps it.
    graphics.destroy();
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
  return { key: plan.key, target, frames };
};

/**
 * Hands back the atlas a plan names, baking it the first time anyone asks.
 * Populations share one descriptor's frames, and a live edit that abandons a
 * set of frames takes the texture with it.
 */
const acquireAtlas = (plan, renderer) => {
  let held = baked.get(plan.key);
  if (!held && plan.entries.length) {
    held = { atlas: bakeAtlas(plan, renderer), uses: 0 };
    baked.set(plan.key, held);
  }
  for (const entry of plan.entries) entry.context.destroy();
  if (!held) return null;
  held.uses++;
  return held.atlas;
};

const releaseAtlas = (atlas) => {
  const held = atlas && baked.get(atlas.key);
  if (!held || --held.uses > 0) return;
  baked.delete(atlas.key);
  for (const frame of atlas.frames.values()) frame.texture.destroy();
  atlas.target.destroy(true);
};

export { planAtlas, bakeAtlas, acquireAtlas, releaseAtlas, BAKE_SUPERSAMPLE };
