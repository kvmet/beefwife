import chevronGuy from "../../../beefwife/samples/chevron-guy.json";
import peristaltic from "../../../beefwife/samples/peristaltic.json";
import raccoon from "../../../beefwife/samples/raccoon.json";
import undulating from "../../../beefwife/samples/undulating.json";

/**
 * Move styles the easy panel offers, in the order it shows them. A preset
 * replaces the document whole, so each one carries its look along with its
 * gait. Point a label at another sample to change what it means.
 */
export const PRESETS = [
  { key: "snake", label: "Snake", document: undulating },
  { key: "worm", label: "Worm", document: peristaltic },
  { key: "raccoon", label: "Raccoon", document: raccoon },
  { key: "centipede", label: "Centipede", document: chevronGuy },
];
