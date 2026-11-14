# Changelog

Notable changes to `@kvmet/terrain`, newest first. This package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

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
