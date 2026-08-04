/** Pixi scene synchronization and optional route debugging for BeefwifeCanvasRuntime. */

const BeefwifeCanvasRender = (() => {
  const drawTerrain = (graphics, terrain) => {
    for (const rectangle of terrain.rects)
      graphics.rect(
        rectangle.left,
        rectangle.top,
        rectangle.right - rectangle.left,
        rectangle.bottom - rectangle.top,
      );
    graphics.stroke({ color: 0x50dca0, alpha: 0.55, width: 1 });
    graphics
      .rect(
        terrain.x0,
        terrain.y0,
        terrain.x1 - terrain.x0,
        terrain.y1 - terrain.y0,
      )
      .stroke({ color: 0x50dca0, alpha: 0.3, width: 1 });
  };

  const drawNavigation = (graphics, terrain) => {
    for (const cell of terrain.cells)
      graphics.rect(
        cell.left,
        cell.lo,
        cell.right - cell.left,
        cell.hi - cell.lo,
      );
    graphics.stroke({ color: 0x78a0dc, alpha: 0.35, width: 1 });
    for (const gate of terrain.gates)
      graphics.moveTo(gate.x, gate.lo).lineTo(gate.x, gate.hi);
    graphics.stroke({ color: 0xf0c85a, alpha: 0.8, width: 2 });
  };

  const drawRoute = (graphics, actor) => {
    const head = actor.beefwife.getPose().head;
    const path = actor.route.path;
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
    const target = actor.planner?.goal;
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

  const draw = (host) => {
    const scene = host.scene;
    scene.syncActors(host.actors);
    scene.debugUnderlay.clear();
    scene.debugOverlay.clear();
    if (host.debug.terrain) drawTerrain(scene.debugUnderlay, host.terrain);
    if (host.debug.navigation)
      drawNavigation(scene.debugUnderlay, host.terrain);
    if (host.debug.routes)
      for (const actor of host.actors)
        drawRoute(scene.debugOverlay, actor);
    if (host.debug.targets)
      for (const actor of host.actors)
        drawTarget(scene.debugOverlay, actor);
    scene.render();
  };

  return { draw };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeCanvasRender;
}
