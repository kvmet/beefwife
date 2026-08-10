/**
 * The renderer seam. Pixi is a peer, not a dependency: the module build imports
 * it and the classic-script build reads the page's global, which may be absent.
 * Every Pixi reference in the library arrives through here, so `available` is
 * the one place that decides whether a beefwife draws or only simulates.
 */

import * as pixi from "pixi.js";

export const PIXI = pixi;
export const available = typeof PIXI?.Container === "function";
