<script>
  import { onDestroy, onMount } from "svelte";
  import { rustWalker } from "./defaultBeefwife.js";

  export let selected;
  export let onselect;

  const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  let canvas;
  let runtime;
  let playing = true;
  let guides = false;
  let autoTarget = false;
  let target = { x: 62, y: 46 };
  let autoTargetTimer;
  let disposed = false;

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

  function chooseRandomTarget() {
    target = {
      x: 12 + Math.random() * 76,
      y: 16 + Math.random() * 66,
    };
    sendTarget();
  }

  function scheduleAutoTarget() {
    clearTimeout(autoTargetTimer);
    if (!autoTarget) return;
    autoTargetTimer = setTimeout(
      () => {
        chooseRandomTarget();
        scheduleAutoTarget();
      },
      1800 + Math.random() * 1700,
    );
  }

  function toggleAutoTarget() {
    autoTarget = !autoTarget;
    if (autoTarget) chooseRandomTarget();
    scheduleAutoTarget();
  }

  function placeTarget(event) {
    if (event.target.closest("button")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    target = {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
    sendTarget();
    scheduleAutoTarget();
  }

  function moveTargetFromKeyboard(event) {
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
    sendTarget();
    event.preventDefault();
    scheduleAutoTarget();
  }

  function centerTarget() {
    target = { x: 50, y: 50 };
    sendTarget();
  }

  function toggleGuides() {
    guides = !guides;
    runtime?.setDebug({ targets: guides, routes: guides });
  }

  function togglePlaying() {
    playing = !playing;
    if (playing) runtime?.start();
    else runtime?.stop();
  }

  async function mountCanvas() {
    try {
      const mounted = await window.BeefwifeCanvas.mount(canvas, {
        descriptors: [rustWalker],
        count: 1,
        resolutionScale: 0.5,
        imageRendering: "auto",
        roundVertices: true,
        antialias: true,
        simulationFps: 60,
        drawFps: 30,
        targetMode: "manual",
        pointerInput: "none",
        edgeMargin: 52,
        kneeProjectionCenter: "canvas",
      });
      if (disposed) {
        mounted.destroy();
        return;
      }
      runtime = mounted;
      requestAnimationFrame(sendTarget);
    } catch (error) {
      console.error("Beefwife canvas failed to mount", error);
    }
  }

  onMount(() => {
    mountCanvas();
  });

  onDestroy(() => {
    disposed = true;
    clearTimeout(autoTargetTimer);
    runtime?.destroy();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions (A two-dimensional target surface has arrow-key controls; it cannot contain the toolbar if modeled as a button.) -->
<section
  class="stage"
  class:show-guides={guides}
  role="application"
  aria-label="Beefwife preview and motion target"
  tabindex="0"
  onclick={placeTarget}
  onkeydown={moveTargetFromKeyboard}
>
  <canvas bind:this={canvas} aria-label="Live Rust walker simulation"></canvas>

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

  <div class="stage-tools" aria-label="Canvas controls">
    <button title="Send the specimen to center" onclick={centerTarget}
      >Center</button
    >
    <button
      class:active={guides}
      aria-pressed={guides}
      title="Toggle route diagnostics"
      onclick={toggleGuides}>Guides</button
    >
    <button
      class:active={playing}
      aria-pressed={playing}
      title={playing ? "Pause simulation" : "Resume simulation"}
      onclick={togglePlaying}>{playing ? "Pause" : "Play"}</button
    >
    <button
      class:active={autoTarget}
      aria-pressed={autoTarget}
      title="Move the target automatically"
      onclick={toggleAutoTarget}>Auto</button
    >
  </div>

  <div
    class="target"
    class:auto={autoTarget}
    style:left={`${target.x}%`}
    style:top={`${target.y}%`}
    aria-hidden="true"
  ></div>

  <button
    class="selection-badge"
    title="Inspect the selected anchor"
    onclick={() => onselect(selected)}
  >
    <span>Selected anchor</span>
    <strong>{selected.replace("-", " ")}</strong>
  </button>

  <dl class="stage-readout">
    <div class="readout select">
      <dt>Anchor</dt>
      <dd>{selected.replace("-", " ")}</dd>
    </div>
    <div class="readout measure">
      <dt>Target X</dt>
      <dd>{target.x.toFixed(1)}<em>%</em></dd>
    </div>
    <div class="readout measure">
      <dt>Target Y</dt>
      <dd>{target.y.toFixed(1)}<em>%</em></dd>
    </div>
    <div class="readout">
      <dt>Tracking</dt>
      <dd>{autoTarget ? "Auto" : "Manual"}</dd>
    </div>
    <div class="readout scale-readout">
      <dt>Render</dt>
      <dd>0.5<em>x</em> · AA</dd>
    </div>
  </dl>
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

  .stage.show-guides {
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

  .stage.show-guides::after {
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

  .show-guides .graticule {
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
  .stage-readout,
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

  .stage-heading small {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    color: var(--danger);
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .stage-heading small::before {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    content: "";
  }

  .stage-heading small.online {
    color: var(--screen-select);
  }

  .stage-tools {
    top: 22px;
    right: 14px;
    display: flex;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--chassis-line-high);
    border-radius: var(--radius-control);
    background: color-mix(in srgb, var(--chassis) 93%, transparent);
  }

  .stage-tools button {
    padding: 4px 8px;
    font-size: 10px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .stage-tools button[aria-pressed="true"] {
    background: var(--select-dim);
    color: var(--select-text);
  }

  .selection-badge {
    bottom: 62px;
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

  .stage-readout {
    right: 14px;
    bottom: 14px;
    left: 32px;
    display: flex;
    margin: 0;
    background: color-mix(in srgb, var(--chassis) 93%, transparent);
    outline: var(--bevel-width) inset var(--bevel-face);
  }

  .readout {
    min-width: 88px;
    padding: 6px 10px 7px;
    border-left: 1px solid var(--chassis-line);
  }

  .readout:first-child {
    border-left: 0;
  }

  .readout:last-child {
    margin-left: auto;
    text-align: right;
  }

  .readout dt {
    color: var(--faint);
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .readout dd {
    margin: 3px 0 0;
    color: var(--text);
    font-size: 12px;
    text-transform: capitalize;
  }

  .readout em {
    margin-left: 2px;
    color: var(--faint);
    font-size: 9px;
    font-style: normal;
  }

  .readout.select,
  .readout.measure {
    border-top: 2px solid transparent;
    padding-top: 4px;
  }

  .readout.select {
    border-top-color: var(--select);
  }

  .readout.measure {
    border-top-color: var(--measure);
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

  .target.auto {
    border-style: dashed;
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
    .selection-badge,
    .scale-readout {
      display: none;
    }
  }
</style>
