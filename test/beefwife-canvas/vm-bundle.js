/**
 * Builds a browser bundle out of the canvas sources for a test to run in a vm.
 * The runtime cannot be exercised against the real renderer, because Pixi's
 * Application needs a document to init against, so these tests supply a page
 * and a renderer of their own. ESM has no runtime module swap, so a test that
 * needs a stub collaborator names it here, where the bundler resolves imports.
 */

const path = require("node:path");

const packageRoot = path.join(__dirname, "..", "..", "beefwife-canvas");
const sourceRoot = path.join(packageRoot, "src");
const rolldownPath = require.resolve("rolldown", { paths: [packageRoot] });

const ENTRY = "\0test-entry";

const moduleOf = (file) => path.join(sourceRoot, file);

/* `source` is the entry's code, so a caller picks which binding becomes the
   one global the bundle defines. `aliases` maps an import specifier as the
   importing module writes it onto the file that answers it instead. */
const bundleFor = async ({ source, name, aliases = {} }) => {
  const { rolldown } = require(rolldownPath);
  const bundle = await rolldown({
    input: ENTRY,
    external: ["pixi.js"],
    plugins: [
      {
        name: "test-entry",
        resolveId(specifier, importer) {
          if (specifier === ENTRY) return ENTRY;
          if (importer === ENTRY) return moduleOf(specifier);
          return aliases[specifier] ?? null;
        },
        load(id) {
          return id === ENTRY ? source : null;
        },
      },
    ],
  });
  const { output } = await bundle.generate({
    format: "iife",
    name,
    exports: "default",
    globals: { "pixi.js": "globalThis.PIXI" },
    topLevelVar: true,
    keepNames: true,
  });
  await bundle.close();
  return output[0].code;
};

module.exports = { bundleFor, moduleOf };
