<script>
  export let title;
  export let waves;

  const steps = 96;

  function path(wave) {
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      const x =
        50 +
        wave.amp * 44 * Math.sin(2 * Math.PI * wave.cycles * t + wave.phase);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${(t * 100).toFixed(1)}`;
    }).join(" ");
  }
</script>

<div class="wave-column">
  <header>{title}</header>
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <line class="axis" x1="50" y1="0" x2="50" y2="100" />
    {#each waves as wave}
      <path class={wave.variant} d={path(wave)} />
    {/each}
  </svg>
</div>

<style>
  .wave-column {
    display: grid;
    width: 84px;
    min-height: 0;
    flex: none;
    border-right: 1px solid var(--chassis-line);
    grid-template-rows: 22px minmax(0, 1fr);
  }

  header {
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

  /* Same 32-chunk row rhythm as the chain strip, so a y here reads as the
     same chain position there. */
  svg {
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--screen);
    background-image: repeating-linear-gradient(
      180deg,
      transparent 0 calc(12.5% - 1px),
      var(--screen-grid-major) calc(12.5% - 1px) 12.5%
    );
  }

  path,
  .axis {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .axis {
    stroke: var(--screen-axis);
  }

  .primary {
    stroke: var(--screen-text);
    stroke-width: 2;
  }

  .weave {
    stroke: #8993a2;
    stroke-width: 1;
  }

  .gather {
    stroke: #8993a2;
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
</style>
