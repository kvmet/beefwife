<script>
  import AssetsPanel from "./AssetsPanel.svelte";
  import JsonPanel from "./JsonPanel.svelte";

  export let selected;
  export let activeTab;
  export let ontab;
  export let onclose;

  const tabs = ["Creature", "Chain", "Motion", "Assets", "JSON"];
  const labels = {
    eyes: ["Ornament", "Eyes"],
    feelers: ["Ornament", "Feelers"],
    dorsal: ["Ornament", "Dorsal ridge"],
    spots: ["Ornament", "Spots"],
    "tail-fin": ["Ornament", "Tail fin"],
    "head-plate": ["Plate", "Head shell"],
  };
  $: item = labels[selected] ?? ["Plate", "Trunk plate"];
</script>

<aside class="inspector" aria-label="Beefwife tools">
  <div class="panel-nav">
    <nav aria-label="Editor modes">
      {#each tabs as tab}
        <button
          class:active={activeTab === tab}
          aria-pressed={activeTab === tab}
          onclick={() => ontab(tab)}
        >
          {tab}
        </button>
      {/each}
    </nav>
    <button class="close-button" aria-label="Close tool panel" onclick={onclose}
      >×</button
    >
  </div>

  <div class="inspector-scroll">
    {#if activeTab === "Chain"}
      <header class="panel-heading">
        <div>
          <span>{item[0]}</span>
          <h2>{item[1]}</h2>
        </div>
        <div class="header-actions">
          <button
            class="delete-button"
            aria-label={`Remove ${item[0].toLowerCase()}`}
            title={`Remove ${item[0].toLowerCase()}`}
            ><i aria-hidden="true"></i></button
          >
          <button aria-label="More actions" title="More actions">•••</button>
        </div>
      </header>

      <div class="selection-path">
        <span>Head</span><b>/</b><span>Upper surface</span><b>/</b><strong
          >{item[1]}</strong
        >
      </div>

      <details open>
        <summary>Placement</summary>
        <div class="fields">
          <label class="wide">
            <span>Anchor scope</span>
            <select><option>Section</option><option>Whole chain</option></select
            >
          </label>
          <label>
            <span>Section</span>
            <select
              ><option>Head</option><option>Trunk</option><option>Tail</option
              ></select
            >
          </label>
          <label>
            <span>From</span>
            <select
              ><option>Start</option><option>Center</option><option>End</option
              ></select
            >
          </label>
          <label>
            <span>Position</span>
            <div class="unit"><input value="1.00" /><em>u</em></div>
          </label>
          <label>
            <span>Normal offset</span>
            <div class="unit"><input value="0.16" /><em>u</em></div>
          </label>
        </div>
      </details>

      <details open>
        <summary>Appearance</summary>
        <div class="fields">
          <label>
            <span>Shape</span>
            <select
              ><option>Round eye</option><option>Spike</option><option
                >Fin</option
              ></select
            >
          </label>
          <label>
            <span>Material</span>
            <select
              ><option>Warm glow</option><option>Shell</option><option
                >Ink</option
              ></select
            >
          </label>
          <label>
            <span>Layer</span>
            <select><option>Over</option><option>Under</option></select>
          </label>
          <label>
            <span>Side</span>
            <select
              ><option>Both</option><option>Left</option><option>Right</option
              ></select
            >
          </label>
          <label>
            <span>Scale</span>
            <input type="range" min="0" max="100" value="54" />
          </label>
          <label>
            <span>Rotation</span>
            <div class="unit"><input value="4" /><em>deg</em></div>
          </label>
        </div>
      </details>

      <details><summary>Visibility &amp; effects</summary></details>
    {:else if activeTab === "Creature"}
      <header class="panel-heading">
        <div>
          <span>Creature</span>
          <h2>Rust walker</h2>
        </div>
        <button aria-label="More actions">•••</button>
      </header>

      <details open>
        <summary>Identity</summary>
        <div class="fields single-column">
          <label><span>Name</span><input value="Rust walker" /></label>
          <label
            ><span>Tags</span><input value="beefwife, ambient, warm" /></label
          >
        </div>
      </details>
      <details open>
        <summary>Body defaults</summary>
        <div class="fields">
          <label
            ><span>Scale</span>
            <div class="unit"><input value="1.00" /><em>x</em></div></label
          >
          <label
            ><span>Facing</span><select
              ><option>Auto</option><option>Left</option><option>Right</option
              ></select
            ></label
          >
          <label class="wide"
            ><span>Base material</span><select
              ><option>Rust shell</option><option>Ink shell</option></select
            ></label
          >
        </div>
      </details>
      <details><summary>Visual effects</summary></details>
    {:else if activeTab === "Motion"}
      <header class="panel-heading">
        <div>
          <span>Motion</span>
          <h2>Crawl profile</h2>
        </div>
        <button aria-label="More actions">•••</button>
      </header>

      <details open>
        <summary>Locomotion</summary>
        <div class="fields">
          <label
            ><span>Gait</span><select
              ><option>Ripple</option><option>Tripod</option></select
            ></label
          >
          <label
            ><span>Pace</span>
            <div class="unit"><input value="1.20" /><em>Hz</em></div></label
          >
          <label
            ><span>Stride</span>
            <div class="unit"><input value="0.72" /><em>u</em></div></label
          >
          <label
            ><span>Lift</span>
            <div class="unit"><input value="0.34" /><em>u</em></div></label
          >
          <label class="wide"
            ><span>Body wave</span><input
              type="range"
              min="0"
              max="100"
              value="38"
            /></label
          >
        </div>
      </details>
      <details open><summary>Steering &amp; intent</summary></details>
      <details><summary>Idle behavior</summary></details>
    {:else if activeTab === "Assets"}
      <AssetsPanel />
    {:else}
      <JsonPanel />
    {/if}
  </div>
</aside>

<style>
  .inspector {
    display: grid;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-left: 6px solid var(--chassis-deep);
    background: var(--chassis);
    box-shadow:
      inset 1px 0 0 var(--chassis-line-high),
      inset 2px 0 0 var(--bevel-light);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .panel-nav {
    display: flex;
    min-width: 0;
    height: 42px;
    padding: 4px 5px 0;
    border-bottom: 1px solid var(--chassis-line-high);
    background: var(--chassis-deep);
    box-shadow: inset 0 1px 0 var(--bevel-light);
  }

  .panel-nav nav {
    display: flex;
    min-width: 0;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .panel-nav nav::-webkit-scrollbar {
    display: none;
  }

  .panel-nav button {
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .panel-nav nav button {
    position: relative;
    min-width: max-content;
    padding: 0 7px;
    border: 1px solid transparent;
    border-bottom: 0;
    font-size: 10px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .panel-nav nav button:hover,
  .panel-nav nav button.active {
    border-color: var(--chassis-line);
    background: var(--chassis);
    color: var(--text);
  }

  .panel-nav nav button.active::after {
    position: absolute;
    right: 9px;
    bottom: 0;
    left: 9px;
    height: 2px;
    background: var(--select);
    content: "";
  }

  .close-button {
    width: 33px;
    height: 32px;
    flex: 0 0 33px;
    border: 1px solid var(--chassis-line-high) !important;
    border-radius: var(--radius-control);
    background: var(--control-face) !important;
    box-shadow: inset 0 1px 0 var(--bevel-light);
    font-size: 18px;
  }

  .close-button:hover {
    background: var(--chassis-high);
    color: var(--text);
  }

  .inspector-scroll {
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .panel-heading {
    position: sticky;
    z-index: 4;
    top: 0;
    display: flex;
    min-height: 72px;
    align-items: center;
    justify-content: space-between;
    margin: 8px 10px 0;
    padding: 13px 14px;
    border: 1px solid var(--chassis-line-high);
    background: var(--label-paper);
    box-shadow:
      inset 0 1px 0 var(--bevel-light),
      0 1px 2px var(--bevel-shadow);
  }

  .panel-heading > div > span,
  label > span {
    display: block;
    color: var(--muted);
    font: var(--label-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h2 {
    margin: 3px 0 0;
    font-size: 18px;
    font-weight: 600;
  }

  .panel-heading button,
  .header-actions button {
    display: grid;
    min-width: 30px;
    height: 30px;
    place-items: center;
    padding: 0 8px;
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .panel-heading button:hover,
  .header-actions button:hover {
    background: var(--chassis-high);
    color: var(--text);
  }
  .header-actions {
    display: flex;
    gap: 2px;
  }
  .delete-button:hover {
    background: var(--danger) !important;
    color: var(--danger-text) !important;
  }

  .delete-button i {
    position: relative;
    width: 10px;
    height: 12px;
    border: 1px solid currentColor;
    border-top: 0;
    border-radius: 0 0 2px 2px;
  }

  .delete-button i::before,
  .delete-button i::after {
    position: absolute;
    background: currentColor;
    content: "";
  }
  .delete-button i::before {
    top: -3px;
    left: -2px;
    width: 12px;
    height: 1px;
  }
  .delete-button i::after {
    top: -5px;
    left: 3px;
    width: 4px;
    height: 2px;
  }

  .selection-path {
    display: flex;
    gap: 7px;
    margin: 0 10px;
    padding: 8px 10px;
    overflow: hidden;
    border-bottom: 1px solid var(--chassis-line);
    color: var(--muted);
    font-size: 10px;
    white-space: nowrap;
  }

  .selection-path b {
    color: var(--faint);
  }
  .selection-path strong {
    overflow: hidden;
    color: var(--select);
    text-overflow: ellipsis;
  }

  details {
    margin: 8px 10px;
    border: 1px solid var(--chassis-line);
    background: color-mix(in srgb, var(--chassis) 82%, var(--chassis-deep));
    box-shadow:
      inset 0 1px 0 var(--bevel-light),
      0 1px 1px var(--bevel-shadow);
  }

  summary {
    position: relative;
    padding: 11px 13px;
    border-bottom: 1px solid transparent;
    background: var(--label-paper);
    color: var(--text-dim);
    cursor: pointer;
    font-size: 10px;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  details[open] summary {
    border-bottom-color: var(--chassis-line);
  }

  summary::after {
    position: absolute;
    top: 50%;
    right: 10px;
    width: 4px;
    height: 4px;
    border: 1px solid var(--screw);
    border-radius: 50%;
    background: var(--control-face);
    content: "";
    transform: translateY(-50%);
  }

  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px 10px;
    padding: 13px 13px 15px;
  }

  .fields.single-column {
    grid-template-columns: 1fr;
  }
  label {
    min-width: 0;
  }
  label.wide {
    grid-column: 1 / -1;
  }
  label > span {
    margin-bottom: 6px;
  }

  select,
  input:not([type="range"]) {
    width: 100%;
    height: 31px;
    border: 1px solid var(--chassis-line-high);
    border-radius: var(--radius-screen);
    outline: 0;
    background: var(--screen);
    color: var(--screen-text);
  }

  select {
    padding: 0 8px;
  }
  input:not([type="range"]) {
    padding: 0 8px;
  }
  input:focus,
  select:focus {
    border-color: var(--screen-select);
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--select);
  }
  /* The unit sits in a ruled gutter of its own so digits always end at the
     same x, which is what makes a column of values scannable. */
  .unit {
    position: relative;
  }

  .unit input {
    padding-right: 38px;
    text-align: right;
  }

  .unit em {
    position: absolute;
    top: 1px;
    right: 1px;
    bottom: 1px;
    display: grid;
    width: 30px;
    place-items: center;
    border-left: 1px solid var(--chassis-line-high);
    color: var(--screen-faint);
    font-size: 9px;
    font-style: normal;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
