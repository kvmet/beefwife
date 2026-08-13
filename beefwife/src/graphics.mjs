/** Pixi display ownership for one Beefwife. */

import { PIXI, available } from "./pixi.mjs";
import {
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
} from "./geometry.mjs";
import { discard, meshFor } from "./display.mjs";
import { planAtlas, acquireAtlas, releaseAtlas } from "./atlas.mjs";

// In draw order, and each band has to stay contiguous to hold that order.
const BAND_LABELS = ["feet", "ornaments-under", "plates", "ornaments-over"];
/* Every part moves, turns and changes size every frame; only its frame and
   its colour hold still. */
const PARTICLE_PROPERTIES = {
  position: true,
  vertex: true,
  rotation: true,
  uvs: false,
  color: false,
};

class HeadlessGraphics {
  static available = false;
  static prepare() {}
}

// The widest a Beefwife world may be, so a knee cannot be pushed outside it.
const MAX_KNEE_OFFSET = 2e9;

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

  constructor(host, state, options = null) {
    /* The parts hold a container of their own. Settling their draw order
       re-adds every one of them, which moves each to the end of its parent's
       children, so anything the host added to the Beefwife would sink
       underneath the creature on the next edit that changes the cast. */
    this.parent = host.addChild(new PIXI.Container());
    this.model = state.model;
    this.options = options || {};
    /* The shapes live in their containers, in draw order; these hold the same
       particles flat, in the order the render state writes them. */
    this.footParticles = [];
    this.ornamentParticles = [];
    this.plateParticles = [];
    this.shapeContainers = [];
    this.atlas = null;
    this.atlasResolution = 0;
    // Dropped whenever the model moves, which is what makes the frames follow.
    this.plan = null;
    this.legCount = 0;
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
    /* What the last rebake replaced, held one frame. See `_retire`. */
    this.retired = null;
    this.adopt(state);
  }

  /* Takes on a model by changing only what it disagrees with: a mesh is
     rebuilt only when its vertex count moves or its paint gains or loses a
     pass, and the order is settled only when the cast changed. The shapes
     follow the plan, which every compile drops, because shapes and paints are
     new objects each time and the frames are named by what they draw. */
  adopt(state) {
    this.model = state.model;
    this.legCount = state.legs.length / state.layout.legStride;
    this.plan = null;
    let changed = this._syncLimbParts(this.legCount);
    changed = this._syncRibbonParts() || changed;
    if (changed) this._arrange();
    this.sync(state);
  }

  _drop(child) {
    discard(this.parent, child);
  }

  /* A rebake runs inside `onRender`, which Pixi calls partway through
     executing the frame's instructions. The sheet and the containers being
     replaced are already in that instruction set, so destroying them here
     leaves the rest of the pass drawing from a texture whose source is gone.
     They leave the scene now and are destroyed at the top of the next frame,
     once the pass that scheduled them has finished. Removing a child is safe
     mid-pass in a way that destroying one is not. */
  _retire(atlas, containers) {
    this._flushRetired();
    for (const container of containers)
      if (container && container.parent === this.parent)
        this.parent.removeChild(container);
    this.retired = { atlas, containers };
  }

  _flushRetired() {
    const retired = this.retired;
    if (!retired) return;
    this.retired = null;
    for (const container of retired.containers)
      if (container) container.destroy();
    releaseAtlas(retired.atlas);
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
     whole order however the cast changed. A container is one display object,
     which is why each of the four bands has to be contiguous. */
  _arrange() {
    const [feet, under, plates, over] = this.shapeContainers;
    for (const child of [
      feet,
      this.limbFill,
      this.limbStroke,
      under,
      this.ribbonFill,
      this.ribbonStroke,
      plates,
      over,
    ])
      if (child) this.parent.addChild(child);
  }

  /* One particle per placement, holding the frame baked for the largest that
     placement ever draws. A placement with no frame, which is a plate a
     profile scaled to nothing, keeps its slot and draws nothing. */
  _buildParticles(plan) {
    const bands = [null, null, null, null];
    const bandFor = (index) => {
      if (!bands[index])
        bands[index] = new PIXI.ParticleContainer({
          label: BAND_LABELS[index],
          dynamicProperties: PARTICLE_PROPERTIES,
        });
      return bands[index];
    };
    const place = (index, key) => {
      const frame = key === null ? null : this.atlas.frames.get(key);
      if (!frame) return null;
      const particle = new PIXI.Particle({
        texture: frame.texture,
        anchorX: frame.anchorX,
        anchorY: frame.anchorY,
      });
      particle.bakeScale = frame.scale;
      bandFor(index).addParticle(particle);
      return particle;
    };
    this.footParticles = Array.from({ length: this.legCount }, () =>
      place(0, plan.feet),
    );
    this.ornamentParticles = plan.ornaments.map((key, index) =>
      place(this.model.skin.ornaments[index].layer === "under" ? 1 : 3, key),
    );
    this.plateParticles = plan.plates.map((key) => place(2, key));
    this.shapeContainers = bands;
    this._arrange();
  }

  /* The renderer arrives with Pixi's own render callback, which is the first
     moment a beefwife is certain to have one. Until then the shapes have no
     frames and the creature draws as its meshes alone, for one frame. */
  _syncAtlas(renderer) {
    const resolution = this.options.pixelResolution ?? 1;
    this._flushRetired();
    if (this.plan && this.atlasResolution === resolution) return;
    if (!renderer) return;
    const plan = planAtlas(this.model, resolution);
    // Acquired before the old one goes, so a shared atlas is never rebuilt.
    const atlas = acquireAtlas(plan, renderer);
    if (this.atlas || this.shapeContainers.length)
      this._retire(this.atlas, this.shapeContainers);
    this.atlas = atlas;
    this.atlasResolution = resolution;
    this.plan = plan;
    this._buildParticles(plan);
  }

  _place(
    particle,
    x,
    y,
    directionX,
    directionY,
    scale,
    mirror,
    pixelResolution,
    inversePixelResolution,
  ) {
    if (!particle) return;
    particle.x = snapCoordinate(x, pixelResolution, inversePixelResolution);
    particle.y = snapCoordinate(y, pixelResolution, inversePixelResolution);
    particle.rotation = Math.atan2(directionY, directionX);
    const drawn = scale / particle.bakeScale;
    particle.scaleX = drawn;
    particle.scaleY = drawn * mirror;
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
            /* The policy object is live, so a host may put anything here
               after construction validated it. An omitted cap is the world's
               width, never Infinity, or the offset below can be too. */
            const maxOffset = Number.isFinite(projection.maxOffset)
              ? Math.max(0, projection.maxOffset)
              : MAX_KNEE_OFFSET;
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
      let lastX = positions[base];
      let lastY = positions[base + 1];
      this.limbStroke.moveTo(lastX, lastY);
      for (let vertex = 2; vertex < LIMB_FLOATS; vertex += 2) {
        const x = positions[base + vertex];
        const y = positions[base + vertex + 1];
        /* The inside of a knee stacks its points on one corner, and a stroke
           divides by the length of every segment it is given. */
        if (x === lastX && y === lastY) continue;
        this.limbStroke.lineTo(x, y);
        lastX = x;
        lastY = y;
      }
      this.limbStroke.closePath();
    }
    const legPaint = this.model.legs.skin.limbPaint;
    this.limbStroke.stroke({
      color: legPaint.stroke,
      width: legPaint.strokeWidth,
      cap: "butt",
      join: "bevel",
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
      this.ribbonStroke.lineTo(positions[index * 4], positions[index * 4 + 1]);
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

  /* The atlas is tended before anything a caller can skip. It retires what
     the last rebake replaced and rebakes when the resolution moves, and a
     creature's own visibility decides neither: skipping that work strands a
     sheet nothing will destroy, or leaves frames baked for a resolution the
     renderer has left. Only the geometry below answers to `drawable`. */
  sync(state, renderer = null, drawable = true) {
    if (state.model !== this.model)
      throw new Error("render state model does not match Beefwife graphics");
    this._syncAtlas(renderer);
    if (!drawable) return;
    const pixelResolution =
      this.options.roundVertices === true
        ? (this.options.pixelResolution ?? 1)
        : 0;
    const inversePixelResolution =
      pixelResolution > 0 ? 1 / pixelResolution : 0;
    this._syncLimbs(state, pixelResolution, inversePixelResolution);
    this._syncRibbon(state, pixelResolution, inversePixelResolution);
    const legs = state.legs;
    for (let index = 0; index < this.footParticles.length; index++) {
      const offset = index * state.layout.legStride;
      this._place(
        this.footParticles[index],
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
    for (let index = 0; index < this.ornamentParticles.length; index++) {
      const offset = index * state.layout.ornamentStride;
      this._place(
        this.ornamentParticles[index],
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
    const plates = state.plates;
    for (let index = 0; index < this.plateParticles.length; index++) {
      const offset = index * state.layout.plateStride;
      this._place(
        this.plateParticles[index],
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
    this._flushRetired();
    const children = [
      ...this.shapeContainers,
      this.limbFill,
      this.limbStroke,
      this.ribbonFill,
      this.ribbonStroke,
    ];
    for (const child of children) {
      if (child) discard(this.parent, child);
    }
    releaseAtlas(this.atlas);
    this.atlas = null;
    this.parent.destroy();
  }
}

export default available ? Graphics : HeadlessGraphics;
