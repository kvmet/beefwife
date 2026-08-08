# Beefwife

`beefwife-descriptor.js` is the schema-v1 authority for a beefwife's portable JSON
contract. Version 1 deliberately accepts no older descriptor shapes or field
aliases. The other modules build, step, and render beefwives; Beefwife Lab is a
consumer of this directory.

`name` is the portable identity and JSON filename stem: a lowercase slug of up
to 64 letters, digits, and hyphens. Schema v1 does not mix display copy into the
runtime descriptor.

The runtime modules consume only schema v1. Callers use `Beefwife`; the model,
gait, body, legs, and skin modules are implementation boundaries.

## Public runtime contract

The library exposes two stable globals: `BeefwifeDescriptor` for plain JSON and
`Beefwife` for one live Pixi display object. Physics, gait, legs, skin, render
snapshots, caches, and fixed-step state remain private.

```js
const descriptor = BeefwifeDescriptor.parse(text);
const beefwife = new Beefwife(descriptor, {
  position: { x: 200, y: 150 }, // world px at the head
  direction: { x: 1, y: 0 },
  phase: 0, // gait phase in radians
  random: Math.random,
  render: {
    roundVertices: false,
    pixelResolution: 1,
    kneeProjection: {
      centerX: 0,
      centerY: 0,
      perspective: 0.002,
      maxOffset: 256,
    },
  },
});

beefwife.step(dt, { throttle: 1, direction }); // dt is seconds
app.stage.addChild(beefwife); // Pixi refreshes it when the stage renders
beefwife.setDescriptor(nextDescriptor);
beefwife.reset({ position, direction, phase });
beefwife.translate({ x: 20, y: 0 });
const pose = beefwife.getPose();
```

The constructor options object and each of its fields are optional. Position
defaults to `{ x: 0, y: 0 }`, direction to `{ x: 1, y: 0 }`, phase to zero, and
random to `Math.random`. Coordinates and phase must be finite. Direction must be
a nonzero finite vector and is normalized by the library. `random` must be a
function whose samples are finite numbers from zero inclusive to one exclusive;
it seeds the breathing starting phase and leg variation. Caller-supplied
positions and translations are limited to
`±Beefwife.MAX_WORLD_COORDINATE` (one billion px). Placement and translation are
rejected atomically if any body chunk would leave that supported range. If
simulation reaches the numeric boundary, the whole beefwife is rebased just
inside it; current, previous, leg, and ornament positions move together, so
velocity and secondary motion are preserved.

The optional `render` object is a live rendering policy with exactly three
fields. `roundVertices` is boolean pixel snapping. `pixelResolution` is the
positive number of output pixels per world pixel and defaults to one; snapping
uses its output-pixel grid, and a host should update it when renderer resolution
changes. `kneeProjection` is `null`
or an object containing finite `centerX`, `centerY`, and nonnegative
`perspective`, plus an optional nonnegative `maxOffset`. Projection changes only
the drawn knee shared by the two segments of each limb; simulated hips and
planted feet do not move. The object is retained so a host may update its center when
its viewport changes. Unknown render or projection fields are rejected.

`step` owns fixed simulation substeps but never owns a clock or animation loop.
`dt` must be finite and nonnegative seconds. Values above
`Beefwife.MAX_STEP_SECONDS` simulate exactly that safety window and discard the
excess, so resuming a background tab cannot create a backlog. The controls
object is optional. Omitted direction retains the last requested direction;
omitted throttle means full throttle. Throttle must be finite from zero to one;
inputs are rejected rather than clamped. Throttle linearly scales gait phase
rate, channel amplitude, and steering. At zero, existing velocity settles under
full contact but the beefwife produces no new drive.

`Beefwife` extends `PIXI.Container`. Its retained display children refresh through
Pixi's render lifecycle, so hosts only add the beefwife to a stage and render that
stage. Feet sit below the limb mesh. Under-layer ornaments retain descriptor
order, followed by the ribbon, plates from tail to head, and over-layer
ornaments in descriptor order. Shape scale includes `appearance.scale`; paint
stroke widths remain independent of local shape scale. Headless platforms may
simulate beefwives without creating display children. With Pixi loaded,
construction and descriptor replacement reject SVG paths and colors that Pixi
cannot parse.

