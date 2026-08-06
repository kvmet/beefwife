<script>
  import { onDestroy, onMount, tick } from "svelte";
  import { rustWalker } from "./defaultBeefwife.js";

  export let selected;
  export let onselect;

  const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const toolTabs = ["Target", "Stage", "Sim", "Render"];
  const filterPresets = [
    "None",
    "Night vision",
    "Thermal",
    "Mono",
    "Sepia",
    "Negative",
  ];

  let canvas;
  let runtime;
  let disposed = false;
  let mountToken = 0;

  let toolTab = "Target";
  let toolsOpen = true;

  let targetMode = "manual";
  let target = { x: 62, y: 46 };
  let hasTarget = true;
  let wanderDelay = 4;
  let edgeMargin = 52;

  let showGrid = false;
  let showTarget = true;
  let background = "#101318";

  let playing = true;
  let simulationFps = 60;

  let antialias = true;
  let pixelUpscale = false;
  let resolutionScale = 0.5;
  let roundVertices = true;
  let drawFps = 30;
  let filterPreset = "None";

  $: markerVisible = showTarget && hasTarget && targetMode === "manual";

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
    if (filterPreset === "None" || typeof window.PIXI === "undefined")
      return undefined;
    const filter = new window.PIXI.ColorMatrixFilter();
    if (filterPreset === "Night vision") filter.night(0.3, false);
    else if (filterPreset === "Thermal") filter.predator(0.5, false);
    else if (filterPreset === "Mono") filter.desaturate();
    else if (filterPreset === "Sepia") filter.sepia(false);
    else if (filterPreset === "Negative") filter.negative(false);
    return [filter];
  }

  async function mountCanvas(token = mountToken) {
    try {
      const mounted = await window.BeefwifeCanvas.mount(canvas, {
        descriptors: [rustWalker],
        count: 1,
        resolutionScale: Math.min(1, Math.max(0.125, +resolutionScale || 0.5)),
        imageRendering: pixelUpscale ? "pixelated" : "auto",
        roundVertices,
        antialias,
        simulationFps: Math.max(1, +simulationFps || 60),
        drawFps: Math.max(1, +drawFps || 30),
        wanderDelay: Math.max(0, +wanderDelay || 0),
        targetMode: targetMode === "wander" ? "wander" : "manual",
        pointerInput: targetMode === "follow" ? "move" : "none",
        edgeMargin: Math.max(0, +edgeMargin || 0),
        kneeProjectionCenter: "canvas",
        filters: presetFilter(),
      });
      if (disposed || token !== mountToken) {
        mounted.destroy();
        return;
      }
      runtime = mounted;
      if (!playing) runtime.stop();
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
  aria-label="Beefwife preview and motion target"
  tabindex="0"
  onclick={placeTarget}
  onkeydown={moveTargetFromKeyboard}
>
  {#key antialias}
    <canvas bind:this={canvas} aria-label="Live Rust walker simulation"
    ></canvas>
  {/key}

  <div class="graticule graticule-x" aria-hidden="true">
    {#each ticks as tick}
      <i class:major={tick % 20 === 0} style:left={`${tick}%`}
        >{tick % 20 === 0 ? tick : ""}</i
      >
    {/each}
  </div>
  <div class="graticule graticule-y" aria-hidden="true">
    {#each ticks as tick}
      <i class:major={tick % 20 === 0} style:top={`${tick}%`}
        >{tick % 20 === 0 ? tick : ""}</i
      >
    {/each}
  </div>

  <div class="stage-heading">
    <span>Specimen monitor / live canvas</span>
    <strong>Rust walker</strong>
  </div>

  <div class="stage-tools" class:collapsed={!toolsOpen}>
    <button
      class="tools-toggle"
      title={toolsOpen ? "Collapse stage tools" : "Expand stage tools"}
      aria-expanded={toolsOpen}
      onclick={() => (toolsOpen = !toolsOpen)}>{toolsOpen ? "−" : "+"}</button
    >

    {#if toolsOpen}
      <nav role="tablist" aria-label="Stage tool tabs">
        {#each toolTabs as tab}
          <button
            role="tab"
            aria-selected={toolTab === tab}
            onclick={() => (toolTab = tab)}
          >
            {tab}
          </button>
        {/each}
      </nav>

      <div class="tool-body" role="tabpanel" aria-label={toolTab}>
      {#if toolTab === "Target"}
        <div class="tool-row">
          <button title="Clear the current target" onclick={clearTarget}
            >Clear</button
          >
          <button title="Send the specimen to center" onclick={centerTarget}
            >Center</button
          >
          <button
            aria-pressed={targetMode === "follow"}
            title="Target follows the pointer"
            onclick={() => selectMode("follow")}>Follow</button
          >
          <button
            aria-pressed={targetMode === "wander"}
            title="Pick random targets automatically"
            onclick={() => selectMode("wander")}>Wander</button
          >
        </div>
        {#if targetMode === "wander"}
          <div class="tool-fields">
            <label>
              <span>Delay (s)</span>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                bind:value={wanderDelay}
                onchange={remount}
              />
            </label>
            <label>
              <span>Edge margin (px)</span>
              <input
                type="number"
                min="0"
                max="200"
                step="4"
                bind:value={edgeMargin}
                onchange={remount}
              />
            </label>
          </div>
        {/if}
      {:else if toolTab === "Stage"}
        <div class="tool-row">
          <button
            aria-pressed={showGrid}
            title="Show the alignment grid"
            onclick={() => (showGrid = !showGrid)}>Grid</button
          >
          <button
            aria-pressed={showTarget}
            title="Show the target marker"
            onclick={() => {
              showTarget = !showTarget;
              applyDebug();
            }}>Target</button
          >
        </div>
        <div class="tool-fields">
          <label>
            <span>Background</span>
            <input type="color" bind:value={background} />
          </label>
        </div>
      {:else if toolTab === "Sim"}
        <div class="tool-row">
          <button
            aria-pressed={playing}
            title={playing ? "Pause simulation" : "Resume simulation"}
            onclick={togglePlaying}>{playing ? "Pause" : "Play"}</button
          >
        </div>
        <div class="tool-fields">
          <label>
            <span>Physics FPS</span>
            <input
              type="number"
              min="1"
              max="240"
              step="1"
              bind:value={simulationFps}
              onchange={remount}
            />
          </label>
        </div>
      {:else}
        <div class="tool-row">
          <button
            aria-pressed={antialias}
            title="Antialiasing"
            onclick={() => {
              antialias = !antialias;
              remount();
            }}>AA</button
          >
          <button
            aria-pressed={pixelUpscale}
            title="Upscale with hard pixels instead of interpolation"
            onclick={() => {
              pixelUpscale = !pixelUpscale;
              remount();
            }}>Upscale</button
          >
          <button
            aria-pressed={roundVertices}
            title="Snap vertices to the output pixel grid"
            onclick={() => {
              roundVertices = !roundVertices;
              remount();
            }}>Rounding</button
          >
        </div>
        <div class="tool-fields">
          <label>
            <span>Res scale (x)</span>
            <input
              type="number"
              min="0.125"
              max="1"
              step="0.125"
              bind:value={resolutionScale}
              onchange={remount}
            />
          </label>
          <label>
            <span>Draw FPS</span>
            <input
              type="number"
              min="1"
              max="240"
              step="1"
              bind:value={drawFps}
              onchange={remount}
            />
          </label>
          <label class="wide">
            <span>Filter</span>
            <select bind:value={filterPreset} onchange={remount}>
              {#each filterPresets as preset}
                <option>{preset}</option>
              {/each}
            </select>
          </label>
        </div>
      {/if}
      </div>
    {/if}
  </div>

  {#if markerVisible}
    <div
      class="target"
      style:left={`${target.x}%`}
      style:top={`${target.y}%`}
      aria-hidden="true"
    ></div>
  {/if}

  <button
    class="selection-badge"
    title="Inspect the selected anchor"
    onclick={() => onselect(selected)}
  >
    <span>Selected anchor</span>
    <strong>{selected.replace("-", " ")}</strong>
  </button>
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

  .graticule {
    position: absolute;
    z-index: 3;
    color: var(--screen-faint);
    font-size: 8px;
    letter-spacing: 0.06em;
    pointer-events: none;
    visibility: hidden;
  }

  .show-grid .graticule {
    visibility: visible;
  }

  .graticule i {
    position: absolute;
    font-style: normal;
  }

  .graticule-x {
    top: 0;
    right: 0;
    left: 0;
    height: 16px;
    border-bottom: 1px solid var(--screen-grid);
  }

  .graticule-x i {
    top: 0;
    height: 4px;
    padding-left: 3px;
    border-left: 1px solid var(--screen-grid-major);
    line-height: 14px;
  }

  .graticule-x i.major {
    height: 7px;
  }

  .graticule-y {
    top: 16px;
    bottom: 0;
    left: 0;
    width: 22px;
    border-right: 1px solid var(--screen-grid);
  }

  .graticule-y i {
    left: 0;
    width: 22px;
    padding: 3px 0 0 11px;
    background: linear-gradient(
        90deg,
        var(--screen-grid-major) 0 4px,
        transparent 4px
      )
      no-repeat;
    background-size: 100% 1px;
  }

  .graticule-y i.major {
    background-image: linear-gradient(
      90deg,
      var(--screen-grid-major) 0 8px,
      transparent 8px
    );
  }

  .stage-heading,
  .stage-tools,
  .selection-badge {
    position: absolute;
    z-index: 4;
  }

  .stage-heading {
    top: 26px;
    left: 32px;
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

  .stage-tools {
    top: 22px;
    right: 14px;
    width: 296px;
    border: 1px solid var(--chassis-line-high);
    border-radius: var(--radius-control);
    background: var(--chassis);
  }

  .stage-tools.collapsed {
    width: auto;
    padding: 4px;
  }

  /* Same 4px inset the collapsed box's padding gives it, so the button stays
     put when the panel collapses under it. */
  .tools-toggle {
    position: absolute;
    z-index: 3;
    top: 4px;
    right: 4px;
    display: grid;
    width: 18px;
    height: 18px;
    place-items: center;
    padding: 0;
    font-size: 12px;
  }

  /* An open panel is not a pressed state; keep the toggle raised either way. */
  .tools-toggle[aria-expanded="true"] {
    border-width: 0 1px 1px 0;
    outline-style: outset;
    background-color: var(--chassis);
    color: var(--muted);
  }

  .collapsed .tools-toggle {
    position: static;
  }

  .stage-tools nav {
    position: relative;
    z-index: 2;
    display: flex;
    gap: 2px;
    padding: 7px 36px 0 8px;
  }

  .stage-tools [role="tab"] {
    padding: 4px 8px;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tool-body {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 8px;
    padding: 8px;
    border-top: 2px solid var(--edge-light);
  }

  .tool-row {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--bevel-width) * 2 + 1px);
    padding: var(--bevel-width);
  }

  .tool-row button {
    padding: 4px 8px;
    font-size: 10px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .tool-row button[aria-pressed="true"] {
    background: var(--select-dim);
    color: var(--select-text);
  }

  .tool-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 0 var(--bevel-width) var(--bevel-width);
  }

  .tool-fields label {
    min-width: 0;
  }

  .tool-fields label.wide {
    grid-column: 1 / -1;
  }

  .tool-fields label > span {
    display: block;
    margin-bottom: 4px;
    color: var(--muted);
    font: var(--label-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .tool-fields input,
  .tool-fields select {
    width: 100%;
    height: 26px;
    padding: 0 6px;
    font-size: 11px;
    outline-color: var(--bevel-face-screen);
  }

  .tool-fields input[type="color"] {
    padding: 2px;
  }

  .selection-badge {
    bottom: 20px;
    left: 32px;
    min-width: 126px;
    padding: 6px 9px;
    background: #1b212a;
    outline-color: var(--bevel-face-screen);
    color: var(--screen-text);
    text-align: left;
  }

  .selection-badge:hover {
    background: #262e3a;
    color: var(--screen-text);
  }

  .selection-badge span,
  .selection-badge strong {
    display: block;
  }

  .selection-badge span {
    color: var(--screen-faint);
    font-size: 7px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .selection-badge strong {
    margin-top: 3px;
    color: var(--screen-select);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .target {
    position: absolute;
    z-index: 3;
    width: 23px;
    height: 23px;
    border: 1px solid var(--screen-measure-line);
    border-radius: 50%;
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition:
      left 700ms cubic-bezier(0.22, 1, 0.36, 1),
      top 700ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .target::before,
  .target::after {
    position: absolute;
    content: "";
  }

  .target::before {
    top: 10px;
    left: -8px;
    width: 37px;
    height: 1px;
    background: linear-gradient(
      90deg,
      var(--screen-measure-line) 0 9px,
      transparent 9px 28px,
      var(--screen-measure-line) 28px 37px
    );
  }

  .target::after {
    top: -8px;
    left: 10px;
    width: 1px;
    height: 37px;
    background: linear-gradient(
      var(--screen-measure-line) 0 9px,
      transparent 9px 28px,
      var(--screen-measure-line) 28px 37px
    );
  }

  @media (max-width: 980px) {
    .selection-badge {
      display: none;
    }
  }
</style>
