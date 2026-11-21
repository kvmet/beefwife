# Changelog

Notable changes to `@kvmet/beefwife`, newest first. This package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0 (2026-11-21)

Breaking: error messages are rewritten. Each one reads `<path>: <problem>`,
states the rule that failed, and shows the value given, such as
`$.legs.pairs: must be an integer (got 1.5)`. An error about an argument
starts with the function's name, such as `scale:` or `parse:`. Code that
matches the old message text needs updating. The descriptor format is
unchanged: `read` accepts and rejects the same documents.

`Descriptor.repair(value)` checks a descriptor like `read`, but drops or trims
plates, ornaments, and legs that cannot be placed instead of throwing. It
returns `{ descriptor, warnings }`, for an editor's live preview.

Editing `legs.jitter` or `legs.liftThreshold` on a live creature now reaches
every leg at once. Before, existing legs kept the proportions they were built
with until the creature was rebuilt.

A `raccoon` sample joins the seven under `samples/`.

## 0.1.1 (2026-11-14)

Documentation only; the library is unchanged.

The README is rewritten as an install guide and API reference. The descriptor
field reference moves to `DESCRIPTOR.md`, which now ships with the package.

## 0.1.0 (2026-11-14)

First release.

`Beefwife` drives one live Pixi display object; `Descriptor` reads, resizes,
and reports bounds on the portable JSON. Schema v1 is the only descriptor shape
accepted.

Seven sample descriptors ship under `samples/`, reachable from a CDN by any
page that wants creatures without designing its own.

Simulation runs headless where no renderer is present: the classic-script
build, loaded or required without `window.PIXI`, builds no display children and
leaves `onRender` null, so a server gets the pose without Pixi. The module entry
imports pixi.js. Both Pixi renderers are supported, WebGL and WebGPU.

The pixi.js peer dependency requires at least 8.21.0, because destroying one
WebGPU renderer can break another in earlier 8.x releases.
