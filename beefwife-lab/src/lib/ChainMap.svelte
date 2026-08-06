<script>
  const capacity = 256;
  const sections = [
    { name: "Head", chunks: 2 },
    { name: "Trunk", chunks: 7 },
    { name: "Tail", chunks: 3 },
  ];

  let start = 0;
  const bands = sections.map((section) => {
    const band = { ...section, start };
    start += section.chunks;
    return band;
  });

  const ticks = Array.from({ length: capacity / 32 + 1 }, (_, i) => i * 32);
</script>

<section class="chain-map" aria-label="Chain map">
  <header>Chain</header>
  <div class="strip">
    {#each ticks as tick}
      <i
        class="tick"
        class:end={tick === capacity}
        style:top={`${(tick / capacity) * 100}%`}>{tick}</i
      >
    {/each}
    {#each bands as band}
      <button
        class="band"
        style:top={`${(band.start / capacity) * 100}%`}
        style:height={`${(band.chunks / capacity) * 100}%`}
        title={`${band.name} · ${band.chunks} chunks`}
        aria-label={`${band.name}, ${band.chunks} chunks`}
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
  }

  .tick {
    position: absolute;
    right: 0;
    left: 0;
    border-top: 1px solid var(--screen-grid-major);
    color: var(--screen-faint);
    font-size: 7px;
    font-style: normal;
    line-height: 10px;
    padding-left: 3px;
    pointer-events: none;
  }

  .tick.end {
    border-top: 0;
    border-bottom: 1px solid var(--screen-grid-major);
    line-height: 12px;
    transform: translateY(-100%);
  }

  /* Bands render at true 1/256 scale, so the default 12-chunk creature is a
     sliver at the top; min-height keeps each section grabbable. */
  .band {
    position: absolute;
    right: 8px;
    left: 14px;
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
</style>
