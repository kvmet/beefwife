# Changelog

Notable changes to `@kvmet/beefwife`, newest first. This package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 (unreleased)

First release.

`Beefwife` drives one live Pixi display object; `Descriptor` reads, resizes,
and reports bounds on the portable JSON. Schema v1 is the only descriptor shape
accepted.

Seven sample descriptors ship under `samples/`, reachable from a CDN by any
page that wants creatures without designing its own.

Simulation runs headless where no renderer is present: the module builds no
display children and leaves `onRender` null, so a server gets the pose without
Pixi. Both Pixi renderers are supported, WebGL and WebGPU.

The pixi.js peer dependency requires at least 8.21.0, because destroying one
WebGPU renderer can break another in earlier 8.x releases.
