import { defineConfig } from "rolldown";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
const banner =
  `/* Terrain v${version}. Generated from terrain/src; do not edit. */`;
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
