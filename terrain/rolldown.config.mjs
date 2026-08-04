import { defineConfig } from "rolldown";

const banner = "/* Terrain v0.1.0. Generated from terrain/src; do not edit. */";
const footer =
  'if (typeof module !== "undefined" && module.exports) module.exports = Terrain;';
const output = (file, minify) => ({
  file,
  format: "iife",
  name: "Terrain",
  exports: "default",
  banner,
  footer,
  minify,
  keepNames: true,
  topLevelVar: true,
});

export default defineConfig([
  {
    input: "src/terrain.mjs",
    output: output("terrain.js", false),
  },
  {
    input: "src/terrain.mjs",
    output: output("terrain.min.js", true),
  },
]);
