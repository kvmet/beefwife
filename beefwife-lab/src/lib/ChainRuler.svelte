<script>
  export let counts;
  export let spacings;

  let drag;

  const names = ["Head", "Trunk", "Tail"];
  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

  function adjustedCounts(boundary, delta, initialCounts) {
    const next = [...initialCounts];
    if (boundary === 2) {
      next[2] = clamp(next[2] + delta, 0, 256 - next[0] - next[1]);
      return next;
    }
    const combined = next[boundary] + next[boundary + 1];
    const followingMinimum = boundary === 1 ? 0 : 1;
    next[boundary] = clamp(
      next[boundary] + delta,
      1,
      combined - followingMinimum,
    );
    next[boundary + 1] = combined - next[boundary];
    return next;
  }

  function beginResize(boundary, event) {
    drag = {
      boundary,
      startX: event.clientX,
      counts,
      trackWidth: event.currentTarget.parentElement.parentElement.clientWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resize(event) {
    if (!drag) return;
    const total = drag.counts.reduce((sum, count) => sum + count, 0);
    const delta = Math.round(
      (event.clientX - drag.startX) / (drag.trackWidth / total),
    );
    counts = adjustedCounts(drag.boundary, delta, drag.counts);
  }

  function nudge(boundary, event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    counts = adjustedCounts(
      boundary,
      event.key === "ArrowLeft" ? -1 : 1,
      counts,
    );
    event.preventDefault();
  }

  function finish(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag = undefined;
  }

  $: total = counts.reduce((sum, count) => sum + count, 0);
  $: labelEvery = Math.max(1, Math.ceil(total / 8));
  $: chunkTicks = Array.from({ length: total + 1 }, (_, index) => index);
</script>

<div class="section-ruler">
  <div class="track-label">Sections</div>
  <div class="ruler-body">
    <div class="chunk-rule" aria-hidden="true">
      {#each chunkTicks as tick}
        <i
          class:major={tick % labelEvery === 0}
          class:end={tick === total}
          style:left={`${(tick / total) * 100}%`}
          >{tick % labelEvery === 0 || tick === total ? tick : ""}</i
        >
      {/each}
    </div>
    <div
      class="ruler-track"
      style:grid-template-columns={counts
        .map((count) => `${count}fr`)
        .join(" ")}
    >
      {#each names as section, index}
        <div class="section" class:tail={index === 2}>
          <span>
            <strong>{section}</strong>
            <small>{counts[index]} chunks</small>
            <em>{spacings[index]}px spacing</em>
          </span>
          <button
            class="handle"
            class:dragging={drag?.boundary === index}
            aria-label={index === 2
              ? "Resize total chain chunk count"
              : `Resize ${section} chunk count`}
            title={index === 2
              ? "Change total chunks"
              : `Change ${section} chunks`}
            onpointerdown={(event) => beginResize(index, event)}
            onpointermove={resize}
            onpointerup={finish}
            onpointercancel={finish}
            onkeydown={(event) => nudge(index, event)}
          ></button>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .section-ruler {
    display: grid;
    height: 58px;
    border-bottom: 1px solid var(--chassis-line);
    grid-template-columns: var(--track-label) var(--chain-width);
  }

  .ruler-body {
    display: grid;
    grid-template-rows: 16px minmax(0, 1fr);
  }

  /* Tick weights and label rhythm match the stage graticule, so a span read
     here and the same span read on the canvas look like one measurement. */
  .chunk-rule {
    position: relative;
    border-bottom: 1px solid var(--screen-grid);
    background: var(--screen);
  }

  .chunk-rule i {
    position: absolute;
    top: 0;
    height: 4px;
    padding-left: 3px;
    border-left: 1px solid var(--screen-grid-major);
    color: var(--screen-faint);
    font-size: 8px;
    font-style: normal;
    letter-spacing: 0.06em;
    line-height: 14px;
  }

  .chunk-rule i.major {
    height: 7px;
  }

  .chunk-rule i.end {
    padding-right: 3px;
    padding-left: 0;
    border-right: 1px solid var(--screen-grid-major);
    border-left: 0;
    transform: translateX(-100%);
  }

  .track-label {
    padding: 10px 12px 8px 16px;
    border-right: 1px solid var(--chassis-line);
    background: var(--label-paper);
    box-shadow: inset -1px 0 0 var(--bevel-shadow);
    color: var(--muted);
    font: var(--label-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .ruler-track {
    display: grid;
  }

  .section {
    position: relative;
    display: grid;
    place-items: center;
    border-right: 1px solid var(--screen-grid-major);
    background: var(--screen-high);
    color: var(--screen-text);
  }

  .section > span {
    display: flex;
    max-width: calc(100% - 12px);
    align-items: baseline;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
  }
  .section strong {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .section small {
    color: var(--screen-faint);
    font-size: 9px;
  }
  .section em {
    color: var(--screen-faint);
    font-size: 8px;
    font-style: normal;
  }
  .section.tail {
    border-right: 0;
  }

  .handle {
    position: absolute;
    z-index: 4;
    top: 6px;
    right: -4px;
    width: 8px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--chassis-line-high);
    border-radius: var(--radius-screen);
    background: var(--control-face);
    box-shadow:
      inset 0 1px 0 var(--bevel-light),
      0 1px 1px #0005;
    cursor: col-resize;
    touch-action: none;
  }

  .handle:hover,
  .handle:focus-visible,
  .handle.dragging {
    border-color: var(--select);
    background: var(--select-dim);
  }
</style>
