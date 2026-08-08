<script context="module">
  /* Everything the runtime is mounted with. The stage seeds its options from
     these and every row resets to the same value. */
  export const DEFAULT_OPTIONS = {
    antialias: true,
    pixelUpscale: false,
    roundVertices: true,
    resolutionScale: 0.5,
    simulationFps: 60,
    drawFps: 30,
    wanderDelay: 4,
    edgeMargin: 52,
    filterPreset: "None",
    kneePerspective: 0.002,
    maxKneeOffset: 256,
    kneeProjectionCenter: "canvas",
  };
</script>

<script>
  import { onDestroy, onMount } from "svelte";
  import ControlRow from "./ControlRow.svelte";
  import Tooltip from "./Tooltip.svelte";

  /* Every edit here calls onremount. */
  export let options;
  export let showGrid;
  export let showTarget;
  export let background;
  export let mode;
  export let playing;
  export let onremount;
  export let ondebug;
  export let onplay;
  export let onmode;
  export let onclear;
  export let oncenter;

  const toolTabs = ["Target", "Stage", "Sim", "Render"];
  const filterPresets = [
    "None",
    "Night vision",
    "Thermal",
    "Mono",
    "Sepia",
    "Negative",
  ];
  const projectionCenters = ["canvas", "viewport"];

  let toolTab = "Target";
  let toolsOpen = true;

  const toggle = (key) => {
    options[key] = !options[key];
    onremount();
  };

  /* A track reports every pixel of a drag and each mount reads its options
     once, so the rebuild waits for the drag to settle. */
  let mounted = false;
  let rebuildTimer = 0;
  $: scheduleRebuild(
    options.wanderDelay,
    options.edgeMargin,
    options.simulationFps,
    options.resolutionScale,
    options.drawFps,
    options.kneePerspective,
    options.maxKneeOffset,
  );

  function scheduleRebuild() {
    if (!mounted) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(onremount, 250);
  }

  onMount(() => (mounted = true));
  onDestroy(() => clearTimeout(rebuildTimer));
</script>

