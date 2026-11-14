# Changelog

Notable changes to `@kvmet/beefwife-canvas`, newest first. This package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 (unreleased)

First release.

The bundle auto-mounts every `canvas[data-beefwife-canvas]` once the DOM is
ready, loads its creatures from a manifest, and routes them around the page
with Terrain. `BeefwifeCanvas.mount`, `get`, and `scan` drive mounting by hand.

A mounted canvas reports through `data-beefwife-state`, the
`beefwifecanvasready` and `beefwifecanvaserror` events, and the handle's
`state` and `pauseReason` getters. It pauses itself when hidden, offscreen, or
sized to zero.

`@kvmet/beefwife` and `@kvmet/terrain` are bundled in, so the page loads Pixi 8
and this one file. The classic script is the only entry; Pixi is read from the
page as `window.PIXI`. Pixi 8.21.0 is the minimum.
