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

  const limbMeshFor = (legCount, paint) => {
    const indices = new Uint32Array(legCount * 12);
    for (let leg = 0; leg < legCount; leg++) {
      const vertex = leg * 8;
      indices.set(
        [
          vertex,
          vertex + 1,
          vertex + 2,
          vertex + 2,
          vertex + 1,
          vertex + 3,
          vertex + 4,
          vertex + 5,
          vertex + 6,
          vertex + 6,
          vertex + 5,
          vertex + 7,
        ],
        leg * 12,
      );
    }
    return meshFor(legCount * 8, indices, paint.stroke);
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

  const writeSegment = (
    positions,
    offset,
    startX,
    startY,
    endX,
    endY,
    width,
    pixelResolution = 0,
    inversePixelResolution = 0,
  ) => {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = (-dy / length) * width * 0.5;
    const normalY = (dx / length) * width * 0.5;
    positions[offset] = startX + normalX;
    positions[offset + 1] = startY + normalY;
    positions[offset + 2] = startX - normalX;
    positions[offset + 3] = startY - normalY;
    positions[offset + 4] = endX + normalX;
    positions[offset + 5] = endY + normalY;
    positions[offset + 6] = endX - normalX;
    positions[offset + 7] = endY - normalY;
    snapPositions(
      positions,
      offset,
      offset + 8,
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
      for (const [id, paint] of Object.entries(
        model.descriptor.definitions.paints,
      )) {
        for (const key of ["fill", "stroke"]) {
          if (paint[key] === null) continue;
          try {
            new PIXI.Color(paint[key]);
          } catch (error) {
            throw new Error(
              `$.definitions.paints.${id}.${key}: ${error.message}`,
            );
          }
        }
      }
    }

    constructor(parent, state, options = null) {
      this.parent = parent;
      this.model = state.model;
      this.options = options || {};
      const legPaint = this.model.legs.skin.limbPaint;
      this.limbs = limbMeshFor(
        state.legs.length / state.layout.legStride,
        legPaint,
      );
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
      const positions = this.limbs.dynamicPositions;
      const width = this.model.legs.skin.limbPaint.strokeWidth;
      const stride = state.layout.legStride;
      const projection = this.options.kneeProjection ?? null;
      const jointLean = this.model.legs.jointLean;
      for (let offset = 0; offset < legs.length; offset += stride) {
        const legIndex = offset / stride;
        const vertexOffset = legIndex * 16;
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
        writeSegment(
          positions,
          vertexOffset,
          legs[offset],
          legs[offset + 1],
          kneeX,
          kneeY,
          width,
          pixelResolution,
          inversePixelResolution,
        );
        writeSegment(
          positions,
          vertexOffset + 8,
          kneeX,
          kneeY,
          legs[offset + 4],
          legs[offset + 5],
          width,
          pixelResolution,
          inversePixelResolution,
        );
      }
      this.limbs.positionBuffer.update();
    }

    _syncRibbon(state, pixelResolution, inversePixelResolution) {
      const chunks = state.chunks;
      const stride = state.layout.chunkStride;
      const scale = this.model.skin.scale;
      const lastIndex = this.model.chunks.length - 1;
      if (this.ribbonIsMesh) {
        const positions = this.ribbon.dynamicPositions;
        for (let index = 0; index < this.model.chunks.length; index++) {
          const chunkOffset = index * stride;
          const vertexOffset = index * 4;
          const width = this.model.chunks[index].ribbonWidth * scale;
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
        const width = this.model.chunks[index].ribbonWidth * scale;
        const x = chunks[offset] - chunks[offset + 3] * width;
        const y = chunks[offset + 1] + chunks[offset + 2] * width;
        if (index) this.ribbon.lineTo(coordinate(x), coordinate(y));
        else this.ribbon.moveTo(coordinate(x), coordinate(y));
      }
      const tailOffset = lastIndex * stride;
      const tailWidth = this.model.chunks[lastIndex].ribbonWidth * scale;
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
        const width = this.model.chunks[index].ribbonWidth * scale;
        this.ribbon.lineTo(
          coordinate(chunks[offset] + chunks[offset + 3] * width),
          coordinate(chunks[offset + 1] - chunks[offset + 2] * width),
        );
      }
      const headAngle = Math.atan2(-chunks[2], chunks[3]);
      this.ribbon.arc(
        coordinate(chunks[0]),
        coordinate(chunks[1]),
        this.model.chunks[0].ribbonWidth * scale,
        headAngle + Math.PI,
        headAngle + Math.PI * 2,
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
