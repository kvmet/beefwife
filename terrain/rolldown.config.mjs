import { defineConfig } from "rolldown";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
/* The leading ! keeps the notice through minification; a plain block comment
   is stripped, leaving the CDN artifact with no copyright or license. */
const banner =
  `/*! Terrain v${version}. Generated from terrain/src; do not edit.
   (c) Kristen Metcalfe, MIT. */`;
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
