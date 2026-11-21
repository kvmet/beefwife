<script context="module">
  /**
   * Points of a path that is one closed polygon: M/L/H/V commands, absolute
   * or relative, one subpath. Curves, arcs, and extra subpaths return null,
   * and the editor falls back to editing the path as text.
   */
  export function parsePolygon(path) {
    const tokens = path.match(
      /[A-Za-z]|[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g,
    );
    if (!tokens) return null;
    const points = [];
    let command = null;
    let x = 0;
    let y = 0;
    let i = 0;
    const read = () => Number(tokens[i++]);
    while (i < tokens.length) {
      if (/^[A-Za-z]$/.test(tokens[i])) {
        command = tokens[i++];
        if (command === "Z" || command === "z") {
          return i === tokens.length && points.length >= 3 ? points : null;
        }
        if ((command === "M" || command === "m") && points.length) return null;
        continue;
      }
      switch (command) {
        case "M":
        case "L":
          x = read();
          y = read();
          break;
        case "m":
        case "l":
          x += read();
          y += read();
          break;
        case "H":
          x = read();
          break;
        case "h":
          x += read();
          break;
        case "V":
          y = read();
          break;
        case "v":
          y += read();
          break;
        default:
          return null;
      }
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      points.push({ x, y });
    }
    return points.length >= 3 ? points : null;
  }

  /** Tight viewBox around a polygon path's own extent for a list thumbnail. */
  export function thumbBox(path) {
    const points = parsePolygon(path);
    if (!points) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return `${minX - 0.5} ${minY - 0.5} ${Math.max(...xs) - minX + 1} ${Math.max(...ys) - minY + 1}`;
  }
</script>

<script>
  import { descriptor } from "./descriptor.js";
  import Tooltip from "./Tooltip.svelte";

  /** Id of the shape under edit in $.definitions.shapes. */
  export let id;

  const round = (value) => Math.round(value * 100) / 100;
  const serialize = (points) =>
    points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ") + " Z";

  let surface;
  let width = 0;
  let height = 0;
  let view = { x: -8, y: -8, w: 16, h: 16 };
  let dragging = -1;
  let selected = -1;
  let moved = false;
  let fitted = null;
  let lastTap = { index: -1, time: 0 };

  $: path = $descriptor.definitions.shapes[id]?.path ?? "";
  $: points = parsePolygon(path);
  $: if (id !== fitted) {
    fitted = id;
    selected = -1;
    if (points) fit(points);
  }
  /* Screen pixels per shape unit, for handles that keep their size while the
     viewBox is in shape units. */
  $: scale = Math.min(width / view.w, height / view.h) || 1;
  $: edges = points
    ? points.map((p, i) => {
        const q = points[(i + 1) % points.length];
        return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      })
    : [];
  $: grid = gridFor(view);

  /* The origin stays in frame because a placement positions the shape by its
     origin, so the offset from 0,0 is part of the drawing. The view holds
     still during a drag and refits on release, so the artwork does not swim
     under the pointer. */
  function fit(shapePoints) {
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    for (const p of shapePoints) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = Math.max(2, (maxX - minX) * 0.2, (maxY - minY) * 0.2);
    view = {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    };
  }

  function gridFor(box) {
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100];
    const step = steps.find((s) => Math.max(box.w, box.h) / s <= 24) ?? 200;
    const lines = (from, to) => {
      const out = [];
      for (let t = Math.ceil(from / step) * step; t <= to; t += step)
        out.push(round(t));
      return out;
    };
    return {
      step,
      xs: lines(box.x, box.x + box.w),
      ys: lines(box.y, box.y + box.h),
    };
  }

  function toUnits(event) {
    const point = new DOMPoint(event.clientX, event.clientY);
    const p = point.matrixTransform(surface.getScreenCTM().inverse());
    return { x: round(p.x), y: round(p.y) };
  }

  function write(next) {
    $descriptor.definitions.shapes[id].path = serialize(next);
  }

  /* Double-click removal is detected from pointerdown timing because the
     dblclick event does not survive the pointer capture a drag needs. */
  function startDrag(event, index) {
    event.stopPropagation();
    if (lastTap.index === index && event.timeStamp - lastTap.time < 400) {
      lastTap = { index: -1, time: 0 };
      removePoint(index);
      return;
    }
    lastTap = { index, time: event.timeStamp };
    selected = index;
    dragging = index;
    moved = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startInsert(event, index) {
    event.stopPropagation();
    lastTap = { index: -1, time: 0 };
    write(points.toSpliced(index + 1, 0, edges[index]));
    selected = index + 1;
    dragging = index + 1;
    moved = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event) {
    if (dragging < 0) return;
    moved = true;
    write(points.with(dragging, toUnits(event)));
  }

  function endDrag() {
    if (dragging < 0) return;
    dragging = -1;
    if (!moved) return;
    lastTap = { index: -1, time: 0 };
    if (points) fit(points);
  }

  function removePoint(index) {
    if (!points || points.length <= 3) return;
    selected = -1;
    const next = points.toSpliced(index, 1);
    write(next);
    fit(next);
  }

  /* Whole-shape edits refit the view, as a released drag does. */
  function transform(map) {
    const next = points.map(map);
    write(next);
    fit(next);
  }

  /* Screen y points down, so a positive angle turns clockwise on screen.
     Quarter turns swap coordinates exactly; other angles round like a drag. */
  function rotate(degrees) {
    if (degrees === 90) return transform((p) => ({ x: -p.y || 0, y: p.x }));
    if (degrees === -90) return transform((p) => ({ x: p.y, y: -p.x || 0 }));
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    transform((p) => ({
      x: round(p.x * cos - p.y * sin),
      y: round(p.x * sin + p.y * cos),
    }));
  }

  function move(dx, dy) {
    transform((p) => ({ x: round(p.x + dx), y: round(p.y + dy) }));
  }

  /* Puts the middle of the shape's extent on the origin, where a placement
     attaches it. */
  function center() {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    move(
      -round((Math.min(...xs) + Math.max(...xs)) / 2),
      -round((Math.min(...ys) + Math.max(...ys)) / 2),
    );
  }

  function keydown(event) {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (selected < 0) return;
    event.preventDefault();
    removePoint(selected);
  }
</script>

{#if points}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions (A drawing surface takes the Delete key for the selected point; it cannot be a button.) -->
  <div
    class="surface"
    bind:clientWidth={width}
    bind:clientHeight={height}
    role="application"
    aria-label="Shape drawing surface"
    tabindex="0"
    onkeydown={keydown}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions (The pointer targets are the handles; the background only clears the selection.) -->
    <svg
      bind:this={surface}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      onpointerdown={() => (selected = -1)}
    >
      {#each grid.xs as gx}
        <line class="grid" x1={gx} y1={view.y} x2={gx} y2={view.y + view.h} />
      {/each}
      {#each grid.ys as gy}
        <line class="grid" x1={view.x} y1={gy} x2={view.x + view.w} y2={gy} />
      {/each}
      <line class="axis" x1={view.x} y1="0" x2={view.x + view.w} y2="0" />
      <line class="axis" x1="0" y1={view.y} x2="0" y2={view.y + view.h} />
      <circle class="origin" r={3 / scale} />
      <text
        class="axis-label"
        x={view.x + view.w - 6 / scale}
        y={-5 / scale}
        font-size={10 / scale}
        text-anchor="end">+x forward →</text
      >
      <text
        class="axis-label"
        x={6 / scale}
        y={view.y + view.h - 6 / scale}
        font-size={10 / scale}>+y outward ↓</text
      >
      <path class="outline" d={path} />
      {#each edges as edge, i}
        <!-- svelte-ignore a11y_no_static_element_interactions (Pointer-only handle; the keyboard path goes through the surface.) -->
        <circle
          class="ghost"
          cx={edge.x}
          cy={edge.y}
          r={3.5 / scale}
          onpointerdown={(event) => startInsert(event, i)}
          onpointermove={drag}
          onpointerup={endDrag}
          onpointercancel={endDrag}
        />
      {/each}
      {#each points as point, i}
        <!-- svelte-ignore a11y_no_static_element_interactions (Pointer-only handle; the keyboard path goes through the surface.) -->
        <circle
          class="handle"
          class:held={selected === i}
          cx={point.x}
          cy={point.y}
          r={4.5 / scale}
          onpointerdown={(event) => startDrag(event, i)}
          onpointermove={drag}
          onpointerup={endDrag}
          onpointercancel={endDrag}
        />
      {/each}
    </svg>
  </div>
  <div class="tools">
    <Tooltip label="Turn the shape counterclockwise around the origin.">
      <button onclick={() => rotate(-90)}>⟲ 90°</button>
    </Tooltip>
    <Tooltip label="Turn the shape clockwise around the origin.">
      <button onclick={() => rotate(90)}>⟳ 90°</button>
    </Tooltip>
    <Tooltip label="Turn the shape counterclockwise around the origin.">
      <button onclick={() => rotate(-15)}>⟲ 15°</button>
    </Tooltip>
    <Tooltip label="Turn the shape clockwise around the origin.">
      <button onclick={() => rotate(15)}>⟳ 15°</button>
    </Tooltip>
    <span class="gap"></span>
    <Tooltip label="Move the shape back, by one grid step.">
      <button aria-label="Move back" onclick={() => move(-grid.step, 0)}
        >←</button
      >
    </Tooltip>
    <Tooltip label="Move the shape forward, by one grid step.">
      <button aria-label="Move forward" onclick={() => move(grid.step, 0)}
        >→</button
      >
    </Tooltip>
    <Tooltip label="Move the shape inward, by one grid step.">
      <button aria-label="Move inward" onclick={() => move(0, -grid.step)}
        >↑</button
      >
    </Tooltip>
    <Tooltip label="Move the shape outward, by one grid step.">
      <button aria-label="Move outward" onclick={() => move(0, grid.step)}
        >↓</button
      >
    </Tooltip>
    <Tooltip label="Move the middle of the shape onto the origin.">
      <button onclick={center}>Center</button>
    </Tooltip>
  </div>
  <p class="hint">
    Drag points to move · press a hollow dot to add · double-click a point to
    remove · the origin is where a placement attaches the shape
  </p>
{:else}
  <p class="hint">This path is not a simple polygon, so it edits as text.</p>
  <textarea
    rows="4"
    aria-label="Shape path"
    value={path}
    onchange={(event) =>
      ($descriptor.definitions.shapes[id].path = event.target.value)}
  ></textarea>
{/if}

<style>
  .surface {
    height: 280px;
    background: var(--screen);
    outline: 1px solid var(--chassis-line);
    touch-action: none;
  }

  .surface:focus-visible {
    outline: 2px solid var(--select);
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  line.grid {
    stroke: var(--screen-grid-major);
    vector-effect: non-scaling-stroke;
  }

  line.axis {
    stroke: var(--screen-muted);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .origin {
    fill: var(--screen-muted);
  }

  .axis-label {
    fill: var(--screen-muted);
    font-family: var(--font-mono);
    pointer-events: none;
    user-select: none;
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .tools .gap {
    width: 8px;
  }

  .outline {
    fill: var(--screen-select);
    fill-opacity: 0.12;
    stroke: var(--screen-select);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .ghost {
    fill: var(--screen);
    stroke: var(--screen-muted);
    vector-effect: non-scaling-stroke;
    cursor: copy;
  }

  .ghost:hover {
    stroke: var(--screen-text);
  }

  .handle {
    fill: var(--screen);
    stroke: var(--screen-select);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    cursor: grab;
  }

  .handle:active {
    cursor: grabbing;
  }

  .handle.held {
    fill: var(--screen-select);
  }

  .hint {
    margin: 6px 0 0;
    color: var(--faint);
    font-size: 10px;
  }

  textarea {
    width: 100%;
    padding: 8px;
    background: var(--screen);
    outline-color: var(--bevel-face-screen);
    color: var(--screen-text);
    font: 11px/1.5 var(--font-mono);
    resize: vertical;
  }
</style>
