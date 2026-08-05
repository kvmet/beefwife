/** Pixi scene synchronization and optional route debugging for BeefwifeCanvasRuntime. */

const BeefwifeCanvasRender = (() => {
  const drawTerrain = (graphics, terrainView) => {
    for (const rectangle of terrainView.rectangles)
      graphics.rect(
        rectangle.left,
        rectangle.top,
        rectangle.right - rectangle.left,
        rectangle.bottom - rectangle.top,
      );
    graphics.stroke({ color: 0x50dca0, alpha: 0.55, width: 1 });
    const bounds = terrainView.bounds;
    graphics
      .rect(
        bounds.left,
        bounds.top,
        bounds.right - bounds.left,
        bounds.bottom - bounds.top,
      )
      .stroke({ color: 0x50dca0, alpha: 0.3, width: 1 });
  };

  const drawRoute = (graphics, actor) => {
    const { head, route: path } = actor;
    if (!path.length) return;
    graphics.moveTo(head.x, head.y);
    path.forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.stroke({ color: 0xc8b478, alpha: 0.5, width: 1 });
    path.forEach((point) => {
      graphics
        .circle(point.x, point.y, 2.5)
        .stroke({ color: 0xc8b478, alpha: 0.5, width: 1 });
    });
  };

  const drawTarget = (graphics, actor) => {
    const target = actor.target;
    if (!target) return;
    graphics
      .circle(target.x, target.y, 5)
      .stroke({ color: 0xf06c9b, alpha: 0.9, width: 2 });
    graphics
      .moveTo(target.x - 8, target.y)
      .lineTo(target.x + 8, target.y)
      .moveTo(target.x, target.y - 8)
      .lineTo(target.x, target.y + 8)
      .stroke({ color: 0xf06c9b, alpha: 0.75, width: 1 });
  };

  const draw = ({ actors, debug, scene, terrainView }) => {
    scene.syncDisplays(actors.map((actor) => actor.display));
    scene.debugUnderlay.clear();
    scene.debugOverlay.clear();
    if (debug.terrain) drawTerrain(scene.debugUnderlay, terrainView);
    if (debug.routes)
      for (const actor of actors)
        drawRoute(scene.debugOverlay, actor);
    if (debug.targets)
      for (const actor of actors)
        drawTarget(scene.debugOverlay, actor);
    scene.render();
  };

  return { draw };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeCanvasRender;
}
