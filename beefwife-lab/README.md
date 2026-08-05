# Beefwife Lab

An interaction mockup for the future beefwife editor. It deliberately owns no
beefwife schema, rendering, or simulation logic yet.

The current pass explores three connected surfaces:

- the beefwife preview;
- a contextual selection inspector;
- a collapsible chain map with dedicated plate and ornament tracks.

Chunk boundaries are structural guides behind the tracks. They are not a
separate editable row. Ornament tracks allow overlapping placements.

## Run it

```sh
npm install
npm run dev
```

Run `npm run check` for Svelte diagnostics and a production build.
