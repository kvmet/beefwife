/** Minimal Pixi stand-in: the control for every Beefwife scene test. */

// Requiring this file installs global.PIXI, so it must load before beefwife.js.

class Container {
  constructor() {
    this.children = [];
    this.parent = null;
    this.destroyed = false;
  }

  addChild(...children) {
    for (const child of children) this.addChildAt(child, this.children.length);
    return children.at(-1);
  }

  addChildAt(child, index) {
    if (child.parent) child.parent.removeChild(child);
    this.children.splice(index, 0, child);
    child.parent = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parent = null;
    return child;
  }

  /* Pixi drops the transform objects here, so drawing to a destroyed child
     throws instead of quietly working. Keep that: it is what turns a
     use-after-destroy into a failing test. */
  destroy() {
    if (this.parent) this.parent.removeChild(this);
    this.destroyed = true;
    this.position = null;
    this.scale = null;
  }
}

class Graphics extends Container {
  constructor() {
    super();
    this.position = { set: (x, y) => ([this.x, this.y] = [x, y]) };
    this.scale = { set: (x, y) => ([this.scaleX, this.scaleY] = [x, y]) };
    this.points = [];
    this.fills = [];
    this.strokes = [];
    this._context = null;
  }

  /* Pixi subscribes the Graphics to its context here and unsubscribes the one
     it held before. `destroy` does not unsubscribe, so a context outliving the
     child keeps it alive; that asymmetry is the whole point of modelling it. */
  set context(context) {
    if (context === this._context) return;
    if (this._context) this._context.listeners.delete(this);
    this._context = context;
    context.listeners.add(this);
  }

  get context() {
    return this._context;
  }

  clear() {
    this.points = [];
    this.fills = [];
    this.strokes = [];
    return this;
  }
  moveTo(x, y) {
    this.points.push([x, y]);
    return this;
  }
  lineTo(x, y) {
    this.points.push([x, y]);
    return this;
  }
  arc() {
    return this;
  }
  closePath() {
    return this;
  }
  fill(value) {
    this.fills.push(value);
    return this;
  }
  stroke(value) {
    this.strokes.push(value);
    return this;
  }
}

class GraphicsPath {
  constructor(value) {
    if (value === "BAD") throw new Error("bad SVG path");
  }

  transform(matrix) {
    this.matrix = matrix;
    return this;
  }
}

class GraphicsContext {
  constructor() {
    this.fills = [];
    this.strokes = [];
    this.listeners = new Set();
  }
  path(value) {
    this.drawnPath = value;
    return this;
  }
  fill(value) {
    this.fills.push(value);
    return this;
  }
  stroke(value) {
    this.strokes.push(value);
    return this;
  }
}

/* Pixi validates geometry on the GPU, where a bad index reads garbage rather
   than throwing. These checks stand in for that: they are the only thing
   between a wrong triangle list and a test that still passes. */
class MeshGeometry {
  constructor(options) {
    this.positions = options.positions;
    this.indices = options.indices;
    this.uvs = options.uvs;
    if (this.uvs.length !== this.positions.length)
      throw new Error(
        `uvs length ${this.uvs.length} does not match positions ${this.positions.length}`,
      );
    const vertices = this.positions.length / 2;
    if (this.indices.length % 3)
      throw new Error(`indices length ${this.indices.length} is not triangles`);
    for (const index of this.indices) {
      if (!Number.isInteger(index) || index < 0 || index >= vertices)
        throw new Error(`index ${index} outside 0 to ${vertices - 1}`);
    }
    this.buffers = {
      aPosition: { updates: 0, update: () => this.buffers.aPosition.updates++ },
      aUV: { updates: 0, update: () => this.buffers.aUV.updates++ },
    };
  }

  destroy() {
    this.destroyed = true;
  }

  getBuffer(id) {
    if (!Object.hasOwn(this.buffers, id))
      throw new TypeError(`no buffer named ${id}`);
    return this.buffers[id];
  }

  get buffer() {
    return this.buffers.aPosition;
  }
}

class Mesh extends Container {
  constructor(options) {
    super();
    this.geometry = options.geometry;
  }

  // Pixi drops the reference without destroying the geometry behind it.
  destroy(options) {
    super.destroy(options);
    this.geometry = null;
  }
}

class Color {
  constructor(value) {
    if (value === "BAD") throw new Error("bad CSS color");
  }
}

global.PIXI = {
  Color,
  Container,
  Graphics,
  GraphicsContext,
  GraphicsPath,
  Matrix: class Matrix {
    constructor(a, b, c, d, tx, ty) {
      Object.assign(this, { a, b, c, d, tx, ty });
    }
  },
  Mesh,
  MeshGeometry,
  Texture: { WHITE: {} },
};

module.exports = {
  Color,
  Container,
  Graphics,
  GraphicsContext,
  GraphicsPath,
  Mesh,
  MeshGeometry,
};
