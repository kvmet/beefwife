import { writable } from "svelte/store";
import { rustWalker } from "./defaultBeefwife.js";

/** The descriptor under edit. Stage applies every change to the live actor. */
export const descriptor = writable(structuredClone(rustWalker));

/** The values the editor started from; controls reset to these. */
export const defaults = rustWalker;

/** Message from the last rejected apply, or null while the canvas accepts. */
export const applyError = writable(null);

/** The chain's sections, head to tail. */
export const SECTION_NAMES = ["head", "trunk", "tail"];

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
  const name = placement.at.scope === "section" ? placement.at.section : null;
  if (placement.at.scope === "section" && !name) return [];
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
