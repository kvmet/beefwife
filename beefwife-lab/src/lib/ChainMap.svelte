<script>
  import ChainRuler from "./ChainRuler.svelte";
  import ChainToolbar from "./ChainToolbar.svelte";
  import OrnamentTrack from "./OrnamentTrack.svelte";

  export let selected;

  let appearanceOpen = true;
  let motionOpen = false;
  let sectionCounts = [2, 7, 3];
  let sectionSpacings = [12, 12, 10];
  let editorHeight = 320;
  let heightDrag;

  $: totalChunks = sectionCounts.reduce((sum, count) => sum + count, 0);
  $: sectionWidths = sectionCounts.map((count) => (count / totalChunks) * 100);

  const plates = [
    "H1",
    "H2",
    "T1",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "R1",
    "R2",
    "R3",
  ];

  function clampEditorHeight(height) {
    return Math.min(
      Math.max(height, 180),
      Math.max(180, window.innerHeight - 194),
    );
  }

  function beginHeightResize(event) {
    heightDrag = {
      startY: event.clientY,
      startHeight: editorHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeHeight(event) {
    if (!heightDrag) return;
    editorHeight = clampEditorHeight(
      heightDrag.startHeight + heightDrag.startY - event.clientY,
    );
  }

  function nudgeHeight(event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    editorHeight = clampEditorHeight(
      editorHeight + (event.key === "ArrowUp" ? 16 : -16),
    );
    event.preventDefault();
  }

  function finishHeightResize(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    heightDrag = undefined;
  }
</script>

<section
  class="chain-map"
  aria-label="Chain map editor"
  style:height={`${editorHeight}px`}
>
  <div
    class="height-handle"
    role="slider"
    aria-label="Chain editor height"
    aria-orientation="vertical"
    aria-valuemin="180"
    aria-valuemax="720"
    aria-valuenow={Math.round(editorHeight)}
    tabindex="0"
    title="Drag to resize chain editor"
    onpointerdown={beginHeightResize}
    onpointermove={resizeHeight}
    onpointerup={finishHeightResize}
    onpointercancel={finishHeightResize}
    onkeydown={nudgeHeight}
  ></div>
  <ChainToolbar bind:counts={sectionCounts} />

  <div
    class="map-scroll"
    style:--head-end={`${sectionWidths[0]}%`}
    style:--trunk-end={`${sectionWidths[0] + sectionWidths[1]}%`}
    style:--chain-width={`${Math.max(760, totalChunks * 64)}px`}
  >
    <ChainRuler bind:counts={sectionCounts} spacings={sectionSpacings} />

    <div class="group-heading">
      <button
        aria-expanded={appearanceOpen}
        onclick={() => (appearanceOpen = !appearanceOpen)}
      >
        <i class:open={appearanceOpen}>›</i> Appearance
      </button>
      <span>2 tracks</span>
    </div>

    {#if appearanceOpen}
      <div class="track-row plates-row">
        <div class="track-label">
          <strong>Plates</strong>
          <span>body surface</span>
        </div>
        <div class="timeline plate-track">
          {#each plates as plate, index}
            <button
              class:active={selected === `${plate}-plate` ||
                (index === 0 && selected === "head-plate")}
              onclick={() =>
                (selected = index === 0 ? "head-plate" : `${plate}-plate`)}
            >
              <span>{plate}</span>
              <small
                >{index < 2 ? "shell" : index < 8 ? "scale" : "taper"}</small
              >
            </button>
          {/each}
        </div>
      </div>

      <OrnamentTrack bind:selected />
    {/if}

    <div class="group-heading">
      <button
        aria-expanded={motionOpen}
        onclick={() => (motionOpen = !motionOpen)}
      >
        <i class:open={motionOpen}>›</i> Motion
      </button>
      <span>2 tracks · gait inherited</span>
    </div>

    {#if motionOpen}
      <div class="track-row compact">
        <div class="track-label">
          <strong>Limbs</strong><span>6 anchors</span>
        </div>
        <div class="timeline limb-track">
          {#each [20, 32, 44, 56, 68, 79] as position, index}
            <button style:left={`${position}%`} aria-label={`Leg ${index + 1}`}
              >{index + 1}</button
            >
          {/each}
        </div>
      </div>
      <div class="track-row compact">
        <div class="track-label">
          <strong>Body wave</strong><span>amplitude</span>
        </div>
        <div class="timeline wave-track"><i></i></div>
      </div>
    {/if}
  </div>

  <footer>
    <p>
      <kbd>Drag</kbd> place · <kbd>⌘ drag</kbd> duplicate · <kbd>[ ]</kbd> change
      layer
    </p>
    <p>Boundaries snap to chunks; section spacing remains independent.</p>
  </footer>
</section>

<style>
  .chain-map {
    position: relative;
    display: grid;
    min-height: 0;
    overflow: hidden;
    border-top: 8px solid var(--bg);
    background: var(--bg);
    box-shadow:
      inset 0 1px 0 var(--chassis-line-high),
      0 -1px 0 var(--bevel-shadow);
    grid-template-rows: 52px minmax(0, 1fr) 36px;
  }

  .height-handle {
    position: absolute;
    z-index: 12;
    top: -5px;
    right: 0;
    left: 0;
    height: 10px;
    cursor: row-resize;
    touch-action: none;
  }

  .height-handle::after {
    position: absolute;
    top: 4px;
    right: 0;
    left: 0;
    height: 2px;
    background: transparent;
    content: "";
    transition: background 120ms ease;
  }

  .height-handle:hover::after,
  .height-handle:focus-visible::after {
    background: var(--select);
  }

  .chain-map footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .map-scroll {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .track-row {
    display: grid;
    grid-template-columns: var(--track-label) var(--chain-width);
  }

  .track-label {
    padding: 10px 12px 8px 16px;
    border-right: 1px solid var(--chassis-line);
    background: var(--chassis);
    box-shadow: inset -2px 0 0 var(--bevel-shadow);
  }
  .track-label strong,
  .track-label span {
    display: block;
  }
  .track-label strong {
    font-size: 12px;
    font-weight: 650;
  }
  .track-label span {
    margin-top: 2px;
    color: var(--faint);
    font-size: 10px;
  }
  .timeline {
    position: relative;
    background-color: var(--screen);
    background-image:
      linear-gradient(
        90deg,
        transparent var(--head-end),
        var(--screen-line-major) var(--head-end),
        var(--screen-line-major) calc(var(--head-end) + 1px),
        transparent calc(var(--head-end) + 1px)
      ),
      linear-gradient(
        90deg,
        transparent var(--trunk-end),
        var(--screen-line-major) var(--trunk-end),
        var(--screen-line-major) calc(var(--trunk-end) + 1px),
        transparent calc(var(--trunk-end) + 1px)
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0 calc(8.333% - 1px),
        var(--screen-grid) calc(8.333% - 1px) 8.333%
      );
  }

  .group-heading {
    display: flex;
    align-items: center;
    height: 33px;
    padding: 0 8px;
    gap: 8px;
    border-top: 1px solid var(--bevel-light);
    border-bottom: 1px solid var(--chassis-line-high);
    background: var(--chassis);
  }

  .group-heading button {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 124px;
    height: 23px;
    padding: 0 8px;
    color: var(--text);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .group-heading button i {
    color: var(--muted);
    font-size: 17px;
    font-style: normal;
    transition: transform 120ms ease;
  }
  .group-heading button i.open {
    transform: rotate(90deg);
  }
  .group-heading span {
    padding-left: 8px;
    border-left: 1px solid var(--chassis-line);
    color: var(--faint);
    font-size: 9px;
  }

  .track-row {
    min-height: 61px;
    border-bottom: 1px solid var(--chassis-line);
  }
  .track-row.compact {
    min-height: 45px;
  }

  .plate-track {
    display: grid;
    grid-template-columns: repeat(2, 10%) repeat(6, 9.1667%) repeat(3, 8.333%);
    gap: 2px;
    padding: 7px 8px;
  }

  .plate-track button {
    min-width: 0;
    background: #4a262c;
    outline-color: #7d5b60;
    color: #d9b6b8;
  }

  .plate-track button:hover,
  .plate-track button.active {
    background: #5e3138;
    color: #f0d2d4;
  }
  .plate-track span,
  .plate-track small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .plate-track span {
    font-size: 10px;
  }
  .plate-track small {
    color: #936f74;
    font-size: 8px;
  }

  .limb-track button {
    position: absolute;
    top: 10px;
    width: 24px;
    height: 24px;
    background: #1e242c;
    outline-color: var(--bevel-face-screen);
    color: #8993a2;
  }

  .limb-track button:hover {
    background: #2b333e;
    color: var(--screen-text);
  }

  .wave-track i {
    position: absolute;
    top: 21px;
    right: 15px;
    left: 15px;
    height: 1px;
    background: #8993a2;
  }

  .chain-map footer {
    min-height: 36px;
    padding: 0 16px;
    border-top: 1px solid var(--chassis-line-high);
    background: var(--bg);
    box-shadow: inset 0 2px 0 var(--bevel-light);
    color: var(--faint);
    font-size: 10px;
  }

  .chain-map footer p {
    margin: 0;
    font-family: var(--font-text);
    font-size: 11px;
  }
  kbd {
    padding: 1px 4px;
    border: 1px solid var(--chassis-line-high);
    border-radius: var(--radius-screen);
    background: var(--chassis-high);
    color: var(--muted);
    font:
      9px ui-monospace,
      monospace;
  }
</style>
