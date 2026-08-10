import { defineConfig } from "rolldown";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
const banner = `/* Beefwife v${version}. Generated from beefwife/src; do not edit. */`;
const footer =
  'if (typeof module !== "undefined" && module.exports) module.exports = Beefwife;';
/* Pixi is read from the page rather than bundled, and a property lookup is
   undefined when no renderer is loaded where a bare identifier would throw. */
const output = (file, minify) => ({
  file,
  format: "iife",
  name: "Beefwife",
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
    input: "src/global.mjs",
    external: ["pixi.js"],
    output: output("beefwife.js", false),
  },
  {
    input: "src/global.mjs",
    external: ["pixi.js"],
    output: output("beefwife.min.js", true),
  },
]);
