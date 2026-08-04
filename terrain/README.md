# Terrain

Terrain caches a CSS-pixel viewport and axis-aligned keep-out rectangles. After
one layout-reading build, it can land points and route between them without
reading the DOM again.

It is a small browser script with no dependencies:

```html
<script src="terrain/terrain.js"></script>
<script>
  const terrain = new Terrain();
  terrain.build();
</script>
```

The script creates `window.Terrain` when loaded directly. It also supports
CommonJS:

```js
const Terrain = require("./terrain/terrain.js");
```

## Constructor

`new Terrain(options)` snapshots and freezes these options:

| Option | Default | Meaning |
| --- | --- | --- |
| `avoid` | `".beefwife-avoid"` | A selector, an iterable of elements, or a function returning an iterable. |
| `root` | `document` | The `querySelectorAll()` root used when `avoid` is a selector. |
| `viewport` | Browser viewport | `{ left, top, width, height }`, or a function returning one. `left` and `top` default to zero. |
| `edgeMargin` | `25` | Nonnegative inset from every viewport edge. |
| `obstaclePadding` | `0` | Nonnegative amount added around every obstacle. |
| `funnel` | `true` | Keep only taut route turns. `false` retains each selected gate center. |

Functions are evaluated on every `build()`, which supports moving viewports and
changing element sets. Unknown options and invalid values throw. Defaults are
available as the frozen `Terrain.DEFAULTS` object.

`terrain.avoidElements()` resolves the current `avoid` source and returns an
array without measuring its elements. This is useful when the caller observes
the same elements that terrain will measure on its next build.

Viewport-local coordinates are used throughout. For a viewport at
`{ left: 100, top: 200 }`, an element whose DOMRect begins at `(110, 220)` begins
at terrain coordinate `(10, 20)`.

## Lifecycle

Call `build()` after the page loads and whenever relevant layout changes. It
returns the terrain instance. A build measures each distinct selected element
once and replaces the complete prior snapshot. If measurement fails, the old
snapshot is discarded and the terrain remains not ready.

`terrain.ready` is `true` when the latest successful build contains somewhere
to land. It is `false` before the first build and when the viewport has no
navigable area. Queries return `null` while it is false.

## Landing

`terrain.at(x, y, result = {})` leaves a legal point in place or returns a field
toward the nearest landing represented by the free-space mesh:

```js
const field = terrain.at(x, y);
if (field) {
  const landed = {
    x: x + field.dx * field.d,
    y: y + field.dy * field.d,
  };
}
```

`dx` and `dy` are a unit direction and `d` is the distance. All three are zero
when `(x, y)` is already legal. The optional `result` object is written in place
to avoid an allocation. Coordinates must be finite numbers.

## Routing

`terrain.route(a, b)` accepts point-like objects with finite `x` and `y` values.
It lands both inputs, then returns an array containing the landed endpoints and
any necessary waypoints. It returns `null` when no route exists.

Routing uses a rectangular slab graph cut just outside the left and right edges
of each keep-out. Generated geometry is moved two adjacent floating-point values
outward so it cannot lie on, and therefore occlude itself against, a closed
DOMRect edge. This numerical guard is not a visible offset or a
minimum-clearance policy: an input point or unobstructed direct segment is legal
anywhere outside the closed rectangles, and gaps larger than floating-point
roundoff remain in the mesh. Use `obstaclePadding` when real geometric clearance
is required. Overlapping rectangles and zero-width or zero-height lines and
points are supported. This is an axis-aligned DOMRect router, not a general
polygon or trapezoidal decomposition.

## Check

Run the deterministic API and geometry test:

```sh
bb terrain
```