<div class="stage-tools" class:collapsed={!toolsOpen}>
  <button
    class="tools-toggle"
    title={toolsOpen ? "Collapse stage tools" : "Expand stage tools"}
    aria-expanded={toolsOpen}
    onclick={() => (toolsOpen = !toolsOpen)}>{toolsOpen ? "−" : "+"}</button
  >

  {#if toolsOpen}
    <div role="tablist" aria-label="Stage tool tabs">
      {#each toolTabs as tab}
        <button
          role="tab"
          aria-selected={toolTab === tab}
          onclick={() => (toolTab = tab)}
        >
          {tab}
        </button>
      {/each}
    </div>

    <div class="tool-body" role="tabpanel" aria-label={toolTab}>
      {#if toolTab === "Target"}
        <div class="tool-row">
          <Tooltip label="Clear the current target">
            <button onclick={onclear}>Clear</button>
          </Tooltip>
          <Tooltip label="Send the specimen to center">
            <button onclick={oncenter}>Center</button>
          </Tooltip>
          <Tooltip label="Target follows the pointer">
            <button
              aria-pressed={mode === "follow"}
              onclick={() => onmode("follow")}>Follow</button
            >
          </Tooltip>
          <Tooltip label="Pick random targets automatically">
            <button
              aria-pressed={mode === "wander"}
              onclick={() => onmode("wander")}>Wander</button
            >
          </Tooltip>
        </div>
        {#if mode === "wander"}
          <div class="controls">
            <div class="rows">
              <ControlRow
                label="Delay"
                tip="Longest wait before the next wander target. Each wait is a random part of it."
                unit="s"
                digits={1}
                bind:value={options.wanderDelay}
                reset={DEFAULT_OPTIONS.wanderDelay}
                field={[0, 30, 0.5]}
                slider={[0, 15, 0.5]}
              />
              <ControlRow
                label="Edge margin"
                tip="Keeps wander targets this far inside the canvas edge."
                unit="px"
                digits={0}
                bind:value={options.edgeMargin}
                reset={DEFAULT_OPTIONS.edgeMargin}
                field={[0, 200, 4]}
                slider={[0, 200, 4]}
              />
            </div>
          </div>
        {/if}
      {:else if toolTab === "Stage"}
        <div class="tool-row">
          <Tooltip label="Show the alignment grid">
            <button
              aria-pressed={showGrid}
              onclick={() => (showGrid = !showGrid)}>Grid</button
            >
          </Tooltip>
          <Tooltip label="Show the target marker">
            <button
              aria-pressed={showTarget}
              onclick={() => {
                showTarget = !showTarget;
                ondebug();
              }}>Target</button
            >
          </Tooltip>
        </div>
        <div class="controls">
          <div class="rows">
            <label>
              <Tooltip label="Colour of the stage behind the specimen."
                ><span>Background</span></Tooltip
              >
              <input type="color" bind:value={background} />
            </label>
          </div>
        </div>
      {:else if toolTab === "Sim"}
        <div class="tool-row">
          <Tooltip label={playing ? "Pause simulation" : "Resume simulation"}>
            <button aria-pressed={playing} onclick={onplay}
              >{playing ? "Pause" : "Play"}</button
            >
          </Tooltip>
        </div>
        <div class="controls">
          <div class="rows">
            <ControlRow
              label="Physics FPS"
              tip="Simulation steps each second. Higher costs more and settles the body harder."
              digits={0}
              bind:value={options.simulationFps}
              reset={DEFAULT_OPTIONS.simulationFps}
              field={[1, 240, 1]}
              slider={[1, 120, 1]}
            />
          </div>
        </div>
      {:else}
        <div class="tool-row">
          <Tooltip label="Antialiasing">
            <button
              aria-pressed={options.antialias}
              onclick={() => toggle("antialias")}>AA</button
            >
          </Tooltip>
          <Tooltip label="Upscale with hard pixels instead of interpolation">
            <button
              aria-pressed={options.pixelUpscale}
              onclick={() => toggle("pixelUpscale")}>Upscale</button
            >
          </Tooltip>
          <Tooltip label="Snap vertices to the output pixel grid">
            <button
              aria-pressed={options.roundVertices}
              onclick={() => toggle("roundVertices")}>Rounding</button
            >
          </Tooltip>
        </div>
        <div class="controls">
          <div class="rows">
            <ControlRow
              label="Res scale"
              tip="Renderer pixels for each canvas pixel. Lower draws faster and coarser."
              unit="x"
              digits={3}
              bind:value={options.resolutionScale}
              reset={DEFAULT_OPTIONS.resolutionScale}
              field={[0.125, 1, 0.125]}
              slider={[0.125, 1, 0.125]}
            />
            <ControlRow
              label="Draw FPS"
              tip="Frames drawn each second. The simulation keeps its own rate."
              digits={0}
              bind:value={options.drawFps}
              reset={DEFAULT_OPTIONS.drawFps}
              field={[1, 240, 1]}
              slider={[1, 120, 1]}
            />
            <label>
              <Tooltip label="Colour treatment applied over the whole canvas."
                ><span>Filter</span></Tooltip
              >
              <select bind:value={options.filterPreset} onchange={onremount}>
                {#each filterPresets as preset}
                  <option>{preset}</option>
                {/each}
              </select>
            </label>
            <ControlRow
              label="Perspective"
              tip="Pushes each drawn knee away from the vanishing point. The shift grows with distance and knee height."
              digits={3}
              bind:value={options.kneePerspective}
              reset={DEFAULT_OPTIONS.kneePerspective}
              field={[0, 0.05, 0.001]}
              slider={[0, 0.02, 0.001]}
            />
            <ControlRow
              label="Knee cap"
              tip="Largest shift the perspective may add to one knee."
              unit="px"
              digits={0}
              bind:value={options.maxKneeOffset}
              reset={DEFAULT_OPTIONS.maxKneeOffset}
              field={[0, 1024, 1]}
              slider={[0, 512, 8]}
            />
            <label>
              <Tooltip
                label="Point the knees push away from: the canvas center or the viewport center."
                ><span>Vanishing point</span></Tooltip
              >
              <select
                bind:value={options.kneeProjectionCenter}
                onchange={onremount}
              >
                {#each projectionCenters as center}
                  <option value={center}>{center}</option>
                {/each}
              </select>
            </label>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stage-tools {
    position: absolute;
    z-index: 4;
    top: 14px;
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

  .stage-tools [role="tablist"] {
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

  /* The kit indents its rows under a section latch; this panel has none. */
  .tool-body .rows {
    padding: 0 var(--bevel-width) var(--bevel-width);
  }

  /* The kit pads a field for typed text; a swatch fills its box instead. */
  .tool-body input[type="color"] {
    padding: 2px;
  }
</style>
