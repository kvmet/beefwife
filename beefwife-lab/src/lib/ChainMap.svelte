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
  const used = start;

  const ticks = Array.from({ length: capacity / 32 + 1 }, (_, i) => i * 32);
</script>

<section class="chain-map" aria-label="Chain map">
  <header>
    <strong>Chain</strong>
    <span>{used}/{capacity}</span>
  </header>
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
  /* The 66px header matches the tab row, its 2px edge, and the 22px column
     headers beside it, so the strip's top lines up with the wave screens. */
  .chain-map {
    display: grid;
    width: 66px;
    min-height: 0;
    flex: none;
    border-right: 1px solid var(--chassis-line);
    grid-template-rows: 66px minmax(0, 1fr);
  }

  header {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 2px;
    overflow: hidden;
    padding: 0 6px 5px;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
    white-space: nowrap;
  }

  header strong {
    color: var(--muted);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  header span {
    color: var(--faint);
    font-size: 7px;
  }

  .strip {
    position: relative;
    overflow: hidden;
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
