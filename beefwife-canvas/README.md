# BeefwifeCanvas

BeefwifeCanvas fills a `<canvas>` on your page with beefwives: procedurally
animated creatures that wander the canvas and walk around the elements you
mark. Add the canvas, name the creatures, and load two scripts:

```html
<canvas
  data-beefwife-canvas
  data-beefwife-sources="
    https://cdn.jsdelivr.net/npm/@kvmet/beefwife@0.1.0/samples/slow-guy.json,
    https://cdn.jsdelivr.net/npm/@kvmet/beefwife@0.1.0/samples/long-girl.json"
></canvas>

<script src="https://cdn.jsdelivr.net/npm/pixi.js@8.23.0/dist/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@kvmet/beefwife-canvas@0.1.0/beefwife-canvas.min.js"></script>
```

The canvas stays yours. Give it any id, class, size, or stacking order;
BeefwifeCanvas reads only its `data-beefwife-*` attributes.

## Install

From a CDN, use the two scripts above. With npm:

```sh
npm install @kvmet/beefwife-canvas pixi.js
```

```js
import BeefwifeCanvas from "@kvmet/beefwife-canvas";
```

| File | Use |
| --- | --- |
| `beefwife-canvas.min.js` | Classic script. Reads `window.PIXI` and adds one global, `BeefwifeCanvas`. |
| `beefwife-canvas.js` | The same script, unminified. |
| `beefwife-canvas.mjs` | Module. Imports `pixi.js`, so a bundler gives the page and the runtime one copy. |

Every entry mounts each `canvas[data-beefwife-canvas]` once the DOM is ready,
so an import with no other code is enough. `@kvmet/beefwife` and
`@kvmet/terrain` are bundled in.

Pixi 8.21.0 or newer is required. In earlier 8.x releases, destroying one
WebGPU renderer can break another.

## Creatures

