import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";

const runtimePath = new URL("../beefwife-canvas/beefwife-canvas.js", import.meta.url);

function beefwifeCanvasRuntime() {
  const fileName = "vendor/beefwife-canvas.js";
  const source = () => readFileSync(runtimePath);

  return [
    {
      name: "beefwife-canvas-runtime-serve",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use(`/${fileName}`, (_request, response) => {
          response.setHeader("Content-Type", "text/javascript; charset=utf-8");
          response.end(source());
        });
      },
    },
    {
      name: "beefwife-canvas-runtime-build",
      apply: "build",
      buildStart() {
        this.emitFile({ type: "asset", fileName, source: source() });
      },
    },
  ];
}

export default defineConfig({
  // Relative asset URLs let the built site run from any path, such as /lab/.
  base: "./",
  plugins: [svelte(), ...beefwifeCanvasRuntime()],
});
