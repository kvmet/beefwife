<script>
  import { onDestroy, onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import DebugLayer from "./DebugLayer.svelte";
  import Graticule from "./Graticule.svelte";
  import StageTools, { DEFAULT_OPTIONS } from "./StageTools.svelte";
  import TargetMarker from "./TargetMarker.svelte";
  import TerrainBoxes from "./TerrainBoxes.svelte";
  import { applyError, descriptor } from "./descriptor.js";

  /* The selector the runtime measures its terrain with. Its own default,
     `.beefwife-avoid`, belongs to a hosting page; the lab draws its own. */
  const TERRAIN_SELECTOR = "[data-lab-terrain]";
  // Percent of the stage, below which a drag reads as a stray click.
  const SMALLEST_BOX = 1.5;

  let canvas;
  let runtime;
  let disposed = false;
  let mountToken = 0;

  let targetMode = "wander";
  let target = { x: 62, y: 46 };
  let hasTarget = true;

  let showGrid = true;
  let showTarget = true;
  let background = "#101318";

  let debug = { routes: false, targets: false, bounds: false };
  /* The padding the live runtime measured with, not the one the panel is
     showing: an edit only reaches the terrain on the remount it schedules. */
  let mountedPadding = DEFAULT_OPTIONS.obstaclePadding;
  let showStats = false;
  let stats = null;
  let statsTimer = 0;

  let terrainBoxes = [];
  let pendingBox = null;
  let drawOrigin = null;
  let nextBoxId = 1;
  let drawTerrain = false;

  let playing = true;

  /* Read once when the runtime mounts, so any edit here has to remount. */
  let options = { ...DEFAULT_OPTIONS };

  $: markerVisible = showTarget && hasTarget && targetMode === "manual";
  $: applyCount(options.count);
  $: pollStats(showStats);

  /* The runtime validates on apply; a rejected document leaves the actor on
     its last good state, so the error is reported instead of thrown. The
     library freezes what it is handed and compiles one model per object, so
     the panels keep editing their own copy and each apply sends a new one. */
  function applyDescriptor(value) {
    if (!runtime) return;
    try {
      const handed = structuredClone(value);
      for (const actor of runtime.getActors()) actor.setDescriptor(handed);
      applyError.set(null);
    } catch (error) {
      applyError.set(error.message);
    }
  }

  $: applyDescriptor($descriptor);

  /* A creature added after an edit is built from the cast the mount was given,
     so the edited document has to be handed to it once it exists. */
  function applyCount(count) {
    if (!runtime) return;
    runtime.setCount(Math.max(0, Math.round(count)));
    applyDescriptor(get(descriptor));
  }

  function pollStats(wanted) {
    clearInterval(statsTimer);
    statsTimer = 0;
    if (!wanted) {
      stats = null;
      return;
    }
    /* Four times a second: the runtime publishes one figure a second, so a
       faster poll would reread the same numbers. */
    statsTimer = setInterval(() => (stats = runtime?.getStats() ?? null), 250);
  }

  function targetPoint() {
    const bounds = canvas?.getBoundingClientRect();
    if (!bounds?.width || !bounds?.height) return null;
    return {
      x: (target.x / 100) * bounds.width,
      y: (target.y / 100) * bounds.height,
    };
  }

  function sendTarget() {
    const point = targetPoint();
    if (point && runtime) runtime.setTarget(point);
  }

  function selectMode(mode) {
    targetMode = targetMode === mode ? "manual" : mode;
    if (!runtime) return;
    runtime.setTargetMode(targetMode === "wander" ? "wander" : "manual");
    runtime.setPointerInput(targetMode === "follow" ? "move" : "none");
    if (targetMode === "manual" && hasTarget) sendTarget();
  }

  function stagePercent(event, bounds) {
    return {
      x: Math.min(
        Math.max(((event.clientX - bounds.left) / bounds.width) * 100, 0),
        100,
      ),
      y: Math.min(
        Math.max(((event.clientY - bounds.top) / bounds.height) * 100, 0),
        100,
      ),
    };
  }

  function startBox(event) {
    if (!drawTerrain || event.button !== 0) return;
    if (event.target.closest("button, .stage-tools")) return;
    drawOrigin = stagePercent(
      event,
      event.currentTarget.getBoundingClientRect(),
    );
    pendingBox = {
      ...drawOrigin,
      left: drawOrigin.x,
      top: drawOrigin.y,
      width: 0,
      height: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function stretchBox(event) {
    if (!drawOrigin) return;
    const corner = stagePercent(
      event,
      event.currentTarget.getBoundingClientRect(),
    );
    pendingBox = {
      left: Math.min(drawOrigin.x, corner.x),
      top: Math.min(drawOrigin.y, corner.y),
      width: Math.abs(corner.x - drawOrigin.x),
      height: Math.abs(corner.y - drawOrigin.y),
    };
  }

  async function commitBox(event) {
    if (!drawOrigin) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const box = pendingBox;
    drawOrigin = null;
    pendingBox = null;
    if (!box || box.width < SMALLEST_BOX || box.height < SMALLEST_BOX) return;
    terrainBoxes = [...terrainBoxes, { ...box, id: nextBoxId++ }];
    await measureTerrain();
  }

  async function removeBox(id) {
    terrainBoxes = terrainBoxes.filter((box) => box.id !== id);
    await measureTerrain();
  }

  async function clearTerrain() {
    terrainBoxes = [];
    await measureTerrain();
  }

  /* Terrain is measured from the page, so the boxes have to be in it before
     the runtime is asked to look again. */
  async function measureTerrain() {
    await tick();
    runtime?.refreshTerrain();
  }

  function clearTarget() {
    hasTarget = false;
    runtime?.clearTarget();
  }

  function centerTarget() {
    target = { x: 50, y: 50 };
    hasTarget = true;
    sendTarget();
  }

  function placeTarget(event) {
    if (drawTerrain) return;
    if (event.target.closest("button, .stage-tools")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    target = {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
    hasTarget = true;
    sendTarget();
  }

  function moveTargetFromKeyboard(event) {
    if (event.target.closest("input, select")) return;
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    const step = event.shiftKey ? 5 : 2;
    target = {
      x: Math.min(Math.max(target.x + direction[0] * step, 4), 96),
      y: Math.min(Math.max(target.y + direction[1] * step, 7), 93),
    };
    hasTarget = true;
    sendTarget();
    event.preventDefault();
  }

  function togglePlaying() {
    playing = !playing;
    if (playing) runtime?.start();
    else runtime?.stop();
  }

  function presetFilter() {
    const preset = options.filterPreset;
    if (preset === "None" || typeof window.PIXI === "undefined")
      return undefined;
    const filter = new window.PIXI.ColorMatrixFilter();
    if (preset === "Night vision") filter.night(0.3, false);
    else if (preset === "Thermal") filter.predator(0.5, false);
    else if (preset === "Mono") filter.desaturate();
    else if (preset === "Sepia") filter.sepia(false);
    else if (preset === "Negative") filter.negative(false);
    return [filter];
  }

  async function mountCanvas(token = mountToken) {
    const padding = Math.max(0, +options.obstaclePadding || 0);
    try {
      const mounted = await window.BeefwifeCanvas.mount(canvas, {
        descriptors: [structuredClone(get(descriptor))],
        count: Math.max(0, Math.round(options.count)),
        avoid: TERRAIN_SELECTOR,
        resolutionScale: Math.min(
          1,
          Math.max(0.125, +options.resolutionScale || 0.5),
        ),
        imageRendering: options.pixelUpscale ? "pixelated" : "auto",
        roundVertices: options.roundVertices,
        antialias: options.antialias,
        simulationFps: Math.max(1, +options.simulationFps || 60),
        drawFps: Math.max(1, +options.drawFps || 30),
        wanderDelay: Math.max(0, +options.wanderDelay || 0),
        targetMode: targetMode === "wander" ? "wander" : "manual",
        pointerInput: targetMode === "follow" ? "move" : "none",
        edgeMargin: Math.max(0, +options.edgeMargin || 0),
        obstaclePadding: padding,
        kneePerspective: Math.max(0, +options.kneePerspective || 0),
        maxKneeOffset: Math.max(0, +options.maxKneeOffset || 0),
        kneeProjectionCenter: options.kneeProjectionCenter,
        filters: presetFilter(),
      });
      if (disposed || token !== mountToken) {
        mounted.destroy();
        return;
      }
      runtime = mounted;
      mountedPadding = padding;
      if (!playing) runtime.stop();
      // Edits made while the mount was in flight were skipped; catch up.
      applyDescriptor(get(descriptor));
      if (targetMode === "manual" && hasTarget)
        requestAnimationFrame(sendTarget);
    } catch (error) {
      console.error("Beefwife canvas failed to mount", error);
    }
  }

  /* Mount options are read once, so option changes remount. The tick lets a
     keyed canvas swap land first when antialias changes; the renderer kept for
     a canvas is fixed to its antialias setting, so only a new element can
     change it. */
  async function remount() {
    const token = ++mountToken;
    runtime?.destroy();
    runtime = null;
    await tick();
    if (!disposed) await mountCanvas(token);
  }

  onMount(() => {
    mountCanvas();
  });

  onDestroy(() => {
    disposed = true;
    mountToken += 1;
    clearInterval(statsTimer);
    runtime?.destroy();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions (A two-dimensional target surface has arrow-key controls; it cannot contain the toolbar if modeled as a button.) -->
<section
  class="stage"
  class:show-grid={showGrid}
  style:background-color={background}
  role="application"
  aria-label="Beefwife preview"
  tabindex="0"
  class:drawing={drawTerrain}
  onclick={placeTarget}
  onkeydown={moveTargetFromKeyboard}
  onpointerdown={startBox}
  onpointermove={stretchBox}
  onpointerup={commitBox}
>
  {#key options.antialias}
    <canvas bind:this={canvas} aria-label="Live Beefwife simulation"></canvas>
  {/key}

  <TerrainBoxes
    boxes={terrainBoxes}
    pending={pendingBox}
    editable={drawTerrain}
    onremove={removeBox}
  />

  <DebugLayer {runtime} {...debug} padding={mountedPadding} />

  <Graticule visible={showGrid} />

  <div class="stage-heading">
    <span>Live specimen monitor</span>
    <strong>{$descriptor.name}</strong>
    {#if stats}
      <dl class="stats">
        <dt>Bodies</dt>
        <dd>{stats.actors}</dd>
        <dt>Steps/s</dt>
        <dd>{stats.steps.toFixed(1)}</dd>
        <dt>Draws/s</dt>
        <dd>{stats.draws.toFixed(1)}</dd>
        <dt>Step</dt>
        <dd>{stats.stepMs.toFixed(2)} ms</dd>
        <dt>Draw</dt>
        <dd>{stats.drawMs.toFixed(2)} ms</dd>
      </dl>
    {/if}
  </div>

  <StageTools
    bind:options
    bind:showGrid
    bind:showTarget
    bind:background
    bind:debug
    bind:showStats
    bind:drawTerrain
    mode={targetMode}
    terrainCount={terrainBoxes.length}
    {playing}
    onremount={remount}
    onplay={togglePlaying}
    onmode={selectMode}
    onclear={clearTarget}
    oncenter={centerTarget}
    onclearterrain={clearTerrain}
  />

  {#if markerVisible}
    <TargetMarker x={target.x} y={target.y} />
  {/if}
</section>

<style>
  .stage {
    --minor: 28px;
    --major: 112px;
    position: relative;
    min-width: 0;
    overflow: hidden;
    background-color: var(--screen);
    background-image: none;
    background-size:
      var(--major) var(--major),
      var(--major) var(--major),
      var(--minor) var(--minor),
      var(--minor) var(--minor);
    box-shadow:
      inset 0 0 0 1px #000,
      inset 0 0 18px #0008,
      0 0 0 1px var(--chassis-line-high);
  }

  .stage.drawing {
    cursor: crosshair;
  }

  .stage.show-grid {
    background-image:
      linear-gradient(var(--screen-grid-major) 1px, transparent 1px),
      linear-gradient(90deg, var(--screen-grid-major) 1px, transparent 1px),
      linear-gradient(var(--screen-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--screen-grid) 1px, transparent 1px);
  }

  .stage::after {
    position: absolute;
    z-index: 2;
    inset: 0;
    background-image:
      linear-gradient(
        90deg,
        transparent calc(50% - 1px),
        var(--screen-axis) calc(50% - 1px),
        var(--screen-axis) 50%,
        transparent 50%
      ),
      linear-gradient(
        transparent calc(50% - 1px),
        var(--screen-axis) calc(50% - 1px),
        var(--screen-axis) 50%,
        transparent 50%
      );
    content: "";
    opacity: 0;
    pointer-events: none;
  }

  .stage.show-grid::after {
    opacity: 1;
  }

  canvas {
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .stage-heading {
    position: absolute;
    z-index: 4;
    top: 26px;
    left: 26px;
    color: var(--screen-text);
  }

  .stage-heading span,
  .stage-heading strong {
    display: block;
  }

  .stage-heading span {
    color: var(--screen-muted);
    font: var(--label-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .stage-heading strong {
    margin-top: 5px;
    font-size: clamp(18px, 2.4vw, 34px);
    font-weight: 400;
    letter-spacing: -0.04em;
    text-transform: uppercase;
  }

  .stats {
    display: grid;
    margin: 8px 0 0;
    gap: 0 8px;
    grid-template-columns: auto auto;
    justify-content: start;
    color: var(--screen-muted);
    font: var(--label-font);
  }

  .stats dt {
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .stats dd {
    margin: 0;
    color: var(--screen-text);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>
