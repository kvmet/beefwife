# Beefwife Lab

An interaction mockup for the future beefwife editor. It deliberately owns no
beefwife schema, rendering, or simulation logic yet.

The current pass explores three connected surfaces:

- the beefwife preview;
- a contextual selection inspector;
- a collapsible chain map with dedicated plate and ornament tracks.

Chunk boundaries are structural guides behind the tracks. They are not a
separate editable row. Ornament tracks allow overlapping placements.

The Stage tab's Terrain tool draws obstacles by dragging, and removes one by
clicking it. They are ordinary elements, which is what the runtime measures its
terrain from, so Bounds draws an obstacle only where Obstacle pad has grown it
past the box on the stage. Routes, Targets, and Bounds draw over the canvas at
full resolution from the runtime's own accessors, rather than through its debug
layers, which rasterise at Res scale. Sim sets how many specimens share the
stage; each routes and wanders on its own, and every edit reaches all of them.

## Run it

```sh
npm install
npm run dev
```

Run `npm run check` for Svelte diagnostics and a production build.
