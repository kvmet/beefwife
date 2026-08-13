/** Pixi resource lifetime and construction for the parts a Beefwife draws. */

import { PIXI } from "./pixi.mjs";

/* Pixi leaves something behind whichever kind of child this is. A Graphics
   holds a context it built itself and destroys it, but a Mesh drops its
   reference to its geometry without destroying it, leaving the buffers on the
   renderer's books until an idle sweep, and every mesh here owns its
   geometry. */
const discard = (parent, child) => {
  if (child.parent === parent) parent.removeChild(child);
  const geometry = child.geometry ?? null;
  child.destroy();
  if (geometry) geometry.destroy();
};

/* Draw scale is baked into the path rather than left to a transform, so the
   stroke, which is a length, travels with the geometry: an unscaled width
   would swell to hundreds of times the shape it outlines at the schema's
   smallest draw scales. */
const contextFor = (shape, paint, scale) => {
  const path = new PIXI.GraphicsPath(shape.path).transform(
    new PIXI.Matrix(scale, 0, 0, scale, 0, 0),
  );
  const context = new PIXI.GraphicsContext().path(path);
  if (paint.fill !== null) context.fill(paint.fill);
  if (paint.stroke !== null && paint.strokeWidth > 0)
    context.stroke({
      color: paint.stroke,
      width: paint.strokeWidth * scale,
      cap: "butt",
      join: "miter",
    });
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

export { discard, contextFor, meshFor };
