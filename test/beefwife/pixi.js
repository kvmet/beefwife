/**
 * The renderer the library itself resolved, plus readers for the parts of a
 * context Pixi normalises on the way in. Colours become numbers, and a
 * context's own bounds grow by half the stroke width, so a test that wants the
 * drawn geometry reads the fill path instead.
 */

const { PIXI } = require("../../beefwife/src/pixi.mjs");

const paintOf = (context, action) =>
  context.instructions
    .filter((instruction) => instruction.action === action)
    .map((instruction) => instruction.data.style);

const fillsOf = (context) => paintOf(context, "fill").map(({ color }) => color);
const strokesOf = (context) =>
  paintOf(context, "stroke").map(({ color, width }) => ({ color, width }));

const colourNumber = (value) => new PIXI.Color(value).toNumber();
const colourText = (value) => `#${value.toString(16).padStart(6, "0")}`;

/* Outlines are drawn command by command, so the vertices come back off the
   stroke's own path. A graphics that drew nothing has no stroke to read. */
const pointsOf = (graphics) => {
  const stroke = graphics.context.instructions.find(
    ({ action }) => action === "stroke",
  );
  if (!stroke) return [];
  return stroke.data.path.instructions
    .filter(({ action }) => action === "moveTo" || action === "lineTo")
    .map(({ data }) => [...data]);
};

const widthOf = (bounds) => bounds.maxX - bounds.minX;
const drawnWidthOf = (context) =>
  widthOf(context.instructions.find(({ data }) => data?.path).data.path.bounds);
const pathWidthOf = (path) => widthOf(new PIXI.GraphicsPath(path).bounds);

module.exports = {
  PIXI,
  fillsOf,
  pointsOf,
  strokesOf,
  colourNumber,
  colourText,
  drawnWidthOf,
  pathWidthOf,
};
