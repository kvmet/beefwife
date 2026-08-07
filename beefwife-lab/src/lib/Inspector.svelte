<script>
  import { tick } from "svelte";
  import AssetsPanel from "./AssetsPanel.svelte";
  import ChainMap from "./ChainMap.svelte";
  import ConfigPanel from "./ConfigPanel.svelte";
  import LookPanel from "./LookPanel.svelte";
  import MotionPanel from "./MotionPanel.svelte";
  import Tooltip from "./Tooltip.svelte";
  import WaveColumn from "./WaveColumn.svelte";
  import { descriptor, SECTION_NAMES } from "./descriptor.js";

  export let selected;
  export let activeTab;
  export let ontab;
  export let onhide;

  const tabs = ["Config", "Motion", "Look", "Parts"];
  const TAU = Math.PI * 2;

  let selectedSection = null;
  let motionPanel;
  let advancedMode = false;
  let chainScale = 32;

  async function revealSection(name) {
    selectedSection = name;
    if (activeTab !== "Motion") ontab("Motion");
    await tick();
    motionPanel?.reveal(name);
  }

  /* At time zero a channel runs sin(offset - harmonic·lag·d) down the chain,
     so its on-screen cycle count comes from the lag, not the clock.
     TODO: mirrors BeefwifeGait._phaseAt; sample via the beefwife API once it
     exports the gait channels, instead of keeping this math in step by hand. */
  const waveOf = (gait, channel, length, variant, amp, duty) => ({
    variant,
    amp,
    cycles: (-channel.harmonic * gait.phaseLagRadiansPerPixel * length) / TAU,
    phase: channel.phaseOffset,
    duty,
  });

  $: gait = $descriptor.gait;
  $: chainLength = SECTION_NAMES.reduce((sum, name) => {
    const section = $descriptor.chain.sections[name];
    return sum + section.chunks * section.spacing;
  }, 0);
  /* The wave plots share the chain map's chunk scale, so their traces span
     the same fraction of the column the bands span of the strip, and their
     rows keep the 4-chunk rhythm across a doubling. */
  $: totalChunks = SECTION_NAMES.reduce(
    (sum, name) => sum + $descriptor.chain.sections[name].chunks,
    0,
  );
  $: chainSpan = totalChunks / chainScale;
  $: waveRow = (4 / chainScale) * 100;
  /* Bend plots saturated past 1 (the schema allows 10); thrust has no bounded
     unit, so its trace shows timing at full width and the field shows size. */
  $: bodyWaves = [
    waveOf(
      gait,
      gait.bend,
      chainLength,
      "primary",
      Math.min(1, gait.bend.amplitude),
    ),
    waveOf(gait, gait.thrust, chainLength, "weave", 1, gait.thrust.dutyCycle),
    waveOf(gait, gait.gather, chainLength, "gather", gait.gather.amplitude),
  ];
  $: liftWaves = [
    waveOf(
      gait,
      gait.contact,
      chainLength,
      "primary",
      gait.contact.lift,
      gait.contact.dutyCycle,
    ),
  ];
</script>

