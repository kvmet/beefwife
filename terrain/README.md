# Terrain

`terrain.js` caches keep-out DOMRects and the inset viewport, then answers two
questions without reading layout again:

- `terrain.at(x, y)` returns `{ dx, dy, d }` toward a legal point. All values
  are zero when the input is already legal.
- `terrain.route(a, b)` returns legal waypoints between the landed endpoints,
  or `null` when no route connects them.

Call `terrain.build()` after loading the page and after layout changes.

```html
<script src="terrain/terrain.js"></script>
```

```js
const terrain = new Terrain();
terrain.build();
```

## Routing

Routing uses a rectangular slab graph cut at the expanded left and right edges
of each keep-out. Because every keep-out is axis-aligned, every free cell is a
rectangle. This is not a general trapezoidal decomposition.

Routes keep `CLEAR` pixels from closed DOMRect edges. Gaps no wider than
`2 * CLEAR` are excluded from the graph. An unobstructed route contains only
its endpoints, including when `TERRAIN_CONFIG.funnel` is false.

The funnel is enabled by default. It keeps only route turns; disabling it
retains the center of every gate in the selected corridor.

## Checks

Run the deterministic headless test:

```sh
bb terrain
```
