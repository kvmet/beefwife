import { writable } from "svelte/store";
import { chevronGuy } from "./defaultBeefwife.js";

/* The descriptor under edit, which the panels write in place. Stage sends a
   copy to the live actor, because the library freezes what it is handed. */
export const descriptor = writable(structuredClone(chevronGuy));

/** The values the editor started from; controls reset to these. */
export const defaults = chevronGuy;

/** Message from the last rejected apply, or null while the canvas accepts. */
export const applyError = writable(null);

/** The chain's sections, head to tail. */
export const SECTION_NAMES = ["head", "trunk", "tail"];

/* Read on use rather than on import: the runtime is a classic script that
   loads after these modules evaluate. */

/** The ids the validator accepts, for shapes, paints, and materials. */
export const idPattern = () => window.BeefwifeCanvas.Descriptor.ID_PATTERN;

/* Only a hyphen at the edge of a character class stands for itself; escaping
   one between two characters would turn a range into three literals. */
const escapeBareHyphens = (source) =>
  source.replace(/\[-/g, "[\\-").replace(/-(?=\])/g, "\\-");

/**
 * The names the validator accepts, as an `input` pattern. The attribute
 * compiles in unicodeSets mode, where a bare hyphen is an invalid character
 * class, and a pattern that fails to compile is ignored rather than reported:
 * every name would pass.
 */
export const namePattern = () =>
  escapeBareHyphens(window.BeefwifeCanvas.Descriptor.NAME_PATTERN.source);

/**
 * Chain-wide chunk indices a placement resolves to.
 * TODO: mirrors BeefwifeDescriptor's resolvedChunks; sample via a beefwife
 * API export once placement resolution is public. Unlike the validator this
 * returns what fits instead of failing, so a half-edited placement still
 * draws.
 */
export function placementChunks(chain, placement) {
  const sections = chain.sections;
  const starts = {
    head: 0,
    trunk: sections.head.chunks,
    tail: sections.head.chunks + sections.trunk.chunks,
  };
  const name = placement.at.section;
  const length = name
    ? sections[name].chunks
    : SECTION_NAMES.reduce((sum, other) => sum + sections[other].chunks, 0);
  const offset = placement.at.offset;
  if (!length || offset >= length) return [];
  const step = placement.repeat.step;
  const direction = placement.at.from === "head" ? 1 : -1;
  const start =
    (name ? starts[name] : 0) + (direction > 0 ? offset : length - 1 - offset);
  const available = Math.floor((length - 1 - offset) / step) + 1;
  const count = Math.min(placement.repeat.count ?? available, available);
  return Array.from({ length: count }, (_, i) => start + direction * i * step);
}

/** Smallest chunk count each section allows; only the tail may vanish. */
export const SECTION_MINIMUMS = { head: 1, trunk: 1, tail: 0 };
