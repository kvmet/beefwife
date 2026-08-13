/** Pixi scene synchronization and optional route debugging for BeefwifeCanvasRuntime. */

/* `pixel` is the canvas pixels one renderer pixel covers, and never less than
   one. The renderer runs at `resolutionScale` and the canvas is stretched back
   over it, so a mark sized in canvas pixels covers a quarter of a renderer
   pixel at 0.25 and reaches the screen as a blob of partial coverage. Holding
   the floor at one canvas pixel keeps a renderer finer than the canvas, which
   is every retina display at full scale, drawing these at the size they are
   written here. */
const drawTerrain = (graphics, terrainView, pixel) => {
  for (const rectangle of terrainView.rectangles)
    graphics.rect(
      rectangle.left,
      rectangle.top,
      rectangle.right - rectangle.left,
      rectangle.bottom - rectangle.top,
    );
  graphics.stroke({ color: 0x50dca0, alpha: 0.55, width: pixel });
  const bounds = terrainView.bounds;
  graphics
    .rect(
      bounds.left,
      bounds.top,
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
    )
    .stroke({ color: 0x50dca0, alpha: 0.3, width: pixel });
};

const drawRoute = (graphics, actor, pixel) => {
  const { head, route: path } = actor;
  if (!path.length) return;
  graphics.moveTo(head.x, head.y);
  path.forEach((point) => graphics.lineTo(point.x, point.y));
  graphics.stroke({ color: 0xc8b478, alpha: 0.5, width: pixel });
  path.forEach((point) => {
    graphics
      .circle(point.x, point.y, 2.5 * pixel)
      .stroke({ color: 0xc8b478, alpha: 0.5, width: pixel });
  });
};

const drawTarget = (graphics, actor, pixel) => {
  const target = actor.target;
  if (!target) return;
  graphics
    .circle(target.x, target.y, 5 * pixel)
    .stroke({ color: 0xf06c9b, alpha: 0.9, width: 2 * pixel });
  graphics
    .moveTo(target.x - 8 * pixel, target.y)
    .lineTo(target.x + 8 * pixel, target.y)
    .moveTo(target.x, target.y - 8 * pixel)
    .lineTo(target.x, target.y + 8 * pixel)
    .stroke({ color: 0xf06c9b, alpha: 0.75, width: pixel });
};

const draw = ({ actors, debug, scene, terrainView }) => {
  scene.syncDisplays(actors.map((actor) => actor.display));
  scene.debugUnderlay.clear();
  scene.debugOverlay.clear();
  const pixel = Math.max(1, 1 / scene.renderOptions.pixelResolution);
  if (debug.terrain) drawTerrain(scene.debugUnderlay, terrainView, pixel);
  if (debug.routes)
    for (const actor of actors) drawRoute(scene.debugOverlay, actor, pixel);
  if (debug.targets)
    for (const actor of actors) drawTarget(scene.debugOverlay, actor, pixel);
  scene.render();
};

export { draw };
