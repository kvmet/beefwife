# Beefwife

`beefwife-schema.js` holds the schema-v1 tree, the authority on a beefwife's
portable JSON contract, and `beefwife-descriptor.js` reads, resizes, and
reports bounds against it. Version 1 deliberately accepts no older descriptor
shapes or field aliases. The other modules build, step, and render beefwives;
Beefwife Lab is a consumer of this directory.

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
ornaments in descriptor order. Paint stroke widths remain independent of
every scale. Headless platforms may
simulate beefwives without creating display children. With Pixi loaded,
construction and descriptor replacement reject SVG paths and colors that Pixi
cannot parse.

`setDescriptor` validates replacement resources before changing the instance.
Invalid input changes nothing about the object definition; a rejected call may
still have drawn from `random`, which seeds state rather than definition.
Replacement keeps as much of the live creature as the new descriptor allows.
Chunk positions, previous positions, steering state, fixed-step remainder, and
gait and breathing phases survive every edit. Changing a section's chunk count
carries the chain rather than re-placing it: a chunk the descriptor still names
keeps its exact position and velocity, and an added one is seeded between its
neighbours, so the creature settles from where it stood. The head tangent then
follows whichever chunk sits behind the head, which is a real turn when the
chunk that defined it was removed.

Only the number of leg pairs rebuilds foot state, and only a change to the
expanded ornament list rebuilds ornament swing. Everything else those parts
read comes from the model each step, so a foot stays planted and a swing stays
mid-flight while its stance, anchor, colour, or spring settings change under
it. Enabling breathing samples a starting phase.

Display objects are retained on the same terms, one at a time rather than all
together. A replacement repaints the children it can and changes only what the
new descriptor disagrees with: feet, plates, and ornaments are added or dropped
by count, and a limb or ribbon mesh is rebuilt only when its vertex count moves
or its paint gains or loses a fill or a visible stroke. Adding a leg pair
rebuilds the limb mesh; adding a chunk rebuilds the ribbon mesh. Nothing else
in the scene is discarded, so no edit restarts the creature.

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

`destroy()` takes down every display object the instance owns and detaches it
from its parent. It is required, not optional: a host running many beefwives
must call it, because the scene is retained and nothing else frees it.
Afterwards `step`, `setDescriptor`, `reset`, and `translate` throw. The
descriptor and the last pose remain readable.

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

`restLength` is the chain's resting arc length in world pixels, summed over
every link and averaged across section boundaries. It follows `setDescriptor`.
A host that compares `getPose()` against its own bounds needs it: the centroid
trails the head by up to this distance, so a viewport test without it reads a
long creature as gone while it is still on screen.

