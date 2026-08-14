import undulating from "../../../beefwife/samples/undulating.json";

// The body the lab opens on, and the one it falls back to when a saved
// document will not load. Its look comes entirely from this descriptor: the
// preview is not color graded or post-processed.
export const defaultBeefwife = {
  ...structuredClone(undulating),
  name: "beefwife",
};
