<script>
  import { onDestroy, onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import Graticule from "./Graticule.svelte";
  import StageTools, { DEFAULT_OPTIONS } from "./StageTools.svelte";
  import TargetMarker from "./TargetMarker.svelte";
  import { applyError, descriptor } from "./descriptor.js";

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

  let playing = true;

  /* Read once when the runtime mounts, so any edit here has to remount. */
  let options = { ...DEFAULT_OPTIONS };

  $: markerVisible = showTarget && hasTarget && targetMode === "manual";

  /* The runtime validates on apply; a rejected document leaves the actor on
     its last good state, so the error is reported instead of thrown. */
  function applyDescriptor(value) {
    if (!runtime) return;
    try {
      for (const actor of runtime.getActors()) actor.setDescriptor(value);
      applyError.set(null);
    } catch (error) {
      applyError.set(error.message);
    }
  }

  $: applyDescriptor($descriptor);

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

  /* The runtime draws its own target crosshair; ours only marks manual
     placements, so the debug layer covers the modes ours cannot. */
  function applyDebug() {
    runtime?.setDebug({ targets: showTarget && targetMode !== "manual" });
  }

  function selectMode(mode) {
    targetMode = targetMode === mode ? "manual" : mode;
    if (!runtime) return;
    runtime.setTargetMode(targetMode === "wander" ? "wander" : "manual");
    runtime.setPointerInput(targetMode === "follow" ? "move" : "none");
    if (targetMode === "manual" && hasTarget) sendTarget();
    applyDebug();
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
    try {
      const mounted = await window.BeefwifeCanvas.mount(canvas, {
        descriptors: [get(descriptor)],
        count: 1,
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
      if (!playing) runtime.stop();
      // Edits made while the mount was in flight were skipped; catch up.
      applyDescriptor(get(descriptor));
      applyDebug();
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
  onclick={placeTarget}
  onkeydown={moveTargetFromKeyboard}
>
  {#key options.antialias}
    <canvas bind:this={canvas} aria-label="Live Beefwife simulation"></canvas>
  {/key}

  <Graticule visible={showGrid} />

  <div class="stage-heading">
    <span>Live specimen monitor</span>
    <strong>{$descriptor.name}</strong>
  </div>

  <StageTools
    bind:options
    bind:showGrid
    bind:showTarget
    bind:background
    mode={targetMode}
    {playing}
    onremount={remount}
    ondebug={applyDebug}
    onplay={togglePlaying}
    onmode={selectMode}
    onclear={clearTarget}
    oncenter={centerTarget}
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
</style>