```html
<script src="https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/dist/pixi.min.js"></script>
<script src="beefwife-schema.js"></script>
<script src="beefwife-descriptor.js"></script>
<script src="beefwife-model.js"></script>
<script src="beefwife-drive.js"></script>
<script src="beefwife-body.js"></script>
<script src="beefwife-legs.js"></script>
<script src="beefwife-skin.js"></script>
<script src="beefwife-geometry.js"></script>
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

Descriptor px are world pixels, and `scale(descriptor, factor)` is the one way
to resize a creature. It returns a new descriptor with every
length-dimensioned field transformed (px multiply, radians-per-px divide), so
the pose trace scales by the factor with timing and feel unchanged. Paint
stroke widths are exempt by rule. A product outside its field's bounds is an
error, not a clamp.

`bounds(path)` reports what the schema enforces for one field, so an editor can
read a range from the schema that checks it instead of keeping a second copy.
Paths name fields with dots, an array item with `[]`, and a record entry with
`*`:

```js
BeefwifeDescriptor.bounds("legs.pairs");
// { kind: "number", min: 0, max: 128, integer: true, nullable: false }
BeefwifeDescriptor.bounds("chain.skin.ornaments[].side");
// { kind: "choice", values: ["left", "right", "both"], nullable: false }
BeefwifeDescriptor.bounds("definitions.paints.*.stroke.width");
// { kind: "number", min: 0, max: 1000, integer: false, nullable: false }
```

Every kind reports `nullable`. Numbers add `min`, `max`, and `integer`; strings
add `minLength`, `maxLength`, and `pattern`; choices add `values`; objects add
`fields`; records add `minEntries`, `maxEntries`, and `keyPattern`; arrays add
`maxLength`. A path the schema does not define is an error. A consumer may
narrow a range to suit its own users, but a value outside the reported bound is
one `read` rejects.

See [beefwife.example.json](beefwife.example.json) for the complete shape.

## Definitions and links

Every reference stays inside one descriptor:

- A material is physical chain response: velocity retention per second, joint
  and link correction, and directional grip.
- A shape is one SVG path in chunk-local pixels. Positive x points toward the
  head and positive y points outward.
- A paint is a nullable fill colour and a nullable `{ colour, width }` stroke.
  At least one must be visible.

Each chain section names one complete material. Sharing a material id links the
sections; giving the tail different physics means defining another material and
changing its reference. There is no material inheritance or partial override.

Material response belongs to chunks. The link joining two chunks averages their
`linkCorrection`, including links across section boundaries. Boundary resting
spacing and gather response are likewise the averages of their adjacent chunks.
Link correction is always positive, and every link is held to at most three
times its current target length however soft its material, so separation cannot
grow without bound. The ceiling sits well above ordinary motion and engages
only on a chain that would otherwise run away.

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
trunks with more chunks breathe more slowly. Head, tail, and section-boundary
links retain their ordinary target lengths.

## Chain physics

`chain.physics` holds the two responses that are not gait channels.

`autoLift` is adaptive ground lift. Each substep it ranks chunks by how far
their grip pushed the creature along its travel axis, picks up the `share`
fraction that pushed the least, and eases every chunk toward its lifted or
planted target at `rate` per second. `amount` is the contact a fully lifted
chunk loses: `0` disables the mechanism outright and `1` frees the chunk. Lift
multiplies the contact rhythm rather than replacing it.

`steering` turns the head toward the requested direction. The angle between
them times `gain` is the wanted bend bias in radians, clamped to `limit`; the
applied bias eases toward that at `rate` per second. The bias adds to the bend
channel along the whole chain, so a turning beefwife curves through its body
instead of pivoting at the neck. Throttle scales it.

## Gait

All channels read one phase clock and one spatial lag:

- `cyclesPerSecond` advances the shared clock.
- `phaseLagRadiansPerPixel` controls wavelength and direction along resting
  chain distance. Positive values travel from head to tail.
- Bend is a signed sine. Its amplitude is radians of curvature at the trunk's
  resting spacing.
- Thrust is a positive pulse whose acceleration is px/s^2.
- Gather is a signed cosine and changes resting spacing by a fraction.
- Contact is a positive pulse whose amplitude removes a fraction of contact.

Each channel declares an integer harmonic. Bend is the phase reference; the
other channels declare a phase offset in radians relative to it. Thrust and
contact also declare a duty cycle. Section motion scales may attenuate or
amplify channels, but validation prevents non-positive gathered lengths and
negative contact.

The grip a chunk feels is its contact rhythm times what the adaptive ground
lift leaves, gated by its material's directional grip; contact declares the
rhythm, while ground lift picks up whichever chunks push the least.

A channel reads `harmonic * (phase - distance * lag) + phaseOffset`, with
bend's offset fixed at zero. Thrust and
contact use a half-sine pulse inside the declared fraction of that channel's
cycle and zero outside it. A duty cycle of `0.5` therefore matches the positive
half of a sine.

Solver timing, relaxation pass count, mass, and waveform implementations are
library rules rather than descriptor parameters.

## Placements

An anchor addresses either the whole chain or one section:

```js
{ section: null, from: "head", offset: 1 } // whole chain
{ section: "tail", from: "tail", offset: 0 }
```

Offsets are zero-based from the named end. Repetition walks away from that end:

```js
{ count: 4, step: 1 }
{ count: null, step: 1 } // through the rest of this anchor's scope
```

Placements that leave their scope are invalid; they are never clamped.

Only one plate may resolve onto a chunk. `chain.skin.loadScale` then grows
plates with grip: a plate's drawn scale is multiplied by
`1 + loadScale * contact`, so a chunk under full contact draws `1 + loadScale`
times its resting size and a negative value shrinks it instead. `-1` is the
floor because below it a fully gripped plate would draw mirrored.

Ornaments accumulate, may use the same anchor, and retain descriptor order.
Drawing order is:

1. `under` ornaments in descriptor order;
2. ribbon and plates;
3. `over` ornaments in descriptor order.

Mirrored and repeated ornaments share shape and paint definitions, but every
expanded ornament owns independent runtime motion. Schema v1 admits at most 512
expanded ornaments per beefwife.

## Legs and secondary motion

Leg pairs are distributed over their named section by resting distance.
`reach` is px; `spread` and `swingArc` are fractions of `reach`.
`swingCycles` is airborne time per step in gait cycles, so feet keep step with
the shared clock; a stopped clock resolves against a floor of 0.01 cycles per
second. Other leg timing and geometry values are bounded ratios.

Two or more pairs include the first and last chunks of their section and choose
nearest chunks at even resting-distance intervals. One pair uses the section
midpoint. More pairs than chunks may share anchors. `reach` controls the
forward stance window, `spread` the lateral foot offset, `lead` shifts the next
plant forward, and `fold` controls the drawn two-segment limb bend. `swingArc`
bows an airborne foot farther outward in the body plane.

Three signed ratios place the drawn joint. `jointBend` scales how far the joint
leaves the line between hip and foot: `1` bows it behind and outward, `0` puts
it on the line, and `-1` mirrors the bow ahead and inward. `jointLean` then
slides the joint longitudinally by that ratio of one limb length: positive
values lean joints toward the middle of the leg section, negative values away,
and zero preserves the bowed position. The lean grows from nothing at its
center to its full travel at the ends of the leg section, taken from where each
anchor sits, so pairs sharing an anchor lean alike and no body length scales
it. `jointLeanCenter` moves that center from the middle of the leg section
(`0`) to its head end (`-1`) or tail end (`1`); the far end then travels up to
twice one limb length.

`sidePhase` offsets right-foot contact by that fraction of `Math.PI`; `1` makes
the two sides opposite. `liftThreshold` releases a planted foot when its contact
falls below the threshold. Jitter samples permanent proportions and per-step
timing from the instance's injected random function. A jitter of zero makes each
pair exactly mirrored and consumes randomness without changing its geometry.
All positional jitter scales with the larger of `reach` and the resolved
spread; it never introduces a fixed world-pixel displacement.

`legs.skin.foot.scale` is the drawn foot size in px. `plantedScale` multiplies
it while the foot is on the ground, so feet may swell as they take weight and
shrink through the swing. It is a ratio, so a resized creature keeps it.

A limb is one closed outline, not a stroked line: hip, knee, foot down one side
and back up the other, with both sides sharing each knee vertex so a bend leaves
no gap. `legs.skin.limbWidth` sets its thickness in px. A fill-only `limbPaint`
draws it as a tinted mesh; any paint that also asks for a stroke moves the limbs
to a Graphics path and draws both passes, as the ribbon does. A `limbWidth` of
zero draws no limbs at all, leaving the feet on their own.

Ornament offsets are px, `angleDegrees` is degrees, and `recover` is per
second. Rates are time-based so visual motion does not depend on frame rate.

An ornament swings about its root, pivoting at its shape path's origin, so an
off-center path pivots off-center. Two root motions can drive the swing, and
`source` fades between them: at `0` the root's turning, which carries the body
wave; at `1` its sideways travel through the world, which carries speed,
thrust, and steering; between them a linear blend. Sideways travel is measured
against the creature's own body length, so a resized creature keeps the same
ornament feel.

Each remaining control owns one quality of the swing. `react` is its size:
`0` rides the root rigidly, positive trails the drive, negative leads it.
`recover` is its tempo: how fast the deflection chases the drive and returns
to rest, changing speed without changing size. `wobble` is its shape: `0`
settles without overshoot, `1` overshoots and rings. The deflection is
clamped to a quarter turn either side of rest after every fixed simulation
step.

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
