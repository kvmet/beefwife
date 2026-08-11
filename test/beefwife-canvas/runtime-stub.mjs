/**
 * Stands in for the canvas runtime so a boundary check runs without a
 * renderer. The page supplies the host, which keeps the record of what mount
 * passed down in the test rather than here.
 */

const BeefwifeCanvasRuntime = {
  create: (options) => globalThis.hostFor(options),
};

export { BeefwifeCanvasRuntime };
