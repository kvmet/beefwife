import { defineConfig } from "rolldown";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
/* Beefwife and terrain are inlined, so their notices ride in the artifact that
   carries their code. */
const banner = `/* Beefwife Canvas v${version}. Generated from beefwife-canvas/src; do not edit.
   Bundles @kvmet/beefwife (MPL-2.0) and @kvmet/terrain (MIT, (c) Kristen Metcalfe). */`;
const footer =
  'if (typeof module !== "undefined" && module.exports) module.exports = BeefwifeCanvas;';
/* Pixi is read from the page rather than bundled, and a property lookup is
   undefined when no renderer is loaded where a bare identifier would throw. */
const output = (file, minify) => ({
  file,
  format: "iife",
  name: "BeefwifeCanvas",
  exports: "default",
  globals: { "pixi.js": "globalThis.PIXI" },
  banner,
  footer,
  minify,
  keepNames: true,
  topLevelVar: true,
});

export default defineConfig([
  {
    input: "src/canvas.mjs",
    external: ["pixi.js"],
    output: output("beefwife-canvas.js", false),
  },
  {
    input: "src/canvas.mjs",
    external: ["pixi.js"],
    output: output("beefwife-canvas.min.js", true),
  },
]);
