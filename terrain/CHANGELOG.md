# Changelog

Notable changes to `@kvmet/terrain`, newest first. This package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## 0.3.0 (2026-11-21)

Breaking: error messages are rewritten. Each one reads `<path>: <problem>` and
names the option at fault, such as `options.avoid: must be a CSS selector, an
iterable of elements, or a function`. Code that matches the old message text
needs updating. Routing and queries are unchanged.

## 0.2.1 (2026-11-14)

Packaging only; the routing and query behaviour is unchanged.

`terrain.min.js` carries the copyright and license. The banner was a plain
block comment, which the minifier stripped, so the file the CDN serves named
neither.

This changelog ships with the package, and the artifacts are rebuilt under
rolldown 1.3.2.

## 0.2.0 (2026-08-05)

Breaking: `at(x, y)` is replaced by two queries. `nearest(x, y)` returns the
nearest legal point as `{ x, y, distance }`; `offset(x, y)` returns the
additive correction as `{ dx, dy, distance }`. The former `d` field is now
`distance`, and the former unit vector plus separate magnitude is now a single
scaled vector.

`route(a, b)` sets `moved` on the returned array, reporting whether either
endpoint had to be pulled out of an obstacle before routing.

Routes no longer alias interior mesh points, so a caller may mutate the
waypoints it receives.

## 0.1.1 (2026-08-05)

Corrected the version-pinned CDN links in the README.

## 0.1.0 (2026-08-05)

First release. `build()` snapshots DOM rectangles once; `at()` and `route()`
answer from cached geometry without triggering layout.
