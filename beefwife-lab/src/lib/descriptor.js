import { get, writable } from "svelte/store";
import { defaultBeefwife } from "./defaultBeefwife.js";

/* One slot, holding the document under edit, so a refresh or a closed tab
   costs nothing. Undo history lives in memory only. */
const STORAGE_KEY = "beefwife-lab:document";
/* Long enough that a slider drag writes once on release, not once a pixel.
   The same gap closes one undo step, so a drag undoes in one press. */
const SAVE_DELAY = 400;
const HISTORY_LIMIT = 100;

/* Fields the panels read before the runtime ever sees the document. A slot
   missing one crashes every later load rather than the edit that broke it,
   so it is dropped for the boot body instead. A document that has them all
   is restored whether or not the schema accepts it: out-of-range values are
   what applyError is for, and they are the edits worth not losing. */
const EDITABLE = ["name", "definitions", "gait", "chain", "legs"];

const editable = (value) =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  EDITABLE.every((key) => key in value);

/** Where the panel's save badge stands: saving, saved, or failed. */
export const saveState = writable("saved");
/** Why the slot could not be read or written, or null while it works. */
export const saveError = writable(null);

/* Read once, before the store exists, so the editor opens on what the last
   session left rather than replacing it a frame later. */
function restore() {
  let text;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    saveError.set(`Saving is off: ${error.message}`);
    saveState.set("failed");
    return null;
  }
  if (text === null) return null;
  try {
    const value = JSON.parse(text);
    if (editable(value)) return value;
    saveError.set("The saved beefwife was missing parts and was not opened.");
  } catch (error) {
    saveError.set(`The saved beefwife could not be read: ${error.message}`);
  }
  saveState.set("failed");
  return null;
}

/* The descriptor under edit, which the panels write in place. Stage sends a
   copy to the live actor, because the library freezes what it is handed. */
export const descriptor = writable(
  restore() ?? structuredClone(defaultBeefwife),
);

/** Whether the document carries edits made since it was last replaced. */
export const dirty = writable(false);

/* Its own copy: the panels write the store's document in place, and Revert
   has to hand back what was loaded rather than what it has become. */
let lastLoaded = structuredClone(get(descriptor));
let replacing = false;
let restoring = false;
let started = false;
let saveTimer = 0;

/* Undo history, as JSON text: `settled` is the document after the last
   closed step, and `past` and `future` hold the steps either side of it. */
const past = [];
const future = [];
let settled = JSON.stringify(get(descriptor));
let settleTimer = 0;

/** Whether Undo and Redo have a step to take. */
export const canUndo = writable(false);
export const canRedo = writable(false);

/* Closes the step in progress, if the document changed since the last one. */
function settle() {
  clearTimeout(settleTimer);
  const current = JSON.stringify(get(descriptor));
  if (current !== settled) {
    past.push(settled);
    if (past.length > HISTORY_LIMIT) past.shift();
    future.length = 0;
    settled = current;
  }
  canUndo.set(past.length > 0);
  canRedo.set(future.length > 0);
}

function travel(from, to) {
  settle();
  if (!from.length) return;
  to.push(settled);
  settled = from.pop();
  restoring = true;
  try {
    descriptor.set(JSON.parse(settled));
  } finally {
    restoring = false;
  }
  dirty.set(settled !== JSON.stringify(lastLoaded));
  canUndo.set(past.length > 0);
  canRedo.set(future.length > 0);
}

/** Step the document back to before the last burst of edits. */
export const undo = () => travel(past, future);
/** Take back the last undo. */
export const redo = () => travel(future, past);

function persist(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    saveState.set("saved");
    saveError.set(null);
  } catch (error) {
    saveState.set("failed");
    saveError.set(`Not saved: ${error.message}`);
  }
}

descriptor.subscribe((value) => {
  /* subscribe reports the document at once; the one the editor opened on is
     neither an edit nor worth writing back. */
  if (!started) {
    started = true;
    return;
  }
  if (!replacing) dirty.set(true);
  if (!restoring) {
    canUndo.set(true);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SAVE_DELAY);
  }
  saveState.set("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(value), SAVE_DELAY);
});

/**
 * Put a whole document under edit: a preset, an opened file, or a revert.
 * Every path that replaces rather than edits goes through here, so the panel
 * knows when there is work a replacement would drop.
 */
export function replaceDocument(value) {
  settle();
  lastLoaded = structuredClone(value);
  replacing = true;
  try {
    descriptor.set(value);
  } finally {
    replacing = false;
  }
  dirty.set(false);
  // A replacement is one undo step of its own, never merged with an edit.
  settle();
}

/** Hand back the document as the last preset, file, or refresh left it. */
export function revertDocument() {
  replaceDocument(structuredClone(lastLoaded));
}

/* A document leaving the lab is the checked-in form, so it goes out in
   canonical key order when the runtime accepts it and as it stands when
   it does not. */
export function canonicalDocument() {
  const value = get(descriptor);
  try {
    return `${window.BeefwifeCanvas.Descriptor.stringify(value)}\n`;
  } catch {
    return `${JSON.stringify(value, null, 2)}\n`;
  }
}

export function downloadDocument() {
  const url = URL.createObjectURL(
    new Blob([canonicalDocument()], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${get(descriptor).name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Open a chosen file. Throws the parse error, which the caller reports. */
export async function openDocumentFile(file) {
  replaceDocument(JSON.parse(await file.text()));
}

/* The clipboard is refused outright under some permissions policies, and a
   copy that quietly did nothing is worse than one that says so. */
export function copyText(text) {
  return navigator.clipboard.writeText(text).then(
    () => "Copied",
    (error) => error.message,
  );
}

/** Message from the last rejected apply, or null while the canvas accepts. */
export const applyError = writable(null);

/** What the preview repaired to draw the document: { path, rule, repaired }. */
export const applyWarnings = writable([]);

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
