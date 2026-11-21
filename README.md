# Beefwife

A chain-body simulation, procedural animation, and rendering library for Beefwives.

## What is a `Beefwife`?

A procedurally animated chain-body "creature" intended to be placed on web-pages for amusement.
Their appearance and behavior can vary significantly and they can be told to avoid certain areas of the page.

## How do I add `Beefwives` to my website?

Put a canvas on the page, name the creatures it draws from, and load two
scripts:

```html
<canvas
  data-beefwife-canvas
  data-beefwife-count="6"
  data-beefwife-sources="
    https://cdn.jsdelivr.net/npm/@kvmet/beefwife@0.2.0/samples/slow-guy.json,
    https://cdn.jsdelivr.net/npm/@kvmet/beefwife@0.2.0/samples/long-girl.json"
></canvas>

<script src="https://cdn.jsdelivr.net/npm/pixi.js@8.23.0/dist/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@kvmet/beefwife-canvas@0.2.1/beefwife-canvas.min.js"></script>
```

That page works as written. `@kvmet/beefwife` ships nine samples: `bounding`,
`chevron-guy`, `long-girl`, `peristaltic`, `raccoon`, `reticulating`,
`slow-guy`, `the-worm`, and `undulating`.

For a larger cast, or to draw one creature more often than another, point
`data-beefwife-manifest` at a manifest instead:

```json
{
  "schemaVersion": 1,
  "sources": [
    { "src": "slow-guy.json", "weight": 3 },
    "long-girl.json"
  ]
}
```

Each source is a beefwife descriptor, plain JSON. Design your own in Beefwife
Lab. [`examples/beefwife-canvas`](examples/beefwife-canvas/) is a working page
with every option wired up.

## What are the pieces?

| Package | What it does |
| --- | --- |
| [`@kvmet/beefwife-canvas`](beefwife-canvas/) | Drop-in canvas runtime. Start here. |
| [`@kvmet/beefwife`](beefwife/) | The creature library, for your own Pixi scene. |
| [`@kvmet/terrain`](terrain/) | Standalone DOM free-space queries and routing. |
| [`beefwife-lab`](beefwife-lab/) | Local editor for designing beefwives. |

Pixi 8.21.0 or newer is required wherever a beefwife is drawn.

## Why are they called `Beefwives`?

Because I already owned the domain name and decided to use it for this project.

## What license is this under?

Mozilla Public License 2.0, except `terrain/`, which is MIT. MPL is file-level
copyleft: put beefwives on any page you like, commercial or not, and bundle them
with whatever else you please. If you change the library's own files, publish
those changes.

## Were LLMs or other generative tools used in this project?

Yes, LLMs were used to assist with programming as well as code reviews and refactors. 
All creative aspects are human-generated. The "art" of this project is in the overall concept, planning, taste, and humor as well as in the designs of the Beefwives themselves.
