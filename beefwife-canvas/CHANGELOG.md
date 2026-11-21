# Changelog

Notable changes to `@kvmet/beefwife-canvas`, newest first. This package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.1 (2026-11-21)

Built on `@kvmet/beefwife` 0.2.0 and `@kvmet/terrain` 0.3.0.

A creature spawned without a name is now one the canvas does not hold yet,
until the canvas holds one of each. Weights then pick among all creatures. A
default mount, whose `count` is the number of descriptors, shows every
creature once.

A source or descriptor entry takes `guaranteed: false` to leave its creature
out of that first pass, so it appears only when the weights pick it.

## 0.2.0 (2026-11-21)

Built on `@kvmet/beefwife` 0.2.0, so `BeefwifeCanvas.Descriptor.repair` is
available and jitter edits reach live legs.

Breaking: error messages are rewritten in the same `<path>: <problem>` form,
with the value given. A source that fails to load names its URL and HTTP
status. Code that matches the old message text needs updating.

## 0.1.1 (2026-11-14)

Documentation only; the runtime is unchanged.

The README is rewritten as an install guide and API reference, with a table
of every option and its default.

## 0.1.0 (2026-11-14)

First release.

The bundle auto-mounts every `canvas[data-beefwife-canvas]` once the DOM is
ready, loads its creatures from a manifest, and routes them around the page
with Terrain. `BeefwifeCanvas.mount`, `get`, and `scan` drive mounting by hand.

A mounted canvas reports through `data-beefwife-state`, the
`beefwifecanvasready` and `beefwifecanvaserror` events, and the handle's
`state` and `pauseReason` getters. It pauses itself when hidden, offscreen, or
sized to zero.

`@kvmet/beefwife` and `@kvmet/terrain` are bundled in, so the page loads Pixi 8
and this one file. Two entries carry it: the classic script reads `window.PIXI`
and runs where no renderer is present, and the module build imports the peer so
a bundler shares one copy with the page. Pixi 8.21.0 is the minimum.
