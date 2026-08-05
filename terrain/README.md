# Terrain

Terrain is a tiny, dependency-free browser utility for finding legal points and
collision-free paths around DOM elements. `build()` reads layout once; repeated
queries use only cached geometry.

```js
const terrain = new Terrain({ avoid: ".avoid" }).build();

const point = terrain.nearest(x, y);  // nearest legal point
const move = terrain.offset(x, y);    // additive correction
const points = terrain.route(a, b);   // collision-free waypoints
```

Terrain handles one viewport and axis-aligned DOM rectangles. It is not a
diagram framework, renderer, physics engine, or polygon navigator.

## Install

Load the standalone production build:

```html
<div data-terrain-avoid>Terrain routes around me.</div>
<script src="https://cdn.jsdelivr.net/npm/@kvmet/terrain@0.2.0/terrain.min.js"></script>
<script>
  const terrain = new Terrain().build();
</script>
```

`terrain.js` is the readable build and creates the same `window.Terrain` global.

With npm:

```sh
npm install @kvmet/terrain
```

```js
import Terrain from "@kvmet/terrain";
// const Terrain = require("@kvmet/terrain");
```

[Open the dependency-free demo](https://unpkg.com/@kvmet/terrain@0.2.0/demo.html)
or run `demo.html` directly.

## API

Call `build()` after page load and whenever relevant layout changes. It measures
each distinct avoided element once, replaces the prior snapshot, and returns the
Terrain instance. `terrain.ready` reports whether that snapshot contains
navigable space. A failed build leaves Terrain not ready.

### `nearest(x, y, result = {})`

Returns the nearest legal point represented by the mesh and its distance from
the requested coordinates:

```js
const point = terrain.nearest(x, y); // { x, y, distance }
```

The returned coordinates equal the requested coordinates and `distance` is zero
when the point is already legal. Reuse the optional `result` object to avoid
allocations in hot loops. Returns `null` when Terrain is not ready.

### `offset(x, y, result = {})`

Returns the additive displacement to the nearest legal point:

```js
const move = terrain.offset(x, y); // { dx, dy, distance }
if (move) {
  x += move.dx;
  y += move.dy;
}
```

`dx`, `dy`, and `distance` are zero when the point is already legal. The
optional `result` object and `null` behavior match `nearest()`.

### `route(a, b)`

Lands both endpoints when necessary, then returns the landed endpoints and any
required waypoints. Returns `null` when Terrain is not ready or no route exists.
Points must have finite `x` and `y` coordinates. A successful route is an array
of fresh waypoint objects with a `moved` boolean property. `moved` is true when
one or both requested endpoints had to be moved; the first and last waypoints
give their landed positions. Adjacent duplicate waypoints are omitted.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `avoid` | `"[data-terrain-avoid]"` | Selector, iterable of elements, or function returning an iterable. |
| `root` | `document` | The selector's `querySelectorAll()` root. |
| `viewport` | Browser viewport | `{ left, top, width, height }`, or a function returning one. |
| `edgeMargin` | `0` | Nonnegative inset from each viewport edge. |
| `obstaclePadding` | `0` | Nonnegative clearance around obstacles. |
| `funnel` | `true` | Keep only taut turns; false retains gate centers. |

Options are validated, snapshotted, and frozen. Functions are evaluated on every
`build()`. Defaults are exposed as `Terrain.DEFAULTS`.

`terrain.avoidElements()` resolves `avoid` without measuring it, which is useful
for observing the elements that the next build will read. Coordinates are local
to the configured viewport.

## Geometry

Obstacles are closed DOMRects. Overlapping rectangles and zero-width or
zero-height lines and points are supported. Generated mesh geometry sits two
adjacent floating-point values outside obstacle edges as a numerical guard
so it cannot occlude itself.

If you want visible clearance around obstacles use `obstaclePadding`.

Rotated rectangles, polygons, connector pins, crossing avoidance, and
incremental mutation are out of scope. Rebuild after layout changes.

## Performance

The production build is under 10 kB minified with no runtime dependencies. Only
elements resolved by `avoid` affect Terrain; the rest of the DOM is irrelevant.

If `m` elements are selected and `n` intersect the viewport, `build()` reads `m`
DOMRects and constructs its mesh from `n` rectangles. Legal point queries and
direct routes are roughly `O(n)`. Blocked routes also search the mesh, so they
scale with its cells and gates. Mesh construction is `O(n^2 log n)` in the worst
case; cells and gates can be `O(n^2)`. Terrain is designed for many queries per
build.

The demo includes an opt-in browser profiler. Run the deterministic 0 to 96
obstacle scaling benchmark with:

```sh
npm --prefix terrain install
bb terrain-benchmark
```

## Development

`terrain.js` and `terrain.min.js` are generated from `src/`; do not edit them
directly. Build and run the source, browser-artifact, and packed-consumer checks:

```sh
bb terrain
```

Terrain is released under the [MIT License](./LICENSE).