A creature is a descriptor: one JSON file that defines its body, gait, and
look. `@kvmet/beefwife` ships seven under `samples/`: `bounding`,
`chevron-guy`, `long-girl`, `peristaltic`, `reticulating`, `slow-guy`, and
`undulating`. The format is in
[DESCRIPTOR.md](https://github.com/kvmet/beefwife/blob/main/beefwife/DESCRIPTOR.md).

Three options supply descriptors. Use any mix; they add together.

| Option | Accepts |
| --- | --- |
| `sources` | A descriptor URL, a `{ src, weight }` entry, or an array of either. The attribute takes a comma-separated list of URLs. |
| `manifest` | The URL of a manifest. From JavaScript, also the parsed manifest object. |
| `descriptors` | JavaScript only. A parsed descriptor, a `{ descriptor, weight }` entry, or an array of either. |

A manifest lists sources in one file:

```json
{
  "schemaVersion": 1,
  "sources": ["slow-guy.json", { "src": "long-girl.json", "weight": 3 }]
}
```

Relative URLs in a manifest resolve against the manifest's URL. Other URLs
resolve against the page.

`weight` defaults to 1 and sets how often a creature is picked when one
spawns. It does not change what loads. `count` defaults to the number of
descriptors. Each descriptor's `name` must be unique across all inputs, or the
mount fails.

## Mount from JavaScript

Leave `data-beefwife-canvas` off a canvas you mount yourself, so the automatic
mount does not race yours:

```js
const canvas = document.querySelector("#beefwives");
const beefwives = await BeefwifeCanvas.mount(canvas, {
  descriptors: [descriptorA, { descriptor: descriptorB, weight: 3 }],
  filters: [new PIXI.NoiseFilter({ noise: 0.08 })],
  targetMode: "manual",
});

beefwives.setTarget({ x: 300, y: 180 });
beefwives.getActors()[0].setTarget({ x: 80, y: 120 });
```

JavaScript options override attributes. Attributes are read once, at mount;
use the handle's methods for live changes.

## Options

Each option has an attribute: `data-beefwife-` and the option name in kebab
case, so `drawFps` is `data-beefwife-draw-fps`. Boolean attributes take `true`
or `false`. JavaScript-only options are marked. An unknown option or attribute
fails the mount. Distances are CSS pixels.

### Population and movement

| Option | Default | Meaning |
| --- | --- | --- |
| `count` | Number of descriptors | Creatures on the canvas, 0 to 1024. |
| `targetMode` | `"wander"` | `wander`: after each arrival, wait and pick a new target. `manual`: stop at each target until given another. |
| `pointerInput` | `"none"` | `click`: a click sets the target. `move`: the pointer is the target, and its last position stays the target after it leaves. |
| `wanderDelay` | `4` | Longest wait in seconds before a wandering creature picks a new target. Each wait is random, from 0 to this. |
| `timeScale` | `1` | Simulated seconds per real second, 0 to 16. |
| `autoStart` | `true` | Run once ready. `false` leaves the canvas `stopped` until `start()`. |
| `random` | `Math.random` | JavaScript only. A function returning numbers from 0 up to 1. Drives spawning, wandering, and creature variation. |

### Avoidance

| Option | Default | Meaning |
| --- | --- | --- |
| `avoid` | `".beefwife-avoid"` | Selector for the elements creatures route around. |
| `edgeMargin` | `25` | Clear space kept inside each canvas edge. |
| `obstaclePadding` | `0` | Clear space kept around each avoided element. |
| `waypointRadius` | `10` | Distance from a route corner that counts as reaching it. Above 1. |
| `arrivalRadius` | `10` | Distance from the target that counts as arriving. Above 1. |
| `throttleEase` | `4` | Rate per second at which a creature's speed settles to what its route asks for. |
| `stuckReplanSeconds` | `120` | Seconds without reaching a waypoint before a creature drops its route. |
| `escapeReplanSeconds` | `7` | The same limit for a creature caught inside an avoided area or past an edge. |

### Rendering

| Option | Default | Meaning |
| --- | --- | --- |
| `resolutionScale` | `0.25` | Render resolution against CSS pixels, 0.125 to 1. At 0.25 the renderer fills a sixteenth of the pixels. |
| `imageRendering` | `"pixelated"` | How the canvas is scaled up: `pixelated` or `auto`. |
| `roundVertices` | `true` | Snap vertices to the renderer's pixel grid, device pixel ratio included. |
| `antialias` | `false` | Fixed for the life of the canvas's renderer. A remount cannot change it. |
| `maxPixelRatio` | `2` | Upper limit on `devicePixelRatio`. |
| `filters` | None | JavaScript only. Pixi filters for the whole scene, such as a `PIXI.ColorMatrixFilter`. |
| `kneePerspective` | `0.002` | Pushes each drawn knee away from the projection center, by distance times knee height times this. `0` turns it off. |
| `maxKneeOffset` | `256` | Upper limit on that push, in pixels. |
| `kneeProjectionCenter` | `"canvas"` | `canvas`: center the projection on each canvas. `viewport`: center it on the window, so separate canvases share one. |
| `simulationFps` | `60` | Simulation updates per second, 1 to 240. |
| `drawFps` | `24` | Draws per second, 1 to 240, limited to `simulationFps`. `0` means match `simulationFps`. |

Knee perspective changes only the drawn knees. Feet and bodies stay where the
simulation puts them.

### Pausing and debug

| Option | Default | Meaning |
| --- | --- | --- |
| `pauseHidden` | `true` | Pause while the tab is hidden. |
| `pauseOffscreen` | `true` | Pause while the canvas is out of view. |
| `debugTargets` | `false` | Draw a crosshair at each target. |
| `debugRoutes` | `false` | Draw each route's waypoints. |
| `debugTerrain` | `false` | Draw the avoided areas, padding included. |

Debug layers draw at the canvas's render resolution and do not change routing
or simulation. To draw your own overlay instead, read `getTerrainView()` and
each creature handle's `getRoute()` and `getTarget()`.

## API

### `BeefwifeCanvas.mount(canvas, options = {})`

Mounts the canvas and returns a promise of its handle. Rejects when the canvas
already has a handle, an option is invalid, or a descriptor fails to load or
validate.

### `BeefwifeCanvas.get(canvas)`

Returns the canvas's handle, or `null`.

### `BeefwifeCanvas.scan()`

Mounts each `canvas[data-beefwife-canvas]` that has no handle. The page is
scanned once on load; call `scan()` after you add marked canvases.

### `BeefwifeCanvas.Descriptor`

The `Descriptor` API from `@kvmet/beefwife`, for reading, checking, and
resizing descriptors without a second script.

### Handle

Coordinates are canvas-local CSS pixels. Methods that change something return
the handle. After `destroy()`, every method throws.

| Member | Does |
| --- | --- |
| `start()`, `stop()` | Run or stop the canvas. A stopped canvas does not resume when it comes back into view. |
| `destroy()` | Remove the scene and listeners. See [Lifecycle](#lifecycle). |
| `setCount(count)` | Add or remove creatures. |
| `setTimeScale(scale)` | Change `timeScale`. |
| `setTarget({ x, y })` | Send every creature to a point. |
| `clearTarget()` | Drop every creature's target. |
| `setTargetMode(mode)` | `"wander"` or `"manual"`. |
| `setPointerInput(input)` | `"none"`, `"click"`, or `"move"`. |
| `setDebug(flags)` | Turn debug layers on or off: `{ targets, routes, terrain }`. Omitted layers keep their state. |
| `respawn()` | Place every creature again. |
| `refreshTerrain()` | Measure the avoided elements now. See [Avoidance and occlusion](#avoidance-and-occlusion). |
| `getActors()` | One creature handle per creature. |
| `getTerrainView()` | `{ bounds, rectangles }` from the last measurement: the walkable area inside `edgeMargin`, and each avoided element with its padding. Each is `{ left, top, right, bottom }`. |
| `getStats()` | See [Performance](#performance). |
| `state` | The canvas state. See [Lifecycle](#lifecycle). |
| `pauseReason` | `"hidden"`, `"offscreen"`, or `"zero-size"` while `state` is `"paused"`, else `null`. |
| `ready` | The promise that `mount` returned. |

### Creature handle

`getActors()` returns frozen handles. A creature keeps the same handle, with a
stable `id` and its descriptor's `name`, for as long as it lives.

| Member | Does |
| --- | --- |
| `getPose()` | `{ head, center, direction }`, each `{ x, y }`. `direction` is a unit vector. |
| `getRoute()` | The waypoints left on its route. |
| `getTarget()` | Its target, or `null`. |
| `setTarget({ x, y })`, `clearTarget()` | Set or drop its target. |
| `setTargetMode(mode)` | `"wander"` or `"manual"`, for this creature. |
| `respawn()` | Place it again. |
| `setDescriptor(descriptor)` | Change it to another descriptor in place. It keeps its position and motion. |

The `get` methods return copies.

## Lifecycle

`handle.state` and the canvas's `data-beefwife-state` attribute hold one of
`loading`, `ready`, `running`, `paused`, `stopped`, `error`, or `destroyed`.
While paused, `data-beefwife-pause-reason` holds the reason.

The canvas dispatches two events, each with the handle as
`event.detail.controller`:

- `beefwifecanvasready` when the mount succeeds.
- `beefwifecanvaserror` when the mount or a later render fails. The error is
  `event.detail.error`.

A failure stops the canvas and cleans it up, leaving it in `error`. After the
event, `get(canvas)` returns `null` and the canvas can be mounted again.

`destroy()` removes the scene and listeners and leaves the canvas element in
place. While the element stays in the page, its renderer is kept, so mounting
it again reuses the GPU context. When a destroyed canvas leaves the page, its
renderer is released and that element cannot be mounted again; mount a new
canvas. A canvas removed without `destroy()` keeps its renderer and GPU context
for the life of the page, so call `destroy()` when you remove one.

## Avoidance and occlusion

Avoidance and occlusion are separate. `avoid` changes where creatures walk. To
make them walk behind an element, stack that element above the canvas. An
element can be avoided, stacked above, both, or neither.

Avoided elements are measured again when the window resizes, when an avoided
element or the canvas resizes, and when a window scroll moves an avoided
element against the canvas. Call `refreshTerrain()` after a change the runtime
cannot see: a CSS transform, or a scroll inside a nested scroll container.

## Performance

`drawFps` and `resolutionScale` are the main controls. Each lowers cost
without changing how creatures move.

`simulationFps` saves little. The simulation runs fixed steps, so a simulated
second costs the same however updates are grouped; at 400 creatures, 10 against
60 saves 8% of the simulation cost. Fewer updates also steer more coarsely, so
creatures take different paths. To spend less on simulation, lower
`timeScale`: creatures move slower.

A page that cannot keep up with `simulationFps` plays slower but follows the
same paths.

`getStats()` reports the last whole second: `actors`, `steps` and `draws` per
second, and `stepMs` and `drawMs`, the mean cost of one simulation update and
one draw. Both times are main-thread work only; GPU time is not included.

## Development

`beefwife-canvas.js`, `beefwife-canvas.min.js`, and `beefwife-canvas.mjs` are
generated from `src/` by `npm run build`; do not edit them directly. From the
repository root:

```sh
bb canvas          # public API
bb canvas-runtime  # routing and runtime
bb canvas-package  # build, then check the packed package
```

[`examples/beefwife-canvas`](https://github.com/kvmet/beefwife/tree/main/examples/beefwife-canvas)
is a page with every feature wired up.

BeefwifeCanvas is released under the
[Mozilla Public License 2.0](https://github.com/kvmet/beefwife/blob/main/beefwife-canvas/LICENSE).
