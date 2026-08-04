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
  data-beefwife-round-vertices="true"
  data-beefwife-antialias="false"
  data-beefwife-simulation-fps="60"
  data-beefwife-draw-fps="24"
  data-beefwife-targeting="wander"
  data-beefwife-wander-delay="4"
  data-beefwife-projection-center="canvas"
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
`data-beefwife-state`, whose values are `loading`, `ready`, `running`, `stopped`,
`error`, and `destroyed`. A mount that fails dispatches the error event, cleans
itself up, and leaves the canvas in the `error` state, ready to mount again.

```html
<script src="pixi.min.js"></script>
<script src="terrain/terrain.js"></script>
<script src="beefwife/beefwife-descriptor.js"></script>
<script src="beefwife/beefwife-model.js"></script>
<script src="beefwife/beefwife-drive.js"></script>
<script src="beefwife/beefwife-body.js"></script>
<script src="beefwife/beefwife-legs.js"></script>
<script src="beefwife/beefwife-skin.js"></script>
<script src="beefwife/beefwife-graphics.js"></script>
<script src="beefwife/beefwife.js"></script>
<script src="beefwife-canvas/beefwife-canvas-path.js"></script>
<script src="beefwife-canvas/beefwife-canvas-steering.js"></script>
<script src="beefwife-canvas/beefwife-canvas-actor.js"></script>
<script src="beefwife-canvas/beefwife-canvas-options.js"></script>
<script src="beefwife-canvas/beefwife-canvas-targeting.js"></script>
<script src="beefwife-canvas/beefwife-canvas-render.js"></script>
<script src="beefwife-canvas/beefwife-canvas-runtime.js"></script>
<script src="beefwife-canvas/beefwife-canvas-cast.js"></script>
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

JavaScript options override attributes and can supply already-parsed
descriptors or arbitrary caller-owned Pixi filters. Omit `data-beefwife-canvas`
when mounting programmatically so auto-mount and programmatic mount do not race.

```js
const canvas = document.querySelector("#programmatic-beefwives");
const runtime = await BeefwifeCanvas.mount(canvas, {
  descriptors: [descriptorA, { descriptor: descriptorB, weight: 3 }],
  filters: [new PIXI.NoiseFilter({ noise: 0.08 })],
  targeting: "manual",
});

runtime.setTarget({ x: 300, y: 180 });
runtime.getBeefwives()[0].setTarget({ x: 80, y: 120 });
```

`mount` resolves a frozen runtime handle. `BeefwifeCanvas.get(canvas)` and the
`detail.controller` of either lifecycle event return the same handle while the
event is being dispatched. A failed handle is released after its error event,
so `get(canvas)` then returns `null` and a new mount can begin.

The lifecycle methods are `start()`, `stop()`, `destroy()`, `setCount(count)`,
`setTimeScale(scale)`, `setTarget(point)`, `clearTarget()`,
`setTargeting(mode)`, `setDebug(flags)`, `refreshTerrain()`, `respawn()`, and
`getBeefwives()`.
Targets and poses use canvas-local CSS pixels. Targeting modes are `wander`,
`click`, `pointer`, and `manual`. Every supplied target produces one finite
route. When that route is spent, the beefwife is satisfied and stops; another
click, pointer movement, or `setTarget()` call supplies the next target.
`pointer` retains its last destination after leaving the canvas. In `wander`,
the host waits a random duration from zero through `wanderDelay` seconds after
arrival before supplying another target. The host chooses goals and Beefwife
only receives its usual direction and throttle controls. Attribute values are
read once. Use the methods for live changes.

`destroy()` removes the scene and runtime listeners but leaves the author's
canvas in place. One dormant Pixi renderer is retained weakly per canvas so the
same element can be remounted without tearing down and recreating its WebGL
context. The renderer becomes collectible with the canvas. `antialias` is fixed
for the life of that renderer, so a remount cannot change it.

Performance and appearance options are `resolutionScale`, `roundVertices`,
`antialias`, `simulationFps`, `drawFps`, `maxPixelRatio`, `perspective`,
`maxJointOffset`, `projectionCenter`, and programmatic `filters`.
`projectionCenter` is `canvas` by default; `viewport` makes separate canvases
share one apparent projection field. `resolutionScale` defaults to 0.25, its
minimum: quarter resolution costs a sixteenth of the fill work, and upscaled
with pixelated rendering it is also the intended look. Raising it toward 1
trades both for smoothness. For color effects, pass a configured
`PIXI.ColorMatrixFilter` in `filters`.

Debug rendering is off by default. The boolean options `debugTargets`,
`debugRoutes`, `debugTerrain`, and `debugNavigation` show destination
crosshairs, waypoint paths, avoidance bounds, and navigation cells and gates,
respectively. Their declarative forms are
`data-beefwife-debug-targets`, `data-beefwife-debug-routes`,
`data-beefwife-debug-terrain`, and `data-beefwife-debug-navigation`. Toggle
layers after mounting with a partial update:

```js
runtime.setDebug({ targets: true, routes: true });
runtime.setDebug({ routes: false, terrain: true, navigation: true });
```

Terrain and navigation draw below the beefwives; routes and targets draw above
them. These layers are diagnostic and do not affect routing or simulation.

Simulation and routing options are `timeScale`, `wanderDelay`, `edgeMargin`,
`obstaclePadding`, `arrivalRadius`, `throttleEase`, `stuckReplanSeconds`, and
`escapeReplanSeconds`. `wanderDelay` defaults to 4 seconds and may be zero.
`avoid` is a selector for obstacle elements and defaults to
`.beefwife-avoid`. Call
`refreshTerrain()` after transform-only obstacle movement because a
`ResizeObserver` cannot see it. `pauseHidden` and `pauseOffscreen` default to
true.

Avoidance and visual occlusion are independent. `avoid` changes routing. To
make beefwives appear to walk behind a widget, place that DOM element above the
canvas in normal stacking order. A widget may be an avoid element, an
occluder, both, or neither; no Pixi mask is needed for ordinary DOM occlusion.
