/** Pixi geometry and display ownership for one Beefwife. */

const BeefwifeGraphics = (() => {
  if (typeof PIXI === "undefined") {
    return class HeadlessGraphics {
      static available = false;
      static prepare() {}
    };
  }

  const sharedContexts = new WeakMap();

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
    const scale = scaleBucket / 64;
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

  const meshFor = (vertexCount, indices, color) => {
    const positions = new Float32Array(vertexCount * 2);
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

  /* A limb is one closed outline, wound down one side and back up the other:
     hip, knee, foot, foot, knee, hip. Both halves share each knee vertex, so
     they cannot part company there. */
  const LIMB_VERTICES = 6;
  const LIMB_FLOATS = LIMB_VERTICES * 2;

  const limbMeshFor = (legCount, paint) => {
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
    return meshFor(legCount * LIMB_VERTICES, indices, paint.fill);
  };

  const ribbonMeshFor = (chunkCount, paint) => {
    const indices = new Uint32Array(Math.max(0, chunkCount - 1) * 6);
    for (let chunk = 0; chunk < chunkCount - 1; chunk++) {
      const vertex = chunk * 2;
      indices.set(
        [vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3],
        chunk * 6,
      );
    }
    return meshFor(chunkCount * 2, indices, paint.fill);
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
          Math.round(positions[index] * pixelResolution) *
          inversePixelResolution;
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
    const scaleBucket = Math.round(scale * 64);
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
      /* A mesh carries a tint and nothing else, so a limb that wants an
         outline as well draws through Graphics, as the ribbon does. */
      const legPaint = this.model.legs.skin.limbPaint;
      this.limbIsMesh =
        legPaint.fill !== null &&
        (legPaint.stroke === null || legPaint.strokeWidth <= 0);
      this.limbs = this.limbIsMesh
        ? limbMeshFor(state.legs.length / state.layout.legStride, legPaint)
        : new PIXI.Graphics();
      this.limbPoints = this.limbIsMesh ? null : new Float64Array(LIMB_FLOATS);
      const ribbonPaint = this.model.skin.ribbonPaint;
      this.ribbonIsMesh =
        ribbonPaint.fill !== null &&
        (ribbonPaint.stroke === null || ribbonPaint.strokeWidth <= 0);
      this.ribbon = this.ribbonIsMesh
        ? ribbonMeshFor(this.model.chunks.length, ribbonPaint)
        : new PIXI.Graphics();
      this.feet = [];
      this.ornaments = [];
      this.plates = [];
      this._build(state);
      this.sync(state);
    }

    _build(state) {
      for (
        let offset = 0;
        offset < state.legs.length;
        offset += state.layout.legStride
      ) {
        const foot = new PIXI.Graphics();
        this.feet.push(foot);
        this.parent.addChild(foot);
      }
      this.parent.addChild(this.limbs);
      for (let index = 0; index < this.model.skin.ornaments.length; index++) {
        const spec = this.model.skin.ornaments[index];
        const ornament = new PIXI.Graphics();
        this.ornaments[index] = ornament;
        if (spec.layer === "under") this.parent.addChild(ornament);
      }
      this.parent.addChild(this.ribbon);
      for (
        let index = 0;
        index < this.model.skin.platesTailFirst.length;
        index++
      ) {
        const plate = new PIXI.Graphics();
        this.plates.push(plate);
        this.parent.addChild(plate);
      }
      for (let index = 0; index < this.model.skin.ornaments.length; index++) {
        if (this.model.skin.ornaments[index].layer === "over")
          this.parent.addChild(this.ornaments[index]);
      }
    }

    _syncLimbs(state, pixelResolution, inversePixelResolution) {
      const legs = state.legs;
      const width = this.model.legs.skin.limbWidth;
      const positions = this.limbIsMesh
        ? this.limbs.dynamicPositions
        : this.limbPoints;
      if (!this.limbIsMesh) this.limbs.clear();
      // A limb with no width is no limb; the feet still stand on their own.
      if (width <= 0) {
        if (this.limbIsMesh) {
          positions.fill(0);
          this.limbs.positionBuffer.update();
        }
        return;
      }
      const stride = state.layout.legStride;
      const projection = this.options.kneeProjection ?? null;
      const jointLean = this.model.legs.jointLean;
      for (let offset = 0; offset < legs.length; offset += stride) {
        const legIndex = offset / stride;
        const vertexOffset = this.limbIsMesh ? legIndex * LIMB_FLOATS : 0;
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
        if (this.limbIsMesh) continue;
        this.limbs.moveTo(positions[0], positions[1]);
        for (let vertex = 2; vertex < LIMB_FLOATS; vertex += 2)
          this.limbs.lineTo(positions[vertex], positions[vertex + 1]);
        this.limbs.closePath();
      }
      if (this.limbIsMesh) {
        this.limbs.positionBuffer.update();
        return;
      }
      const legPaint = this.model.legs.skin.limbPaint;
      if (legPaint.fill !== null) this.limbs.fill(legPaint.fill);
      if (legPaint.stroke !== null && legPaint.strokeWidth > 0)
        this.limbs.stroke({
          color: legPaint.stroke,
          width: legPaint.strokeWidth,
          cap: "butt",
          join: "miter",
        });
    }

    _syncRibbon(state, pixelResolution, inversePixelResolution) {
      const chunks = state.chunks;
      const stride = state.layout.chunkStride;
      const lastIndex = this.model.chunks.length - 1;
      if (this.ribbonIsMesh) {
        const positions = this.ribbon.dynamicPositions;
        for (let index = 0; index < this.model.chunks.length; index++) {
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
        this.ribbon.positionBuffer.update();
        return;
      }
      this.ribbon.clear();
      if (!this.model.skin.hasRibbon) return;
      const coordinate =
        pixelResolution === 1
          ? Math.round
          : pixelResolution > 0
            ? (value) =>
                Math.round(value * pixelResolution) * inversePixelResolution
            : (value) => value;
      for (let index = 0; index < this.model.chunks.length; index++) {
        const offset = index * stride;
        const width = this.model.chunks[index].ribbonWidth;
        const x = chunks[offset] - chunks[offset + 3] * width;
        const y = chunks[offset + 1] + chunks[offset + 2] * width;
        if (index) this.ribbon.lineTo(coordinate(x), coordinate(y));
        else this.ribbon.moveTo(coordinate(x), coordinate(y));
      }
      const tailOffset = lastIndex * stride;
      const tailWidth = this.model.chunks[lastIndex].ribbonWidth;
      const tailAngle = Math.atan2(
        chunks[tailOffset + 2],
        -chunks[tailOffset + 3],
      );
      this.ribbon.arc(
        coordinate(chunks[tailOffset]),
        coordinate(chunks[tailOffset + 1]),
        tailWidth,
        tailAngle,
        tailAngle + Math.PI,
      );
      for (let index = lastIndex; index >= 0; index--) {
        const offset = index * stride;
        const width = this.model.chunks[index].ribbonWidth;
        this.ribbon.lineTo(
          coordinate(chunks[offset] + chunks[offset + 3] * width),
          coordinate(chunks[offset + 1] - chunks[offset + 2] * width),
        );
      }
      const headAngle = Math.atan2(-chunks[2], chunks[3]);
      this.ribbon.arc(
        coordinate(chunks[0]),
        coordinate(chunks[1]),
        this.model.chunks[0].ribbonWidth,
        headAngle,
        headAngle + Math.PI,
      );
      this.ribbon.closePath();
      const paint = this.model.skin.ribbonPaint;
      if (paint.fill !== null) this.ribbon.fill(paint.fill);
      if (paint.stroke !== null && paint.strokeWidth > 0)
        this.ribbon.stroke({ color: paint.stroke, width: paint.strokeWidth });
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
        this.limbs,
        ...this.ornaments,
        this.ribbon,
        ...this.plates,
      ];
      for (const child of children) {
        if (child.parent === this.parent) this.parent.removeChild(child);
        child.destroy();
      }
    }
  }

  return Graphics;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeGraphics;
}