`setDescriptor` validates replacement resources before changing the instance.
Invalid input changes nothing. Topology is compatible only when the
head, trunk, and tail chunk counts are unchanged. Compatible changes preserve
chunk positions, previous positions, steering state, fixed-step remainder, and
gait and breathing phases. Enabling breathing samples its starting phase.
Changed leg data rebuilds foot state; changed skin or visual
definitions rebuild ornament state. Incompatible topology rebuilds all physical
and secondary state at the current head position and head direction while
preserving gait phase and the last requested direction.

`reset(options)` deliberately clears physical and secondary state and samples a
new breathing phase when breathing is enabled. Its optional position defaults
to the current head position, phase to the current gait phase, and direction to
the current head tangent. Omitting direction preserves the last requested
control direction; providing direction uses it for both body placement and
future omitted-direction steps. Values follow the constructor's validation
rules.

`translate({ x, y })` shifts all current and previous world positions by a
finite offset. It preserves velocity, gait phase, steering, and secondary
motion, making it suitable for world wrapping. It does not change the last
requested direction.

`getPose()` returns a stable runtime-owned snapshot in world pixels. The same
object is refreshed by `step`, `setDescriptor`, `reset`, and `translate`, so a
host may retain the reference instead of requesting a new object each frame.
Treat the snapshot as read-only. `head` is chunk zero, `center` is the
arithmetic centroid of all chain chunks, and `direction` is the normalized head
tangent pointing headward. Each is `{ x, y }`. It never exposes mutable chunks
or renderer state, and changing the snapshot cannot change the simulation.
Render bounds and collision geometry are not part of schema v1. Constructor
input and the `descriptor` getter cannot be used to mutate the instance. Random
variation comes only from the injected random function.

```html
<script src="https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/dist/pixi.min.js"></script>
<script src="beefwife-descriptor.js"></script>
<script src="beefwife-model.js"></script>
<script src="beefwife-drive.js"></script>
<script src="beefwife-body.js"></script>
<script src="beefwife-legs.js"></script>
<script src="beefwife-skin.js"></script>
<script src="beefwife-graphics.js"></script>
<script src="beefwife.js"></script>
```

```js
const descriptor = BeefwifeDescriptor.parse(text);
const textAgain = BeefwifeDescriptor.stringify(descriptor);
```

`read(value)` validates an already parsed value. It returns a deep-owned plain
JSON value with fixed fields and definition keys in canonical order. Unknown
keys, omitted fields, non-plain objects, invalid references, and values outside
their declared bounds are errors.

See [beefwife.example.json](beefwife.example.json) for the complete shape.

## Definitions and links

Every reference stays inside one descriptor:

- A material is physical chain response: retained velocity, joint and link
  correction, and directional grip.
- A shape is one SVG path in chunk-local pixels. Positive x points toward the
  head and positive y points outward.
- A paint is a fill and stroke. At least one must be visible.

Each chain section names one complete material. Sharing a material id links the
sections; giving the tail different physics means defining another material and
changing its reference. There is no material inheritance or partial override.

Material response belongs to chunks. The link joining two chunks averages their
`linkCorrection`, including links across section boundaries. Boundary resting
spacing and gather response are likewise the averages of their adjacent chunks.
Link correction is always positive; schema v1 does not admit disconnected body
points whose separation can grow without bound.

Visual placements name one shape and one paint. Geometry and paint never refer
to each other, and definitions cannot refer outside their descriptor.

## Chain regions

The chain has exactly `head`, `trunk`, and `tail` sections. Head and trunk must
contain at least one chunk; the tail may be empty. Together they contain 2 to
256 chunks.

Each section declares:

- `chunks`: number of points in the section;
- `spacing`: resting point spacing in px;
- `material`: physical material id;
- `motionScale`: response to each gait channel;
- `profile.ribbonWidth`: half-width in local px at both section ends;
- `profile.plateScale`: plate scale at both section ends.

Adjacent section spacing is resolved at build time. Profiles may meet smoothly
or make an intentional discontinuity.

Profile endpoints are sampled at the first and last chunk of a section. A
one-chunk section uses the average of its two endpoint values.

`chain.breathing` is a normalized intensity for subtle, simultaneous expansion
and contraction of internal trunk links. At full intensity it changes their
target length by at most 10%. Its independent cycle continues at zero throttle;
larger resting trunks breathe more slowly. Head, tail, and section-boundary
links retain their ordinary target lengths.

## Gait

All channels read one phase clock and one spatial lag:

