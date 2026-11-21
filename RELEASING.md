# Releasing

Three packages publish to npm: `@kvmet/beefwife` from `beefwife/`,
`@kvmet/beefwife-canvas` from `beefwife-canvas/`, and `@kvmet/terrain` from
`terrain/`. `beefwife-lab/` does not publish.

Each package has its own version, changelog, and tags. A tag is
`<package>-v<version>`, such as `beefwife-v0.2.0`.

## 1. Find what changed

For each package, compare the folder with its last tag:

```sh
git diff --stat beefwife-v0.1.1 HEAD -- beefwife
```

`beefwife-canvas` bundles `beefwife/src` and `terrain/src`. A change to either
source folder changes the canvas bundle, so the canvas package needs a release
too. A change only to `beefwife-lab/`, `test/`, or the root README needs no
release.

## 2. Pick the version

The packages are 0.x. A breaking change raises the minor version (0.1.1 to
0.2.0). Anything else raises the patch version (0.2.1 to 0.2.2). A changed
error message counts as breaking when callers can match on its text.

## 3. Raise the version

From the repository root:

```sh
npm version 0.2.0 --no-git-tag-version --prefix beefwife
```

`--no-git-tag-version` is required. Without it, npm commits at once and makes
a tag named `v0.2.0`, which the other packages would use too.

## 4. Write the changelog

Add an entry at the top of `<package>/CHANGELOG.md`:

```md
## 0.2.0 (2026-11-21)

Breaking: ...
```

Write it in prose. Put breaking changes first. A canvas entry names the
beefwife and terrain versions it is built on.

## 5. Update versioned URLs and file lists

The CDN examples name an exact version. Search for the old version and change
each one:

```sh
grep -rn "@0.1.1" README.md beefwife/README.md beefwife-canvas/README.md terrain/README.md
```

If the release adds or removes a shipped file, such as a sample, update the
file list in `test/<package>/package.test.mjs` and the sample lists in the
READMEs.

## 6. Rebuild and check

The bundles are committed. CI rebuilds them and fails when the result differs
from the commit, so rebuild before you commit:

```sh
bb beefwife-build
bb test
bb terrain
bb beefwife-package
bb canvas-package
npm --prefix beefwife-lab run check
```

`bb test` builds the canvas bundle first. `bb terrain` builds the terrain
bundle first.

## 7. Commit and tag

Make one release commit with the version raises, changelogs, READMEs, and
rebuilt bundles:

```sh
git commit -m "chore(release): release beefwife and canvas 0.2.0"
```

Then tag that commit once for each released package, and push the commit and
the tags:

```sh
git tag beefwife-v0.2.0
git tag beefwife-canvas-v0.2.0
git push
git push origin beefwife-v0.2.0 beefwife-canvas-v0.2.0
```

## 8. Publish

Publish each released package from its own folder. `prepack` builds and tests
the package again before it packs:

```sh
cd beefwife && npm publish
```
