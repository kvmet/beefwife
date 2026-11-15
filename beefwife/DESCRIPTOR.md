# Beefwife descriptor

A descriptor is one JSON file that defines a beefwife: its body, its gait, its
legs, and its look. This page covers schema version 1.
[`beefwife.example.json`](beefwife.example.json) uses every field, and the
files in [`samples/`](samples/) are complete creatures.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Always `1`. |
| `name` | The creature's id and its file name without `.json`. Up to 64 lowercase letters, digits, and hyphens, starting with a letter or digit. |
| `definitions` | Named materials, shapes, and paints. See [Definitions](#definitions). |
| `chain` | The body. See [Chain](#chain) and [Skin](#skin). |
| `gait` | How the body moves. See [Gait](#gait). |
| `legs` | See [Legs](#legs). |

Every field is required, and an unknown field is an error. A value out of
range is an error, never clamped. `Descriptor.bounds(path)` reports the range
of any field.

## Units

- Lengths are world pixels (px).
- Angles are radians, except `angleDegrees`.
- Rates are per second, so motion does not depend on frame rate.
- Fractions and ratios have no unit.

## Definitions

`definitions` holds three maps of named parts. Ids start with a letter and
hold up to 64 letters, digits, `_`, and `-`. Every reference names an id in
the same descriptor.

**Materials** set how the chain responds physically.

| Field | Range | Meaning |
| --- | --- | --- |
| `velocityRetention` | 0 to 1 | Share of velocity kept after one second. |
| `jointCorrection` | 0 to 1 | How strongly bends are pulled toward their target. |
| `linkCorrection` | 0.001 to 1 | How strongly links are pulled toward their length. |
| `grip.forward`, `grip.backward`, `grip.lateral` | 0 to 1 | Ground grip against motion in each direction. |

Material belongs to chunks. A link between two chunks, including a link across
a section boundary, uses the mean of their `linkCorrection`. No link stretches
past three times its target length, however soft its material.

**Shapes** are one SVG path each, as `path`. Coordinates are local: positive x
points toward the head and positive y points outward from the body.

**Paints** are a `fill` colour and a `stroke` of `{ colour, width }`. Either may
be `null`, but not both. Stroke width is in local shape units for feet,
plates, and ornaments, and in px for the ribbon and limbs.

There is no inheritance. To give the tail other physics, define a second
material and name it in the tail section.

## Chain

The chain is a line of chunks in three sections: `head`, `trunk`, and `tail`.
Head and trunk need at least one chunk each; the tail may have none. Together
they hold 2 to 256 chunks.

| Section field | Meaning |
| --- | --- |
| `chunks` | Number of chunks. |
| `spacing` | Rest distance between chunks, px. |
| `material` | Material id. |
| `motionScale` | `{ bend, thrust, gather, contact }`, 0 to 4: how strongly this section follows each gait channel. |
| `profile.ribbonWidth` | `{ start, end }`: ribbon half-width at the first and last chunk, px. |
| `profile.plateScale` | `{ start, end }`: plate scale at the first and last chunk. |

Values between a section's ends are interpolated. A one-chunk section uses the
mean of `start` and `end`. Spacing at a section boundary is the mean of the
two sections.

`chain.breathing`, 0 to 1, slowly lengthens and shortens the trunk's inner
links together, by at most 10% at 1. It runs at zero throttle too, and longer
trunks breathe more slowly.

`chain.physics.autoLift` lifts the chunks that push the creature forward
least. Each step it ranks chunks by push, lifts the `share` that push least,
and eases each chunk toward lifted or planted at `rate` per second. `amount` is
the contact a fully lifted chunk loses: 0 turns lift off, 1 removes all
contact.

`chain.physics.steering` turns the creature toward its requested direction.
The angle to that direction times `gain` is the wanted bend, limited to
`limit` radians and approached at `rate` per second. The bend spreads along
the whole chain, so the creature curves through its body instead of pivoting
at the neck.

## Gait

The gait has four channels that read one shared clock.

| Field | Meaning |
| --- | --- |
| `cyclesPerSecond` | Clock speed. |
| `phaseLagRadiansPerPixel` | Phase change per px along the chain. Sets wavelength; positive waves travel head to tail. |
| `bend.amplitude` | Bend in radians at the trunk's rest spacing. A signed sine. |
| `thrust.acceleration` | Forward push, px/s². A positive pulse. |
| `gather.amplitude` | Fraction by which link length grows and shrinks. A signed cosine. |
| `contact.amplitude` | Fraction of ground contact removed. A positive pulse. |

Each channel has an integer `harmonic`, 1 to 8. Thrust, gather, and contact
also have a `phaseOffset` against bend, −π to π. Thrust and contact have a
`dutyCycle`: the share of each cycle the pulse is on, as a half sine. A duty
cycle of 0.5 matches the positive half of a sine.

A channel reads `harmonic × (phase − distance × lag) + phaseOffset`.

The gait is sampled once per 1/60 s step, so `cyclesPerSecond × harmonic` must
be at most 15 for each channel: four samples a cycle. Faster waves alias into
slower or reversed ones.

A chunk's grip is its contact pulse, times what auto-lift leaves, times its
material's grip in the direction it moves.

## Legs

| Field | Range | Meaning |
| --- | --- | --- |
| `section` | `head`, `trunk`, `tail` | Section the legs attach to. |
| `pairs` | 0 to 128 | Number of leg pairs. |
| `reach` | px | Length of the forward stance window. |
| `spread` | 0 to 4 | Sideways foot distance, as a fraction of `reach`. |
| `lead` | 0 to 1 | How far forward the next foot plants. |
| `fold` | 0 to 1 | How sharply the drawn leg bends. |
| `jointBend` | −1 to 1 | 1 bows the knee back and out, 0 keeps it on the line from hip to foot, −1 bows it forward and in. |
| `jointLean` | −1 to 1 | Slides knees along the body, in limb lengths: positive toward the middle of the leg section, negative away. |
| `jointLeanCenter` | −1 to 1 | Moves the lean's center from the middle of the leg section (0) to its head end (−1) or tail end (1). |
| `sidePhase` | 0 to 1 | Right-foot timing offset, as a fraction of π. 1 puts the sides opposite. |
| `liftThreshold` | 0 to 1 | A planted foot lifts when its contact falls below this. |
| `swingCycles` | 0.001 to 60 | Time in the air per step, in gait cycles. |
| `swingArc` | 0 to 4 | How far out a foot bows in the air, as a fraction of `reach`. |
| `jitter` | 0 to 1 | Random variation in leg proportions and step timing. |

One pair attaches at the section's middle. Two or more include the section's
first and last chunks, spaced evenly by rest distance. More pairs than chunks
share chunks.

Knee lean is zero at its center and full at the ends of the leg section; the
far end can move up to two limb lengths. Jitter scales with the larger of
`reach` and spread, and a jitter of 0 makes each pair exact mirrors.

`legs.skin` sets the look:

| Field | Meaning |
| --- | --- |
| `limbPaint` | Paint id for the legs. |
| `limbWidth` | Leg thickness, px. 0 draws feet with no legs. |
| `foot.shape`, `foot.paint` | Shape and paint ids for the feet. |
| `foot.scale` | Foot size, px per shape unit. |
| `foot.plantedScale` | Foot size multiplier while the foot is on the ground. |

## Skin

`chain.skin` sets the body's look.

| Field | Meaning |
| --- | --- |
| `ribbon.paint` | Paint id for the ribbon along the chain. |
| `plates` | Shapes drawn on chunks. At most one plate per chunk. |
| `ornaments` | Shapes that hang from chunks and swing. |
| `loadScale` | −1 to 10. Plates grow with grip: drawn scale × (1 + `loadScale` × contact). |

### Placement

Plates and ornaments each have an `id`, a `shape`, a `paint`, a `scale` in px
per shape unit, and a place given by `at` and `repeat`.

```json
{ "at": { "section": null, "from": "head", "offset": 1 },
  "repeat": { "count": 4, "step": 1 } }
```

`at.section` limits the placement to one section; `null` means the whole
chain. `from` is the end to count from, and `offset` counts chunks from that
end, from 0. `repeat` places `count` copies, `step` chunks apart, moving away
from that end. A `count` of `null` fills the rest of the section. A placement
that runs past its section is an error.

### Ornaments

| Field | Meaning |
| --- | --- |
| `side` | `left`, `right`, or `both`. `both` places a mirrored pair. |
| `layer` | `under` draws below the ribbon and plates, `over` draws above. |
| `offset` | `{ forward, outward }` from the chunk, px. |
| `angleDegrees` | Rest angle, −180 to 180. |
| `source` | 0 to 1. What swings it: 0 is the chunk's turning, which follows the body wave; 1 is its sideways travel, which follows speed and steering. Between them, a blend. |
| `react` | −4 to 4. Swing size. 0 is rigid, positive trails the motion, negative leads it. |
| `recover` | 0 to 1000 per second. Swing speed. |
| `wobble` | 0 to 1. 0 settles without overshoot, 1 overshoots and rings. |

An ornament pivots at its shape's origin. Its swing is limited to a quarter
turn each way. Repeated and mirrored ornaments share definitions, but each
copy swings on its own. A descriptor may expand to at most 512 ornaments.

Ornaments in one layer draw in descriptor order.

## Rules that join fields

`Descriptor.bounds` cannot show these, so check them here:

- The three sections hold 2 to 256 chunks together.
- Each placement must land on chunks inside its section, and no two plates may
  land on one chunk.
- Gather and contact amplitudes, scaled by each section's `motionScale`, must
  not make a link or a contact value negative.
- `cyclesPerSecond × harmonic` must be at most 15 for each gait channel.
- A descriptor may have at most 256 of each kind of definition, and its paths
  may total at most 1,048,576 characters.

## Resizing

Px are world pixels. To resize a creature, use `Descriptor.scale(descriptor,
factor)`; do not edit fields by hand. It multiplies every px field by
`factor` and divides every per-px field by it, so the creature moves the same
way at the new size. Ribbon and leg stroke widths grow directly; shape
strokes grow with the placement scale.
