/** Pixi resource lifetime and caching for the parts a Beefwife draws. */

import { PIXI } from "./pixi.mjs";
import { snapCoordinate } from "./geometry.mjs";

const sharedContexts = new WeakMap();

/* Pixi leaves something behind whichever kind of child this is. A Graphics
   is subscribed to its context by the context setter and `destroy` never
   unsubscribes, so a child holding a cached context stays reachable for as
   long as that shape and paint live; handing it a private context first
   detaches it from the shared one. A Mesh drops its reference to its
   geometry without destroying it, leaving the buffers on the renderer's
   books until an idle sweep, and every mesh here owns its geometry. */
const discard = (parent, child) => {
  if (child.parent === parent) parent.removeChild(child);
  const geometry = child.geometry ?? null;
  if (child.context) child.context = new PIXI.GraphicsContext();
  child.destroy();
  if (geometry) geometry.destroy();
};

/* Brings a list of interchangeable graphics to a count, keeping every one it
   can. Reports whether the parent's children moved. */
const resizeGraphics = (parent, list, count) => {
  if (list.length === count) return false;
  while (list.length > count) discard(parent, list.pop());
  while (list.length < count) list.push(new PIXI.Graphics());
  return true;
};

/* Draw scales are cached per quantized step, so a plate riding on contact
   reuses contexts instead of minting one a frame. The step is relative:
   1.6% of the scale, so the schema's 0.001 floor draws as accurately as its
   1000 ceiling and the whole range spans under 900 buckets. */
const SCALE_STEPS_PER_E = 63;
const scaleBucketFor = (scale) =>
  Math.round(Math.log(scale) * SCALE_STEPS_PER_E);

const contextFor = (shape, paint, scaleBucket) => {
  let paintContexts = sharedContexts.get(shape);
  if (!paintContexts) {
    paintContexts = new WeakMap();
    sharedContexts.set(shape, paintContexts);
  }
  let scaleContexts = paintContexts.get(paint);
  if (!scaleContexts) {
    scaleContexts = new Map();
    paintContexts.set(paint, scaleContexts);
  }
  let context = scaleContexts.get(scaleBucket);
  if (context) return context;
  const scale = Math.exp(scaleBucket / SCALE_STEPS_PER_E);
  const path = new PIXI.GraphicsPath(shape.path).transform(
    new PIXI.Matrix(scale, 0, 0, scale, 0, 0),
  );
  context = new PIXI.GraphicsContext().path(path);
  if (paint.fill !== null) context.fill(paint.fill);
  if (paint.stroke !== null && paint.strokeWidth > 0) {
    context.stroke({
      color: paint.stroke,
      width: paint.strokeWidth,
      cap: "butt",
      join: "miter",
    });
  }
  scaleContexts.set(scaleBucket, context);
  return context;
};

/* Fill always comes from a mesh and stroke always from a path, so a shape
   that wants both hands the same vertices to each. Stated triangles cannot
   be mistriangulated, which is what a body crossing over itself does to a
   filled closed path. */
const meshFor = (positions, indices, color) => {
  const geometry = new PIXI.MeshGeometry({
    positions,
    uvs: new Float32Array(positions.length),
    indices,
    shrinkBuffersToFit: false,
  });
  const mesh = new PIXI.Mesh({
    geometry,
    texture: PIXI.Texture.WHITE,
    roundPixels: false,
  });
  mesh.tint = color;
  mesh.dynamicPositions = positions;
  mesh.positionBuffer = geometry.getBuffer("aPosition");
  return mesh;
};

const setShapeTransform = (
  graphics,
  spec,
  x,
  y,
  directionX,
  directionY,
  scale,
  mirror = 1,
  pixelResolution = 0,
  inversePixelResolution = 0,
) => {
  const scaleBucket = scaleBucketFor(scale);
  if (graphics.scaleBucket !== scaleBucket) {
    graphics.context = contextFor(spec.shape, spec.paint, scaleBucket);
    graphics.scaleBucket = scaleBucket;
  }
  graphics.position.set(
    snapCoordinate(x, pixelResolution, inversePixelResolution),
    snapCoordinate(y, pixelResolution, inversePixelResolution),
  );
  graphics.rotation = Math.atan2(directionY, directionX);
  graphics.scale.set(1, mirror);
};

export { discard, resizeGraphics, contextFor, meshFor, setShapeTransform };