<aside class="inspector" aria-label="Beefwife tools">
  <div class="chain-rail">
    <Tooltip label="Hide panel">
      <button class="hide-panel" aria-label="Hide panel" onclick={onhide}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect
            x="1.5"
            y="2.5"
            width="13"
            height="11"
            fill="none"
            stroke="currentColor"
          />
          <rect x="9.5" y="4" width="3.5" height="8" fill="currentColor" />
        </svg>
      </button>
    </Tooltip>
    <ChainMap
      section={selectedSection}
      onsection={revealSection}
      onscale={(value) => (chainScale = value)}
    />
  </div>

  <div class="inspector-main">
    <div class="panel-nav">
      <div role="tablist" aria-label="Editor modes">
        {#each tabs as tab}
          <button
            role="tab"
            aria-selected={activeTab === tab}
            onclick={() => ontab(tab)}
          >
            {tab}
          </button>
        {/each}
      </div>
    </div>

    <div class="inspector-body">
      {#if activeTab === "Motion"}
        <WaveColumn
          title="Body waves"
          waves={bodyWaves}
          span={chainSpan}
          row={waveRow}
        />
        <WaveColumn
          title="Lift"
          waves={liftWaves}
          span={chainSpan}
          row={waveRow}
        />
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

      <div
        class="inspector-scroll"
        class:motion={activeTab === "Motion"}
        role="tabpanel"
        aria-label={activeTab}
      >
        <div class="slim-heading">
          {#if activeTab === "Motion"}
            <label class="advanced-mode">
              <input type="checkbox" bind:checked={advancedMode} />
              <span>Advanced mode</span>
            </label>
          {/if}
        </div>
        {#if activeTab === "Look"}
          <LookPanel {selected} />
        {:else if activeTab === "Config"}
          <ConfigPanel />
        {:else if activeTab === "Motion"}
          <MotionPanel bind:this={motionPanel} advanced={advancedMode} />
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

  /* 26px face at 10px from the top matches the topbar buttons, and the 16px
     left margin mirrors the topbar's right padding across the divider; the
     margins total 46px so the rail hands off to the chain map at the same y
     as the tabs do to the body. */
  .hide-panel {
    display: grid;
    width: 26px;
    height: 26px;
    flex: none;
    margin: 10px auto 10px 16px;
    padding: 0;
    place-items: center;
  }

  .hide-panel svg {
    display: block;
    width: 16px;
    height: 16px;
  }

  .hide-panel:hover {
    background: var(--select-dim);
    color: var(--select-text);
  }

  /* Above .inspector-scroll so the selected tab paints over the panel's top
     edge; the overhang is why this strip cannot clip. */
  /* 46px puts the body's top edge level with the stage's top under the
     46px topbar; the padding grows instead of the tabs. */
  .panel-nav {
    position: relative;
    z-index: 2;
    display: flex;
    min-width: 0;
    height: 46px;
    padding: 8px 5px 0;
    background: var(--bg);
  }

  .panel-nav [role="tablist"] {
    min-width: 0;
    flex: 1;
    justify-content: flex-end;
  }

  /* min-width: 0 is what lets a flex item shrink past its label; without it the
     strip clips the last tab instead. */
  .panel-nav [role="tablist"] button {
    position: relative;
    min-width: 0;
    padding: 0 7px;
    overflow: hidden;
    font-size: 12px;
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* The top edge the tabs sit on. A border rather than an inset shadow, so the
     sticky .slim-heading scrolls under it instead of covering it. */
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
    width: 72px;
    min-height: 0;
    flex: none;
    border-right: 1px solid var(--chassis-line);
    grid-template-rows: 26px minmax(0, 1fr);
  }

  .selector-column header {
    overflow: hidden;
    padding: 7px 3px 0;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .selector-screen {
    background: var(--screen);
  }

  /* Same 26px rule the wave column headers draw, so the strips read as one
     band across the panel. */
  .slim-heading {
    position: sticky;
    z-index: 4;
    top: 0;
    display: flex;
    height: 26px;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
  }

  .advanced-mode {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .advanced-mode input {
    flex: none;
  }

  /* Silkscreen legend: O and I flank the switch. The thrown side's glyph
     darkens, and I takes the select ink while on. */
  .advanced-mode::before,
  .advanced-mode::after {
    color: var(--faint);
    font-size: 9px;
    line-height: 1;
  }

  .advanced-mode::before {
    content: "O";
  }

  .advanced-mode::after {
    content: "I";
  }

  .advanced-mode:not(:has(input:checked))::before {
    color: var(--muted);
  }

  .advanced-mode:has(input:checked)::after {
    color: var(--select-text);
  }

  /* The label leads the switch inside the right-riding control. */
  .advanced-mode span {
    order: -1;
    margin: 0 6px 6px 0;
    color: var(--text);
    font-size: 12px;
    letter-spacing: 0.02em;
    text-transform: none;
  }
</style>
