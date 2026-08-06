import { writable } from "svelte/store";
import { rustWalker } from "./defaultBeefwife.js";

/** The descriptor under edit. Stage applies every change to the live actor. */
export const descriptor = writable(structuredClone(rustWalker));

/** The values the editor started from; controls reset to these. */
export const defaults = rustWalker;

/** Message from the last rejected apply, or null while the canvas accepts. */
export const applyError = writable(null);
