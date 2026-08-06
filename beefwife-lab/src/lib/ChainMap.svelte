<script>
  import { descriptor } from "./descriptor.js";

  export let section = null;
  export let onsection;

  const LIMIT = 256;
  const TOTAL_MINIMUM = 2;
  const NAMES = ["head", "trunk", "tail"];
  const MINIMUMS = { head: 1, trunk: 1, tail: 0 };
  const gradations = Array.from({ length: LIMIT / 8 + 1 }, (_, i) => i * 8);

  const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

  /* The strip holds the smallest power-of-two scale the chain still fits in
     under half, so the 12-chunk default reads as a third of the rail instead of
     the 5% sliver a fixed 1/256 scale gives it. */
  const scaleFor = (total) => {
    let scale = 32;
    while (scale < LIMIT && total > scale / 2) scale *= 2;
    return scale;
  };

  let strip;
  let scale = 32;
  let dragging = false;

  $: sections = $descriptor.chain.sections;
  $: total = NAMES.reduce((sum, name) => sum + sections[name].chunks, 0);
  /* Frozen while a handle is down: rescaling mid-drag slides the edge out from
     under the pointer. */
  $: if (!dragging) scale = scaleFor(total);

  $: bands = NAMES.map((name, index) => {
    const chunks = sections[name].chunks;
    return {
      name,
      index,
      chunks,
      start: startOf(index),
      count: `${chunks} ${chunks === 1 ? "segment" : "segments"}`,
    };
  });

  function startOf(index) {
    return NAMES.slice(0, index).reduce(
      (sum, name) => sum + sections[name].chunks,
      0,
    );
  }

  /* Summed from the live sections rather than the derived total, which lags a
     burst of resizes by a flush and would let the clamp pass 256. */
  function othersOf(index) {
    return NAMES.reduce(
      (sum, name, other) =>
        other === index ? sum : sum + sections[name].chunks,
      0,
    );
  }

  function resize(index, chunks) {
    const name = NAMES[index];
    const others = othersOf(index);
    $descriptor.chain.sections[name].chunks = clamp(
      chunks,
      Math.max(MINIMUMS[name], TOTAL_MINIMUM - others),
      LIMIT - others,
    );
  }

  function chunkAt(event) {
    const bounds = strip.getBoundingClientRect();
    const offset = clamp(event.clientY - bounds.top, 0, bounds.height);
    return Math.round((offset / bounds.height) * scale);
  }

  function startDrag(event, index) {
    event.preventDefault();
    dragging = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    resize(index, chunkAt(event) - startOf(index));
  }

  function dragTo(event, index) {
    if (!dragging) return;
    resize(index, chunkAt(event) - startOf(index));
  }

  function endDrag(event) {
    dragging = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /* Down grows the section, matching the drag and the panel's width handle,
     rather than the up-is-more a bare slider would imply. */
  function nudge(event, index) {
    const steps = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    resize(index, sections[NAMES[index]].chunks + step);
  }
</script>

<section class="chain-map" aria-label="Chain map">
  <header>Chain</header>
  <div class="strip" class:settled={!dragging} bind:this={strip}>
    {#each gradations as value}
      <i
        class="tick"
        class:end={value === scale}
        style:top={`${(value / scale) * 100}%`}
        style:opacity={value <= scale && value % (scale / 4) === 0 ? 1 : 0}
        >{value}</i
      >
    {/each}

    {#each bands as band}
      <button
        class="band"
        aria-pressed={section === band.name}
        style:top={`${(band.start / scale) * 100}%`}
        style:height={`${(band.chunks / scale) * 100}%`}
        title={`${band.name} · ${band.count}`}
        aria-label={`${band.name}, ${band.count}`}
        onclick={() => onsection(band.name)}
      ></button>
    {/each}

    {#each bands as band}
      <button
        class="lip"
        role="slider"
        tabindex="0"
        aria-label={`${band.name} segment length`}
        aria-valuemin={MINIMUMS[band.name]}
        aria-valuemax={LIMIT}
        aria-valuenow={band.chunks}
        aria-orientation="vertical"
        title={`Drag to set ${band.name} length`}
        style:top={`${((band.start + band.chunks) / scale) * 100}%`}
        style:left={`${band.index * 35}%`}
        onpointerdown={(event) => startDrag(event, band.index)}
        onpointermove={(event) => dragTo(event, band.index)}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        onkeydown={(event) => nudge(event, band.index)}
      ></button>
    {/each}
  </div>
</section>

<style>
  /* The 2px top edge continues the tab row's edge across the chain rail, so
     42px of rail above it plus the 22px header lines the strip's top up with
     the wave screens. */
  .chain-map {
    display: grid;
    min-height: 0;
    flex: 1;
    border-top: 2px solid var(--edge-light);
    grid-template-rows: 22px minmax(0, 1fr);
  }

  /* The right border sits on the header and strip, not the section, so it
     starts below the 2px top edge at the same y as the wave columns'. */
  header {
    overflow: hidden;
    padding: 5px 6px 0;
    border-right: 1px solid var(--chassis-line);
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
    color: var(--muted);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .strip {
    position: relative;
    overflow: hidden;
    border-right: 1px solid var(--chassis-line);
    background: var(--screen);
    touch-action: none;
  }

  /* Only between drags: a moving handle must track the pointer exactly, while
     the scale change on release is what the glide makes legible. */
  .strip.settled .tick,
  .strip.settled .band,
  .strip.settled .lip {
    transition:
      top 250ms ease,
      height 250ms ease,
      opacity 250ms ease;
  }

  /* Labels ride over the bands so the strip spends no width on a gutter. */
  .tick {
    position: absolute;
    z-index: 2;
    right: 0;
    left: 0;
    border-top: 1px solid var(--screen-grid-major);
    color: var(--screen-muted);
    font-size: 9px;
    font-style: normal;
    line-height: 11px;
    padding-left: 3px;
    pointer-events: none;
  }

  .tick.end {
    border-top: 0;
    border-bottom: 1px solid var(--screen-grid-major);
    line-height: 13px;
    transform: translateY(-100%);
  }

  .band {
    position: absolute;
    right: 2px;
    left: 2px;
    min-height: 4px;
    padding: 0;
    border: 0;
    outline: 1px solid var(--screen-line-major);
    background: color-mix(in oklch, var(--screen) 82%, var(--screen-text));
  }

  .band:hover {
    background: color-mix(in oklch, var(--screen) 70%, var(--screen-select));
    outline-color: var(--screen-select);
  }

  .band[aria-pressed="true"] {
    outline: 2px solid var(--screen-select);
    background: color-mix(in oklch, var(--screen) 62%, var(--screen-select));
    color: var(--screen-text);
  }

  /* Three fixed slots across the strip, so the handles of two sections that
     share a boundary sit side by side instead of stacking. */
  .lip {
    position: absolute;
    z-index: 3;
    width: 30%;
    height: 9px;
    padding: 0;
    cursor: ns-resize;
    touch-action: none;
    transform: translateY(-50%);
  }
</style>
