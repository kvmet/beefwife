import chevronGuySource from "../../../beefwife/samples/chevron-guy.json";

// The preview is not color graded or post-processed. Its look comes entirely
// from this initial descriptor, which will eventually be replaced by the
// document assembled by the editor controls.
export const chevronGuy = {
  ...structuredClone(chevronGuySource),
  name: "beefwife",
};
