<script>
  export let title;
  export let waves;
  /* Fraction of the column the chain occupies and the grid row height in %,
     both driven by the chain map's chunk scale. */
  export let span = 1;
  export let row = 12.5;

  const steps = 96;
  const TAU = 2 * Math.PI;

  /* TODO: mirrors BeefwifeGait._pulseAt. The beefwife API should export
     channel sampling so this copy cannot drift from the simulation. */
  function value(wave, t) {
    const angle = TAU * wave.cycles * t + wave.phase;
    if (!wave.duty) return Math.sin(angle);
    const cycle = (((angle % TAU) + TAU) % TAU) / TAU;
    return cycle >= wave.duty ? 0 : Math.sin((Math.PI * cycle) / wave.duty);
  }

  /* t is chain-lengths, so t > 1 extrapolates the wave past the chain's end
     for the ghost continuation. */
  function path(wave, from, to) {
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = from + ((to - from) * index) / steps;
      const x = 50 + wave.amp * 44 * value(wave, t);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${(t * span * 100).toFixed(1)}`;
    }).join(" ");
  }

  /* Built here rather than in the template so a span-only change (a chain
     rescale) redraws the traces; inline path() calls would only track waves. */
  $: traces = waves.map((wave) => ({
    variant: wave.variant,
    solid: path(wave, 0, 1),
    ghost: span < 1 ? path(wave, 1, 1 / span) : null,
  }));
</script>

<div class="wave-column">
  <header>{title}</header>
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    aria-hidden="true"
    style:--row={`${row}%`}
  >
    <line class="axis" x1="50" y1="0" x2="50" y2="100" />
    {#each traces as trace}
      {#if trace.ghost}
        <path class={`${trace.variant} ghost`} d={trace.ghost} />
      {/if}
      <path class={trace.variant} d={trace.solid} />
    {/each}
  </svg>
</div>

<style>
  .wave-column {
    display: grid;
    width: 72px;
    min-height: 0;
    flex: none;
    border-right: 1px solid var(--chassis-line);
    grid-template-rows: 26px minmax(0, 1fr);
  }

  header {
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

  /* Same 4-chunk row rhythm as the chain strip at its current scale, so a y
     here reads as the same chain position there. */
  svg {
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--screen);
    background-image: repeating-linear-gradient(
      180deg,
      transparent 0 calc(var(--row) - 1px),
      var(--screen-grid-major) calc(var(--row) - 1px) var(--row)
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

  /* The wave keeps going past the chain's end at 30% ink, so the chain's
     extent stays legible without the trace vanishing. */
  .ghost {
    stroke-opacity: 0.3;
  }
</style>
