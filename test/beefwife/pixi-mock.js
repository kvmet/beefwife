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

  destroy() {
    if (this.parent) this.parent.removeChild(this);
    this.destroyed = true;
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

  transform() {
    return this;
  }
}

class GraphicsContext {
  path() {
    return this;
  }
  fill() {
    return this;
  }
  stroke() {
    return this;
  }
}

class MeshGeometry {
  constructor(options) {
    this.positions = options.positions;
    this.buffer = { updates: 0, update: () => this.buffer.updates++ };
  }

  getBuffer() {
    return this.buffer;
  }
}

class Mesh extends Container {
  constructor(options) {
    super();
    this.geometry = options.geometry;
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
  Matrix: class Matrix {},
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