- `cyclesPerSecond` advances the shared clock.
- `phaseLagRadiansPerPixel` controls wavelength and direction along resting
  chain distance. Positive values travel from head to tail.
- Bend is a signed sine. Its amplitude is radians of curvature at the trunk's
  resting spacing.
- Thrust is a positive pulse whose acceleration is px/s^2.
- Gather is a signed cosine and changes resting spacing by a fraction.
- Contact is a positive pulse whose lift removes a fraction of contact.

Each channel declares an integer harmonic and a phase offset in radians. Thrust
and contact also declare a duty cycle. Section motion scales may attenuate or
amplify channels, but validation prevents non-positive gathered lengths and
negative contact.

A channel reads `harmonic * (phase - distance * lag) + phaseOffset`. Thrust and
contact use a half-sine pulse inside the declared fraction of that channel's
cycle and zero outside it. A duty cycle of `0.5` therefore matches the positive
half of a sine.

Solver timing, relaxation pass count, mass, and waveform implementations are
library rules rather than descriptor parameters.

## Placements

An anchor addresses either the whole chain or one section:

```js
{ scope: "chain", section: null, from: "head", offset: 1 }
{ scope: "section", section: "tail", from: "tail", offset: 0 }
```

Offsets are zero-based from the named end. Repetition walks away from that end:

```js
{ count: 4, step: 1 }
{ count: null, step: 1 } // through the rest of this anchor's scope
```

Placements that leave their scope are invalid; they are never clamped.

Only one plate may resolve onto a chunk. Ornaments accumulate, may use the same
anchor, and retain descriptor order. Drawing order is:

1. `under` ornaments in descriptor order;
2. ribbon and plates;
3. `over` ornaments in descriptor order.

Mirrored and repeated ornaments share shape and paint definitions, but every
expanded ornament owns independent runtime motion. Schema v1 admits at most 512
expanded ornaments per beefwife.

## Legs and secondary motion

Leg pairs are distributed over their named section by resting distance.
`reach`, `spread`, and `swingArc` are px. `swingSeconds` is time per airborne
step. Other leg timing and geometry values are bounded ratios.

Two or more pairs include the first and last chunks of their section and choose
nearest chunks at even resting-distance intervals. One pair uses the section
midpoint. More pairs than chunks may share anchors. `reach` controls the
forward stance window, `spread` the lateral foot offset, `lead` shifts the next
plant forward, and `fold` controls the drawn two-segment limb bend. `swingArc`
bows an airborne foot farther outward in the body plane. `jointLean` is a signed
ratio of each anchor's longitudinal distance from the middle of the leg section:
`1` moves every joint the whole way to that middle, negative values lean joints
away by the same measure, and zero preserves the solved joint position. Pairs
sharing an anchor lean alike, and the reach never depends on limb length.

`sidePhase` offsets right-foot contact by that fraction of `Math.PI`; `1` makes
the two sides opposite. `liftThreshold` releases a planted foot when its contact
falls below the threshold. Jitter samples permanent proportions and per-step
timing from the instance's injected random function. A jitter of zero makes each
pair exactly mirrored and consumes randomness without changing its geometry.
All positional jitter scales with the larger of `reach` and `spread`; it never
introduces a fixed world-pixel displacement.

Ornament `length` and offsets are px, `angleDegrees` is degrees, and `snapRate`
and `dampingRate` are per second. They are time-based so visual motion does not
depend on frame rate.

Root motion carries an ornament tip by `1 / (1 + sweep)` of the root's change,
so zero sweep follows the anchor and larger values leave more motion behind.
Snap and damping use exponential time response. The tip is constrained to its
declared length after every fixed simulation step.

## Rendering extensions

Schema v1 has no generic shader, effect, or extension-options object. Pixel
filters are renderer post-processing; particles are stateful anchored emitters.
Both need concrete runtime contracts before entering the descriptor. The local
shape, paint, and anchor rules are reusable when a typed effect is introduced
in a later schema version.

## Check

Run the permanent adversarial tests:

```sh
bb descriptor
bb beefwife-model
bb beefwife-api
bb canvas-runtime
```

Run the complete headless suite with `bb test`.

Together they mutate every descriptor field and nesting level, check references,
scope bounds, ownership, lifecycle replacement, solver invariants, rendering
composition, hostile JavaScript values, canonical JSON, and the canvas boundary.
