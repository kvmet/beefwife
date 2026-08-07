<script>
  /* Everything the runtime is mounted with; every edit here calls onremount. */
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

  let toolTab = "Target";
  let toolsOpen = true;

  const toggle = (key) => {
    options[key] = !options[key];
    onremount();
  };
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
          <button title="Clear the current target" onclick={onclear}
            >Clear</button
          >
          <button title="Send the specimen to center" onclick={oncenter}
            >Center</button
          >
          <button
            aria-pressed={mode === "follow"}
            title="Target follows the pointer"
            onclick={() => onmode("follow")}>Follow</button
          >
          <button
            aria-pressed={mode === "wander"}
            title="Pick random targets automatically"
            onclick={() => onmode("wander")}>Wander</button
          >
        </div>
        {#if mode === "wander"}
          <div class="tool-fields">
            <label>
              <span>Delay (s)</span>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                bind:value={options.wanderDelay}
                onchange={onremount}
              />
            </label>
            <label>
              <span>Edge margin (px)</span>
              <input
                type="number"
                min="0"
                max="200"
                step="4"
                bind:value={options.edgeMargin}
                onchange={onremount}
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
              ondebug();
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
            onclick={onplay}>{playing ? "Pause" : "Play"}</button
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
              bind:value={options.simulationFps}
              onchange={onremount}
            />
          </label>
        </div>
      {:else}
        <div class="tool-row">
          <button
            aria-pressed={options.antialias}
            title="Antialiasing"
            onclick={() => toggle("antialias")}>AA</button
          >
          <button
            aria-pressed={options.pixelUpscale}
            title="Upscale with hard pixels instead of interpolation"
            onclick={() => toggle("pixelUpscale")}>Upscale</button
          >
          <button
            aria-pressed={options.roundVertices}
            title="Snap vertices to the output pixel grid"
            onclick={() => toggle("roundVertices")}>Rounding</button
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
              bind:value={options.resolutionScale}
              onchange={onremount}
            />
          </label>
          <label>
            <span>Draw FPS</span>
            <input
              type="number"
              min="1"
              max="240"
              step="1"
              bind:value={options.drawFps}
              onchange={onremount}
            />
          </label>
          <label class="wide">
            <span>Filter</span>
            <select bind:value={options.filterPreset} onchange={onremount}>
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
</style>
