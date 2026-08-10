# BeefwifeCanvas

`BeefwifeCanvas` mounts the Beefwife runtime into a canvas that belongs to the
page. The canvas can have any ID, class, layout, or stacking rules; the API only
looks for `data-beefwife-canvas` when auto-mounting.

```html
<canvas
  id="my-beefwives"
  data-beefwife-canvas
  data-beefwife-manifest="beefwives/manifest.json"
  data-beefwife-count="8"
  data-beefwife-resolution-scale="0.25"
  data-beefwife-image-rendering="pixelated"
  data-beefwife-round-vertices="true"
  data-beefwife-antialias="false"
  data-beefwife-simulation-fps="60"
  data-beefwife-draw-fps="24"
  data-beefwife-target-mode="wander"
  data-beefwife-pointer-input="click"
  data-beefwife-wander-delay="4"
  data-beefwife-knee-projection-center="canvas"
></canvas>
```

Load Pixi 8, then the runtime. `bb bundle` writes `dist/beefwife-canvas.js`, one
file whose only global is `BeefwifeCanvas`:

```html
<script src="pixi.min.js"></script>
<script src="dist/beefwife-canvas.js"></script>
```

The integrated development example is in
[`examples/beefwife-canvas`](../examples/beefwife-canvas/).

Without the bundle, load the runtime files in this order; each one then
declares its file-level names in shared script scope.
`beefwife-canvas.js` auto-mounts every marked canvas after the DOM is ready.
Listen for `beefwifecanvasready` or `beefwifecanvaserror`, await the `ready`
promise on a handle returned by `BeefwifeCanvas.get(canvas)`, or inspect
`data-beefwife-state`, whose values are `loading`, `ready`, `running`, `paused`,
`stopped`, `error`, and `destroyed`. A paused canvas also exposes
`data-beefwife-pause-reason` as `hidden`, `offscreen`, or `zero-size`. A mount
that fails dispatches the error event, cleans
itself up, and leaves the canvas in the `error` state, ready to mount again.
The mounted handle exposes the same information through its read-only `state`
and `pauseReason` getters; `pauseReason` is `null` unless state is `paused`.

`BeefwifeCanvas.scan()` mounts any currently unmounted
`canvas[data-beefwife-canvas]` elements. The initial document is scanned
automatically; call `scan()` after adding declarative canvases dynamically.
Already mounted canvases are left alone.

```html
<script src="pixi.min.js"></script>
<script src="terrain/terrain.js"></script>
<script src="beefwife/beefwife.js"></script>
<script src="beefwife-canvas/beefwife-canvas-path.js"></script>
<script src="beefwife-canvas/beefwife-canvas-steering.js"></script>
<script src="beefwife-canvas/beefwife-canvas-actor.js"></script>
<script src="beefwife-canvas/beefwife-canvas-options.js"></script>
<script src="beefwife-canvas/beefwife-canvas-targeting.js"></script>
<script src="beefwife-canvas/beefwife-canvas-population.js"></script>
<script src="beefwife-canvas/beefwife-canvas-render.js"></script>
<script src="beefwife-canvas/beefwife-canvas-scene.js"></script>
<script src="beefwife-canvas/beefwife-canvas-runtime.js"></script>
<script src="beefwife-canvas/beefwife-canvas-cast.js"></script>
<script src="beefwife-canvas/beefwife-canvas-mount-options.js"></script>
<script src="beefwife-canvas/beefwife-canvas.js"></script>
```

The manifest is deliberately small and versioned. Relative source URLs are
resolved from the manifest URL. Weights affect random spawning, not loading.

```json
{
  "schemaVersion": 1,
  "sources": ["slug-a.json", { "src": "slug-b.json", "weight": 3 }]
}
```

`manifest`, `sources`, and `descriptors` are additive when more than one is
provided. Programmatic `manifest` may be either a manifest URL or the parsed
manifest object. `sources` accepts one descriptor URL, one `{ src, weight }`
entry, or an array of either. `descriptors` likewise accepts one descriptor,
one `{ descriptor, weight }` entry, or an array. Declarative attributes support
a manifest URL and a comma-separated source URL list; parsed descriptors are
JavaScript-only. Every resulting descriptor name must be unique across all
inputs or the mount fails atomically. When `count` is omitted it defaults to
the number of unique descriptors, with weighted names sampled with replacement.

JavaScript options override attributes and can supply already-parsed
descriptors or arbitrary caller-owned Pixi filters. Omit `data-beefwife-canvas`
when mounting programmatically so auto-mount and programmatic mount do not race.

