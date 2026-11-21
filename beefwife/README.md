# Beefwife

Beefwife simulates and draws one procedurally animated chain-body creature, a
beefwife, as a Pixi display object. A descriptor, plain JSON, defines its body,
gait, and look.

```js
import { Beefwife, Descriptor } from "@kvmet/beefwife";

const response = await fetch("slow-guy.json");
const descriptor = Descriptor.read(await response.json());
const beefwife = new Beefwife(descriptor, { position: { x: 200, y: 150 } });
app.stage.addChild(beefwife);

app.ticker.add((ticker) => {
  const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);
  beefwife.step(dt, { direction: { x: 1, y: 0.2 } });
});
```

Beefwife has no clock, routing, or page placement. You step it and you steer
it. To put creatures on a web page with none of that work, use
[`@kvmet/beefwife-canvas`](https://www.npmjs.com/package/@kvmet/beefwife-canvas).

## Install

```sh
npm install @kvmet/beefwife pixi.js
```

Or load the classic script after Pixi:

```html
<script src="https://cdn.jsdelivr.net/npm/pixi.js@8.23.0/dist/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@kvmet/beefwife@0.2.0/beefwife.min.js"></script>
```

| Entry | Use |
| --- | --- |
| `import` | `src/beefwife.mjs`. Exports `Beefwife` and `Descriptor`, and imports `pixi.js`, so a bundler gives the page and the library one copy. |
| `require`, `beefwife.min.js` | Classic script. Reads `window.PIXI` and adds one global, `Beefwife`, with the descriptor API at `Beefwife.Descriptor`. |
| `beefwife.js` | The classic script, unminified. |

Pixi 8.21.0 or newer is required. In earlier 8.x releases, destroying one
WebGPU renderer can break another. WebGL and WebGPU are both supported.

Without `window.PIXI`, the classic script still simulates. It creates no
display objects, so a server or a test gets poses without a renderer.

In Node, `require` and `import` load separate copies with separate `Beefwife`
classes, and `instanceof` fails between them. Use one form in a program.

### Samples

Nine descriptors ship under `samples/`: `bounding`, `chevron-guy`,
`long-girl`, `peristaltic`, `raccoon`, `reticulating`, `slow-guy`,
`the-worm`, and `undulating`.
`beefwife.example.json` uses every field. A CDN serves them without an install:

```text
https://cdn.jsdelivr.net/npm/@kvmet/beefwife@0.2.0/samples/slow-guy.json
```

## API

All coordinates are world pixels and all angles are radians. Invalid input
throws and changes nothing; no value is clamped.

### `new Beefwife(descriptor, options = {})`

Builds a creature from a descriptor. With Pixi present, this also rejects SVG
paths and colours that Pixi cannot parse, and shapes too large to draw.

| Option | Default | Meaning |
| --- | --- | --- |
| `position` | `{ x: 0, y: 0 }` | Where the head starts. |
| `direction` | `{ x: 1, y: 0 }` | Which way the head points. Any nonzero vector; it is normalized. |
| `phase` | `0` | Starting gait phase. |
| `random` | `Math.random` | A function returning numbers from 0 up to 1. The only source of variation, in leg proportions, step timing, and breathing. |
| `render` | See below | How the creature draws. |

`render` is kept, not copied, so a host can change its fields while the
creature runs.

| `render` field | Default | Meaning |
| --- | --- | --- |
| `roundVertices` | `false` | Snap vertices to the output pixel grid. |
| `pixelResolution` | `1` | Output pixels per world pixel, `1e-6` to `1e6`. Set it from the renderer resolution and update it when that changes. |
| `kneeProjection` | `null` | `{ centerX, centerY, perspective, maxOffset }`. Pushes each drawn knee away from the center by distance times knee height times `perspective`, up to `maxOffset` (default 256). Changes only the drawn knees. |

A `pixelResolution` that is changed to an invalid value is reported once,
after the render pass, and drawing continues at the last valid value.

### `step(dt, controls = {})`

Simulates `dt` seconds in fixed steps of 1/60 s. `dt` is never capped: one
second costs sixty steps. Cap it yourself, usually at one frame, so a tab that
resumes after a minute does not simulate the whole minute.

| Control | Default | Meaning |
| --- | --- | --- |
| `direction` | The last one given | The way the creature turns toward. |
| `throttle` | `1` | From 0 to 1. Scales gait speed, gait strength, and steering. At 0 the creature coasts to a stop. |

### `setDescriptor(descriptor)`

Changes the creature to a new descriptor and keeps as much of it as the new
descriptor allows. See [Edits keep the creature](#edits-keep-the-creature).

### `reset(options = {})`

Places the creature again with no motion. Takes `position`, `direction`, and
`phase`, which default to the current head, head direction, and gait phase. A
given `direction` also becomes the direction `step` uses when its control is
omitted.

### `translate({ x, y })`

Moves the whole creature and keeps its motion, gait, and steering. Use it to
wrap a creature around a world edge.

### `getPose()`

Returns `{ head, center, direction }`, each `{ x, y }`. `center` is the mean of
all chain points; `direction` is the unit vector the head points along. The
same object is refreshed after each change, so you can keep the reference.
Treat it as read-only.

### `restLength`

The chain's length at rest. `center` can trail the head by up to this
distance, so add it to the margin when you test whether a creature is in view.

### `descriptor`

The descriptor the creature is built from.

### `getBendResponse(into = [])`

Returns one `{ joint, commanded, delivered }` per inner chain joint: the bend
the gait asks for and the bend the body makes, positive to the left. Use it to
see what a `gait.bend` amplitude produces on a given body. Pass an array to
fill it instead of allocating a new one.

### `destroy()`

Frees every display object the creature owns and removes it from its parent.
Call it for each creature you drop; nothing else frees them. Afterwards `step`,
`setDescriptor`, `reset`, `translate`, and `getBendResponse` throw.
`descriptor` and the last pose stay readable.

### `error` event

A texture that fails to render is emitted as `error` on the creature. With no
listener, the error is thrown. The texture is tried again only after an edit,
a resolution change, or a renderer change.

### `Beefwife.MAX_WORLD_COORDINATE`

`1e9`. Positions, translations, and projection centers must be within this
distance of the origin on each axis. A creature that walks to the limit is
moved back inside it, motion included.

## Descriptor

`Descriptor` reads, checks, resizes, and writes descriptors. A bad descriptor
throws an `Error` whose message starts with the path of the bad field, such as
`$.legs.pairs: must be an integer (got 1.5)`. A bad argument throws one that
starts with the function's name, such as `scale: factor must be a finite number
greater than 0`. The format is in
[DESCRIPTOR.md](https://github.com/kvmet/beefwife/blob/main/beefwife/DESCRIPTOR.md).

| Member | Does |
| --- | --- |
| `parse(text)` | Parses JSON text and checks it. Returns a new descriptor. |
| `read(value)` | Checks a parsed value. Returns a new plain copy with keys in canonical order. |
| `repair(value)` | Like `read`, but drops or trims plates, ornaments, and legs that cannot be placed instead of throwing. Returns `{ descriptor, warnings }`, where each warning is `{ path, rule, repaired }`. For an editor's live preview: the input stays invalid, and `read` still rejects it. |
| `stringify(value, space = 2)` | Checks a descriptor and returns canonical JSON text. |
| `scale(descriptor, factor)` | Returns a copy resized by `factor`, with the same timing and feel. A field the result pushes out of range is an error. |
| `bounds(path)` | What the schema allows for one field. |
| `VERSION` | `1`, the schema version this release reads. |
| `LIMITS` | Size limits: `chunks`, `definitions`, `placements`, `instances`, `name`, `path`, and `pathTotal`. |
| `ID_PATTERN` | Pattern for definition ids. |
| `NAME_PATTERN` | Pattern for `name`. |

`bounds` names a field with dots, an array item with `[]`, and a record entry
with `*`. It lets an editor take a range from the schema instead of keeping a
second copy:

```js
Descriptor.bounds("legs.pairs");
// { kind: "number", min: 0, max: 128, integer: true, nullable: false }
Descriptor.bounds("chain.skin.ornaments[].side");
// { kind: "choice", values: ["left", "right", "both"], nullable: false }
Descriptor.bounds("definitions.paints.*.stroke.width");
// { kind: "number", min: 0, max: 1000, integer: false, nullable: false }
```

Every result has `kind` and `nullable`. Numbers add `min`, `max`, and
`integer`. Strings add `minLength`, `maxLength`, `pattern`, and `blankAllowed`.
Choices add `values`, objects add `fields`, arrays add `maxLength`, and records
add `minEntries`, `maxEntries`, and `keyPattern`. A few rules join several
fields and cannot show in one field's bounds; DESCRIPTOR.md lists them.

## Descriptors are values

A creature freezes the descriptor object it is given, and every creature given
the same object shares one compiled model. A cast of a thousand compiles once.
To change a descriptor, make a copy, change the copy, and pass it to
`setDescriptor`.

## Edits keep the creature

`setDescriptor` checks the new descriptor first. If it fails, the creature is
unchanged. A failed call may still have drawn from `random`.

A successful edit keeps position, motion, steering, and gait and breathing
phase. When a section gains or loses chunks, the chunks that remain keep their
place and motion, and new chunks start between their neighbours. Feet rebuild
only when the number of leg pairs changes, and ornament motion rebuilds only
when the list of ornaments changes. A change in breathing strength eases in
over at most 0.2 s.

Display objects are kept the same way. Only the ones the edit changes are
rebuilt, and old shapes keep moving with the body until their replacements are
ready.

## Rendering

`Beefwife` extends `PIXI.Container`. Add it to a stage and render the stage;
the creature updates its display objects in Pixi's render pass. Its own parts
sit in one child container, so children you add to it keep the order you give
them. The library owns two inherited properties: `label` holds the
descriptor's `name`, and `onRender` draws the creature. Put your own label or
render callback on a parent.

Drawing order, back to front:

1. Feet, then legs.
2. `under` ornaments, in descriptor order.
3. The ribbon, then plates from tail to head.
4. `over` ornaments, in descriptor order.

Feet, plates, and ornaments are drawn from one texture sheet per look and
renderer. The sheet is at most 2048 × 2048 texels and each shape at most
1024 × 1024. When a creature's shapes do not fit, all of them draw at lower
detail; size and position do not change.

## Development

`beefwife.js` and `beefwife.min.js` are generated from `src/` by `npm run
build`; do not edit them directly. From the repository root:

```sh
bb descriptor        # schema
bb beefwife-model    # descriptor compilation
bb beefwife-api      # public API
bb beefwife-package  # build, then check the packed package
bb test              # every headless suite
```

Beefwife is released under the
[Mozilla Public License 2.0](https://github.com/kvmet/beefwife/blob/main/beefwife/LICENSE).
