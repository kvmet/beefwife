/** Pixi display ownership for one Beefwife. */

const BeefwifeGraphics = (() => {
  if (typeof PIXI === "undefined") {
    return class HeadlessGraphics {
      static available = false;
      static prepare() {}
    };
  }

  const Geometry =
    typeof BeefwifeGeometry !== "undefined"
      ? BeefwifeGeometry
      : typeof module !== "undefined" && module.exports
        ? require("./beefwife-geometry.js")
        : null;
  if (!Geometry)
    throw new Error("Beefwife graphics requires beefwife-geometry.js");
  const {
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
  } = Geometry;

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

  class Graphics {
    static available = true;
    static prepare(model) {
      for (const [id, shape] of Object.entries(
        model.descriptor.definitions.shapes,
      )) {
        try {
          new PIXI.GraphicsPath(shape.path);
        } catch (error) {
          throw new Error(`$.definitions.shapes.${id}.path: ${error.message}`);
        }
      }
      for (const [id, paint] of Object.entries(model.paints)) {
        for (const key of ["fill", "stroke"]) {
          if (paint[key] === null) continue;
          try {
            new PIXI.Color(paint[key]);
          } catch (error) {
            const field = key === "stroke" ? "stroke.colour" : key;
            throw new Error(
              `$.definitions.paints.${id}.${field}: ${error.message}`,
            );
          }
        }
      }
    }

    constructor(parent, state, options = null) {
      this.parent = parent;
      this.model = state.model;
      this.options = options || {};
      this.feet = [];
      this.ornaments = [];
      this.plates = [];
      /* One set of vertices per shape, written once a frame; the mesh reads it
         for the fill and the path traces it for the stroke. */
      this.limbPositions = null;
      this.limbFill = null;
      this.limbStroke = null;
      this.limbCount = -1;
      this.ribbonPositions = null;
      this.ribbonFill = null;
      this.ribbonStroke = null;
      this.ribbonCount = -1;
      this.layers = null;
      this.adopt(state);
    }

    /* Takes on a model by changing only what it disagrees with: children come
       and go by count, a mesh is rebuilt only when its vertex count moves or
       its paint gains or loses a pass, and the order is settled only when the
       cast changed. Shapes and paints are new objects on every compile, so
       cached contexts always go. */
    adopt(state) {
      this.model = state.model;
      const legCount = state.legs.length / state.layout.legStride;
      const layers = this.model.skin.ornaments
        .map((ornament) => ornament.layer)
        .join("");
      let changed = resizeGraphics(this.parent, this.feet, legCount);
      changed =
        resizeGraphics(
          this.parent,
          this.plates,
          this.model.skin.platesTailFirst.length,
        ) || changed;
      changed =
        resizeGraphics(
          this.parent,
          this.ornaments,
          this.model.skin.ornaments.length,
        ) || changed;
      changed = this._syncLimbParts(legCount) || changed;
      changed = this._syncRibbonParts() || changed;
      if (changed || layers !== this.layers) {
        this.layers = layers;
        this._arrange();
      }
      for (const child of [...this.feet, ...this.ornaments, ...this.plates])
        child.scaleBucket = null;
      this.sync(state);
    }

    _drop(child) {
      discard(this.parent, child);
    }

    _syncLimbParts(legCount) {
      const paint = this.model.legs.skin.limbPaint;
      const wantFill = paint.fill !== null;
      const wantStroke = paint.stroke !== null && paint.strokeWidth > 0;
      const resized = legCount !== this.limbCount;
      let changed = false;
      if (resized) {
        this.limbCount = legCount;
        this.limbPositions = new Float32Array(legCount * LIMB_FLOATS);
      }
      if (this.limbFill && (resized || !wantFill)) {
        this._drop(this.limbFill);
        this.limbFill = null;
        changed = true;
      }
      if (wantFill && !this.limbFill) {
        this.limbFill = meshFor(
          this.limbPositions,
          limbIndicesFor(legCount),
          paint.fill,
        );
        changed = true;
      } else if (this.limbFill) this.limbFill.tint = paint.fill;
      if (this.limbStroke && !wantStroke) {
        this._drop(this.limbStroke);
        this.limbStroke = null;
        changed = true;
      } else if (wantStroke && !this.limbStroke) {
        this.limbStroke = new PIXI.Graphics();
        changed = true;
      }
      return changed;
    }

    _syncRibbonParts() {
      const paint = this.model.skin.ribbonPaint;
      const chunkCount = this.model.chunks.length;
      const wantFill = paint.fill !== null;
      const wantStroke = paint.stroke !== null && paint.strokeWidth > 0;
      const resized = chunkCount !== this.ribbonCount;
      let changed = false;
      if (resized) {
        this.ribbonCount = chunkCount;
        this.ribbonPositions = ribbonPositionsFor(chunkCount);
      }
      if (this.ribbonFill && (resized || !wantFill)) {
        this._drop(this.ribbonFill);
        this.ribbonFill = null;
        changed = true;
      }
      if (wantFill && !this.ribbonFill) {
        this.ribbonFill = meshFor(
          this.ribbonPositions,
          ribbonIndicesFor(chunkCount),
          paint.fill,
        );
        changed = true;
      } else if (this.ribbonFill) this.ribbonFill.tint = paint.fill;
      if (this.ribbonStroke && !wantStroke) {
        this._drop(this.ribbonStroke);
        this.ribbonStroke = null;
        changed = true;
      } else if (wantStroke && !this.ribbonStroke) {
        this.ribbonStroke = new PIXI.Graphics();
        changed = true;
      }
      return changed;
    }

    /* Feet sit under the limbs, then the under ornaments, the ribbon, the
       plates tail to head, and the over ornaments. Re-adding a child the
       parent already holds moves it to the end, so this one pass settles the
       whole order however the cast changed. */
    _arrange() {
      const onLayer = (layer) =>
        this.ornaments.filter(
          (_, index) => this.model.skin.ornaments[index].layer === layer,
        );
      for (const child of [
        ...this.feet,
        this.limbFill,
        this.limbStroke,
        ...onLayer("under"),
        this.ribbonFill,
        this.ribbonStroke,
        ...this.plates,
        ...onLayer("over"),
      ])
        if (child) this.parent.addChild(child);
    }

    _syncLimbs(state, pixelResolution, inversePixelResolution) {
      const legs = state.legs;
      const width = this.model.legs.skin.limbWidth;
      const positions = this.limbPositions;
      if (this.limbStroke) this.limbStroke.clear();
      // A limb with no width is no limb; the feet still stand on their own.
      if (width <= 0) {
        positions.fill(0);
        if (this.limbFill) this.limbFill.positionBuffer.update();
        return;
      }
      const stride = state.layout.legStride;
      const projection = this.options.kneeProjection ?? null;
      const jointLean = this.model.legs.jointLean;
      for (let offset = 0; offset < legs.length; offset += stride) {
        const vertexOffset = (offset / stride) * LIMB_FLOATS;
        let kneeX = legs[offset + 2];
        let kneeY = legs[offset + 3];
        if (projection) {
          // Rendering may move only the shared knee; planted endpoints remain
          // simulation-owned and both limb segments must meet at one point.
          if (
            Number.isFinite(projection.perspective) &&
            projection.perspective >= 0 &&
            Number.isFinite(projection.centerX) &&
            Number.isFinite(projection.centerY)
          ) {
            const viewDistance = Math.hypot(
              kneeX - projection.centerX,
              kneeY - projection.centerY,
            );
            if (viewDistance > 0 && projection.perspective > 0) {
              const elbowHeight = Math.hypot(
                kneeX - (legs[offset] + legs[offset + 4]) / 2,
                kneeY - (legs[offset + 1] + legs[offset + 5]) / 2,
              );
              const maxOffset = Number.isFinite(projection.maxOffset)
                ? Math.max(0, projection.maxOffset)
                : Infinity;
              const radialOffset = Math.min(
                maxOffset,
                viewDistance * elbowHeight * projection.perspective,
              );
              kneeX +=
                ((kneeX - projection.centerX) / viewDistance) * radialOffset;
              kneeY +=
                ((kneeY - projection.centerY) / viewDistance) * radialOffset;
            }
          }
        }
        if (jointLean !== 0) {
          const leanOffset = legs[offset + 10] * jointLean;
          kneeX += legs[offset + 6] * leanOffset;
          kneeY += legs[offset + 7] * leanOffset;
        }
        writeLimb(
          positions,
          vertexOffset,
          legs[offset],
          legs[offset + 1],
          kneeX,
          kneeY,
          legs[offset + 4],
          legs[offset + 5],
          width,
          pixelResolution,
          inversePixelResolution,
        );
      }
      if (this.limbFill) this.limbFill.positionBuffer.update();
      if (!this.limbStroke) return;
      for (let base = 0; base < positions.length; base += LIMB_FLOATS) {
        this.limbStroke.moveTo(positions[base], positions[base + 1]);
        for (let vertex = 2; vertex < LIMB_FLOATS; vertex += 2)
          this.limbStroke.lineTo(
            positions[base + vertex],
            positions[base + vertex + 1],
          );
        this.limbStroke.closePath();
      }
      const legPaint = this.model.legs.skin.limbPaint;
      this.limbStroke.stroke({
        color: legPaint.stroke,
        width: legPaint.strokeWidth,
        cap: "butt",
        join: "miter",
      });
    }

    _syncRibbon(state, pixelResolution, inversePixelResolution) {
      const chunks = state.chunks;
      const stride = state.layout.chunkStride;
      const count = this.model.chunks.length;
      const lastIndex = count - 1;
      const positions = this.ribbonPositions;
      /* Edge A runs down the left of the chain, edge B back up the right; each
         chunk's facing turns them, so a vertex pair sits at every chunk. */
      for (let index = 0; index < count; index++) {
        const chunkOffset = index * stride;
        const vertexOffset = index * 4;
        const width = this.model.chunks[index].ribbonWidth;
        positions[vertexOffset] =
          chunks[chunkOffset] - chunks[chunkOffset + 3] * width;
        positions[vertexOffset + 1] =
          chunks[chunkOffset + 1] + chunks[chunkOffset + 2] * width;
        positions[vertexOffset + 2] =
          chunks[chunkOffset] + chunks[chunkOffset + 3] * width;
        positions[vertexOffset + 3] =
          chunks[chunkOffset + 1] - chunks[chunkOffset + 2] * width;
        snapPositions(
          positions,
          vertexOffset,
          vertexOffset + 4,
          pixelResolution,
          inversePixelResolution,
        );
      }
      const tailOffset = lastIndex * stride;
      const tailX = chunks[tailOffset + 2];
      const tailY = chunks[tailOffset + 3];
      writeCap(
        positions,
        count * 4,
        chunks[tailOffset],
        chunks[tailOffset + 1],
        this.model.chunks[lastIndex].ribbonWidth,
        -tailY,
        tailX,
        -tailX,
        -tailY,
        pixelResolution,
        inversePixelResolution,
      );
      const headX = chunks[2];
      const headY = chunks[3];
      writeCap(
        positions,
        count * 4 + CAP_VERTICES * 2,
        chunks[0],
        chunks[1],
        this.model.chunks[0].ribbonWidth,
        headY,
        -headX,
        headX,
        headY,
        pixelResolution,
        inversePixelResolution,
      );
      if (this.ribbonFill) this.ribbonFill.positionBuffer.update();
      if (!this.ribbonStroke) return;
      this.ribbonStroke.clear();
      if (!this.model.skin.hasRibbon) return;
      const tailRim = count * 4 + 2;
      const headRim = count * 4 + CAP_VERTICES * 2 + 2;
      this.ribbonStroke.moveTo(positions[0], positions[1]);
      for (let index = 1; index < count; index++)
        this.ribbonStroke.lineTo(
          positions[index * 4],
          positions[index * 4 + 1],
        );
      // The rim's first and last points are the edge vertices already drawn.
      for (let step = 1; step < CAP_SEGMENTS; step++)
        this.ribbonStroke.lineTo(
          positions[tailRim + step * 2],
          positions[tailRim + step * 2 + 1],
        );
      for (let index = lastIndex; index >= 0; index--)
        this.ribbonStroke.lineTo(
          positions[index * 4 + 2],
          positions[index * 4 + 3],
        );
      for (let step = 1; step < CAP_SEGMENTS; step++)
        this.ribbonStroke.lineTo(
          positions[headRim + step * 2],
          positions[headRim + step * 2 + 1],
        );
      this.ribbonStroke.closePath();
      const paint = this.model.skin.ribbonPaint;
      this.ribbonStroke.stroke({
        color: paint.stroke,
        width: paint.strokeWidth,
      });
    }

    sync(state) {
      if (state.model !== this.model)
        throw new Error("render state model does not match Beefwife graphics");
      const pixelResolution =
        this.options.roundVertices === true
          ? (this.options.pixelResolution ?? 1)
          : 0;
      const inversePixelResolution =
        pixelResolution > 0 ? 1 / pixelResolution : 0;
      this._syncLimbs(state, pixelResolution, inversePixelResolution);
      const legs = state.legs;
      for (let index = 0; index < this.feet.length; index++) {
        const offset = index * state.layout.legStride;
        setShapeTransform(
          this.feet[index],
          this.model.legs.skin.foot,
          legs[offset + 4],
          legs[offset + 5],
          legs[offset + 6],
          legs[offset + 7],
          legs[offset + 8],
          legs[offset + 9],
          pixelResolution,
          inversePixelResolution,
        );
      }
      const ornaments = state.ornaments;
      for (let index = 0; index < this.ornaments.length; index++) {
        const offset = index * state.layout.ornamentStride;
        setShapeTransform(
          this.ornaments[index],
          this.model.skin.ornaments[index],
          ornaments[offset],
          ornaments[offset + 1],
          ornaments[offset + 2],
          ornaments[offset + 3],
          ornaments[offset + 4],
          ornaments[offset + 5],
          pixelResolution,
          inversePixelResolution,
        );
      }
      this._syncRibbon(state, pixelResolution, inversePixelResolution);
      const plates = state.plates;
      for (let index = 0; index < this.plates.length; index++) {
        const offset = index * state.layout.plateStride;
        setShapeTransform(
          this.plates[index],
          this.model.skin.platesTailFirst[index],
          plates[offset],
          plates[offset + 1],
          plates[offset + 2],
          plates[offset + 3],
          plates[offset + 4],
          1,
          pixelResolution,
          inversePixelResolution,
        );
      }
    }

    destroy() {
      const children = [
        ...this.feet,
        this.limbFill,
        this.limbStroke,
        ...this.ornaments,
        this.ribbonFill,
        this.ribbonStroke,
        ...this.plates,
      ];
      for (const child of children) {
        if (child !== null) discard(this.parent, child);
      }
    }
  }

  return Graphics;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeGraphics;
}
