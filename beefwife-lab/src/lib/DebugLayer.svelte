<script>
  import { onDestroy } from "svelte";

  /* The runtime's own debug layers draw inside the low-resolution renderer,
     where a plan line covers a fraction of a pixel. This one reads the same
     state through the public accessors and draws it at full resolution. */
  export let runtime = null;
  export let routes = false;
  export let targets = false;
  export let bounds = false;
  export let padding = 0;

  const TERRAIN = "#50dca0";
  const ROUTE = "#c8b478";
  const TARGET = "#f06c9b";

  let canvas;
  let frame = 0;
  let width = 0;
  let height = 0;

  $: active = Boolean(runtime) && (routes || targets || bounds);
  $: run(active && Boolean(canvas));

  function run(wanted) {
    if (wanted === Boolean(frame)) return;
    if (!wanted) {
      cancelAnimationFrame(frame);
      frame = 0;
      clear();
      return;
    }
    frame = requestAnimationFrame(paint);
  }

  function context() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const pixels = [Math.round(width * ratio), Math.round(height * ratio)];
    if (canvas.width !== pixels[0] || canvas.height !== pixels[1]) {
      canvas.width = pixels[0];
      canvas.height = pixels[1];
    }
    const drawing = canvas.getContext("2d");
    drawing.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawing.clearRect(0, 0, width, height);
    drawing.lineWidth = 1;
    return drawing;
  }

  function clear() {
    if (canvas?.width) canvas.getContext("2d").clearRect(0, 0, 1e4, 1e4);
  }

  function paint() {
    frame = requestAnimationFrame(paint);
    if (!canvas || !runtime) return;
    const drawing = context();
    if (bounds) drawField(drawing, runtime.getTerrainView());
    if (!routes && !targets) return;
    for (const actor of runtime.getActors()) {
      if (routes) drawRoute(drawing, actor.getPose().head, actor.getRoute());
      if (targets) drawTarget(drawing, actor.getTarget(), actor.id);
    }
  }

  /* The margin wander targets are kept inside, and the obstacle footprints the
     router actually plans around. An unpadded footprint lands on the edge of
     the box that was drawn, where stroking it again only doubles that line. */
  function drawField(drawing, view) {
    drawing.strokeStyle = TERRAIN;
    if (padding > 0) {
      drawing.globalAlpha = 0.55;
      for (const box of view.rectangles)
        drawing.strokeRect(
          box.left,
          box.top,
          box.right - box.left,
          box.bottom - box.top,
        );
    }
    const edge = view.bounds;
    drawing.globalAlpha = 0.45;
    drawing.setLineDash([4, 4]);
    drawing.strokeRect(
      edge.left,
      edge.top,
      edge.right - edge.left,
      edge.bottom - edge.top,
    );
    drawing.setLineDash([]);
    drawing.globalAlpha = 1;
  }

  function drawRoute(drawing, head, path) {
    if (!path.length) return;
    drawing.strokeStyle = ROUTE;
    drawing.globalAlpha = 0.6;
    drawing.beginPath();
    drawing.moveTo(head.x, head.y);
    for (const point of path) drawing.lineTo(point.x, point.y);
    drawing.stroke();
    for (const point of path) {
      drawing.beginPath();
      drawing.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      drawing.stroke();
    }
    drawing.globalAlpha = 1;
  }

  function drawTarget(drawing, target, id) {
    if (!target) return;
    drawing.strokeStyle = TARGET;
    drawing.beginPath();
    drawing.arc(target.x, target.y, 5, 0, Math.PI * 2);
    drawing.stroke();
    drawing.globalAlpha = 0.75;
    drawing.beginPath();
    drawing.moveTo(target.x - 9, target.y);
    drawing.lineTo(target.x + 9, target.y);
    drawing.moveTo(target.x, target.y - 9);
    drawing.lineTo(target.x, target.y + 9);
    drawing.stroke();
    drawing.globalAlpha = 1;
    drawing.fillStyle = TARGET;
    drawing.font = '9px "B612 Mono", monospace';
    drawing.fillText(String(id), target.x + 8, target.y - 8);
  }

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<canvas bind:this={canvas} class="debug-layer" aria-hidden="true"></canvas>

<style>
  .debug-layer {
    position: absolute;
    z-index: 2;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
