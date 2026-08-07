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

/** Smallest chunk count each section allows; only the tail may vanish. */
export const SECTION_MINIMUMS = { head: 1, trunk: 1, tail: 0 };