```js
const canvas = document.querySelector("#programmatic-beefwives");
const runtime = await BeefwifeCanvas.mount(canvas, {
  descriptors: [descriptorA, { descriptor: descriptorB, weight: 3 }],
  filters: [new PIXI.NoiseFilter({ noise: 0.08 })],
  targetMode: "manual",
  pointerInput: "none",
});

runtime.setTarget({ x: 300, y: 180 });
runtime.getActors()[0].setTarget({ x: 80, y: 120 });
```

`mount` resolves a frozen runtime handle. `BeefwifeCanvas.get(canvas)` and the
`detail.controller` of either lifecycle event return the same handle while the
event is being dispatched. A failed handle is released after its error event,
so `get(canvas)` then returns `null` and a new mount can begin.

The lifecycle methods are `start()`, `stop()`, `destroy()`, `setCount(count)`,
`setTimeScale(scale)`, `setTarget(point)`, `clearTarget()`,
`setTargetMode(mode)`, `setPointerInput(input)`, `setDebug(flags)`,
`refreshTerrain()`, `respawn()`, and `getActors()`.
`getActors()` returns frozen Canvas control handles with stable `id` and `name`
fields plus `getPose()`, target, mode, and respawn methods; it does not expose
the host's mutable actor or route objects.
Targets and poses use canvas-local CSS pixels. Target policy and DOM input are
independent. `targetMode` is `wander` or `manual`; `pointerInput` is `none`,
`click`, or `move`. A click or pointer movement merely supplies a target and
does not change what happens after arrival. In `manual`, every supplied target
produces one finite route and the beefwife then stops until another target is
supplied. In `wander`, the host waits a random duration from zero through
`wanderDelay` seconds before supplying another target. `move` retains its last
destination after the pointer leaves the canvas. The host chooses goals and
Beefwife only receives its usual direction and throttle controls. Attribute
values are read once. Use the methods for live changes.

`destroy()` removes the scene and runtime listeners but leaves the author's
canvas in place. One dormant Pixi renderer is retained weakly per canvas so the
same element can be remounted without tearing down and recreating its WebGL
context. The renderer becomes collectible with the canvas. `antialias` is fixed
for the life of that renderer, so a remount cannot change it.

Performance and appearance options are `resolutionScale`, `roundVertices`,
`antialias`, `simulationFps`, `drawFps`, `maxPixelRatio`, `imageRendering`,
`kneePerspective`, `maxKneeOffset`, `kneeProjectionCenter`, and programmatic
`filters`. Knee perspective affects leg-knee rendering only; planted feet and
the simulated body are unchanged. `kneeProjectionCenter` is
`canvas` by default; `viewport` makes separate canvases share one apparent
knee-projection field. `resolutionScale` accepts 0.125 through 1 and defaults
to 0.25, where quarter resolution costs a sixteenth of the fill work. When
vertex rounding is enabled, vertices snap to pixels at the effective renderer
resolution, including device pixel ratio and `resolutionScale`.
`imageRendering` independently selects `pixelated` (the default) or `auto`,
allowing either interpolation style at any resolution. For color effects, pass
a configured `PIXI.ColorMatrixFilter` in `filters`.

Debug rendering is off by default. The boolean options `debugTargets`,
`debugRoutes`, and `debugTerrain` show destination crosshairs, waypoint paths,
and avoidance bounds, respectively. Their declarative forms are
`data-beefwife-debug-targets`, `data-beefwife-debug-routes`,
and `data-beefwife-debug-terrain`. Toggle layers after mounting with a partial
update:

```js
runtime.setDebug({ targets: true, routes: true });
runtime.setDebug({ routes: false, terrain: true });
```

Terrain draws below the beefwives; routes and targets draw above them. These
layers are diagnostic and do not affect routing or simulation.

Simulation and routing options are `timeScale`, `wanderDelay`, `edgeMargin`,
`obstaclePadding`, `waypointRadius`, `arrivalRadius`, `throttleEase`,
`stuckReplanSeconds`, and `escapeReplanSeconds`. `waypointRadius` controls how
closely an intermediate corner must be followed, while `arrivalRadius`
controls final-target satisfaction; both default to 10 CSS pixels.
`wanderDelay` defaults to 4 seconds and may be zero.
`avoid` defaults to `.beefwife-avoid`, `edgeMargin` defaults to 25, and
`obstaclePadding` defaults to zero CSS pixels. Call
`refreshTerrain()` after transform-only obstacle movement because a
`ResizeObserver` cannot see it. `pauseHidden` and `pauseOffscreen` default to
true.

Avoidance and visual occlusion are independent. `avoid` changes routing. To
make beefwives appear to walk behind a widget, place that DOM element above the
canvas in normal stacking order. A widget may be an avoid element, an
occluder, both, or neither; no Pixi mask is needed for ordinary DOM occlusion.
