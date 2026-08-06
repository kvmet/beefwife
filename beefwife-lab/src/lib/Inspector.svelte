<script>
  import AssetsPanel from "./AssetsPanel.svelte";
  import ChainMap from "./ChainMap.svelte";
  import JsonPanel from "./JsonPanel.svelte";
  import WaveColumn from "./WaveColumn.svelte";

  export let selected;
  export let activeTab;
  export let ontab;
  export let onhide;

  const tabs = ["Config", "Motion", "Look", "Parts"];
  const bodyWaves = [
    { variant: "primary", amp: 0.8, cycles: 3, phase: 0 },
    { variant: "weave", amp: 0.5, cycles: 4, phase: 1.3 },
    { variant: "gather", amp: 0.65, cycles: 2, phase: 2.4 },
  ];
  const liftWaves = [{ variant: "primary", amp: 0.7, cycles: 5, phase: 0.7 }];
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
  <div class="chain-rail">
    <button
      class="hide-panel"
      aria-label="Hide panel"
      title="Hide panel"
      onclick={onhide}>−</button
    >
    <ChainMap />
  </div>

  <div class="inspector-main">
    <div class="panel-nav">
      <nav role="tablist" aria-label="Editor modes">
        {#each tabs as tab}
          <button
            role="tab"
            aria-selected={activeTab === tab}
            onclick={() => ontab(tab)}
          >
            {tab}
          </button>
        {/each}
      </nav>
    </div>

    <div class="inspector-body">
      {#if activeTab === "Motion"}
        <WaveColumn title="Body waves" waves={bodyWaves} />
        <WaveColumn title="Lift" waves={liftWaves} />
      {:else if activeTab === "Look"}
        <div class="selector-column">
          <header>Plates</header>
          <div class="selector-screen"></div>
        </div>
        <div class="selector-column">
          <header>Ornaments</header>
          <div class="selector-screen"></div>
        </div>
      {/if}

      <div class="inspector-scroll" role="tabpanel" aria-label={activeTab}>
        {#if activeTab === "Look"}
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
              <button aria-label="More actions" title="More actions">•••</button
              >
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
                <select
                  ><option>Section</option><option>Whole chain</option></select
                >
              </label>
              <label>
                <span>Section</span>
                <select
                  ><option>Head</option><option>Trunk</option><option
                    >Tail</option
                  ></select
                >
              </label>
              <label>
                <span>From</span>
                <select
                  ><option>Start</option><option>Center</option><option
                    >End</option
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
                  ><option>Both</option><option>Left</option><option
                    >Right</option
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
        {:else if activeTab === "Config"}
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
                ><span>Tags</span><input
                  value="beefwife, ambient, warm"
                /></label
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
                  ><option>Auto</option><option>Left</option><option
                    >Right</option
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
          <details open>
            <summary>Canonical JSON</summary>
            <JsonPanel />
          </details>
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
        {:else if activeTab === "Parts"}
          <AssetsPanel />
        {/if}
      </div>
    </div>
  </div>
</aside>

<style>
  /* The bevel belongs to the panel, so it runs the full height of its left
     edge beside the chain map. The lines live in the padding, where no child
     background can cover them. */
  .inspector {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding-left: 3px;
    overflow: hidden;
    background: var(--bg);
    box-shadow:
      inset 2px 0 0 var(--chassis-line-high),
      inset 3px 0 0 var(--bevel-light);
  }

  /* minmax(0, 1fr) pins the implicit column to the panel's width; an auto
     column would grow to the tab row's max-content and push the right-aligned
     tabs off-screen when the panel is narrow. */
  .inspector-main {
    display: grid;
    min-width: 0;
    min-height: 0;
    flex: 1;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .chain-rail {
    display: flex;
    width: 66px;
    min-height: 0;
    flex: none;
    flex-direction: column;
    background: var(--bg);
  }

  /* 26px face at 10px from the top matches the topbar buttons; the margins
     total 42px so the rail hands off to the chain map at the same y as the
     tabs do to the body. */
  .hide-panel {
    display: grid;
    height: 26px;
    flex: none;
    margin: 10px auto 6px 5px;
    padding: 0 9px;
    place-items: center;
    font-size: 12px;
    line-height: 1;
  }

  .hide-panel:hover {
    background: var(--select-dim);
    color: var(--select-text);
  }

  /* Above .inspector-scroll so the selected tab paints over the panel's top
     edge; the overhang is why this strip cannot clip. */
  .panel-nav {
    position: relative;
    z-index: 2;
    display: flex;
    min-width: 0;
    height: 42px;
    padding: 4px 5px 0;
    background: var(--bg);
  }

  .panel-nav nav {
    min-width: 0;
    flex: 1;
    justify-content: flex-end;
  }

  /* min-width: 0 is what lets a flex item shrink past its label; without it the
     strip clips the last tab instead. */
  .panel-nav nav button {
    position: relative;
    min-width: 0;
    padding: 0 7px;
    overflow: hidden;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* The top edge the tabs sit on. A border rather than an inset shadow, so the
     sticky .panel-heading scrolls under it instead of covering it. */
  .inspector-body {
    position: relative;
    z-index: 1;
    display: flex;
    min-height: 0;
    border-top: 2px solid var(--edge-light);
    background: var(--chassis);
  }

  .inspector-scroll {
    min-width: 0;
    min-height: 0;
    flex: 1;
    background: var(--chassis);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .selector-column {
    display: grid;
    width: 84px;
    min-height: 0;
    flex: none;
    border-right: 1px solid var(--chassis-line);
    grid-template-rows: 22px minmax(0, 1fr);
  }

  .selector-column header {
    overflow: hidden;
    padding: 5px 6px 0;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
    color: var(--muted);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .selector-screen {
    background: var(--screen);
  }

  .panel-heading {
    position: sticky;
    z-index: 4;
    top: 0;
    display: flex;
    min-height: 64px;
    align-items: center;
    justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
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
    font-size: 20px;
    font-weight: 600;
  }

  .panel-heading button,
  .header-actions button {
    display: grid;
    min-width: 30px;
    height: 30px;
    place-items: center;
    padding: 0 8px;
  }

  .header-actions {
    display: flex;
    gap: 2px;
  }
  .delete-button:hover {
    background: var(--danger-dim);
    color: var(--danger);
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
    padding: 8px 16px;
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
    margin: 4px 10px;
  }

  /* Section headings are silkscreen on the chassis, not controls; the only
     control face is the small latch, which presses in while open. */
  summary {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 2px;
    border: 0;
    outline: none;
    background: none;
    color: var(--text);
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  summary:hover,
  details[open] > summary {
    border: 0;
    outline: none;
    background: none;
    color: var(--text);
  }

  summary::before {
    display: grid;
    width: 14px;
    height: 14px;
    flex: none;
    place-items: center;
    outline: 2px outset var(--bevel-face);
    background: var(--chassis);
    color: var(--muted);
    content: "+";
    font-size: 10px;
    line-height: 1;
  }

  details[open] summary::before {
    outline-style: inset;
    background: var(--select-dim);
    color: var(--select-text);
    content: "−";
  }

  /* Engraved rule: dark line over light, running to the section's edge. */
  summary::after {
    flex: 1;
    height: 2px;
    background: linear-gradient(
      var(--chassis-line-high) 1px,
      var(--bevel-light) 1px
    );
    content: "";
  }

  /* 23px lines the fields up under the heading text, past the 14px latch
     and its 9px gap. */
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px 10px;
    padding: 6px 2px 15px 23px;
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
    height: 34px;
    padding: 0 8px;
    outline-color: var(--bevel-face-screen);
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
