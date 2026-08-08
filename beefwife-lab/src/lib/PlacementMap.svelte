<script>
  import { descriptor, placementChunks, SECTION_NAMES } from "./descriptor.js";

  export let scale = 32;
  export let row = 12.5;
  export let selection = null;
  export let onselect;

  $: chain = $descriptor.chain;
  $: total = SECTION_NAMES.reduce(
    (sum, name) => sum + chain.sections[name].chunks,
    0,
  );
  $: plates = chain.skin.plates.map((entry) => ({
    id: entry.id,
    chunks: placementChunks(chain, entry),
  }));
  $: ornament =
    selection?.kind === "ornament"
      ? chain.skin.ornaments.find((entry) => entry.id === selection.id)
      : null;
  $: markers = ornament ? placementChunks(chain, ornament) : [];
  $: sides = !ornament
    ? []
    : ornament.side === "both"
      ? ["left", "right"]
      : [ornament.side];
</script>

<section class="placement-map" aria-label="Placement map">
  <header>Placement</header>
  <div class="strip" style:--row={`${row}%`}>
    <i class="end" style:top={`${(total / scale) * 100}%`}></i>
    {#each plates as plate (plate.id)}
      {#each plate.chunks as chunk}
        <button
          class="cell"
          aria-pressed={selection?.kind === "plate" &&
            selection.id === plate.id}
          title={plate.id}
          aria-label={`Plate ${plate.id}, chunk ${chunk}`}
          style:top={`${(chunk / scale) * 100}%`}
          style:height={`${(1 / scale) * 100}%`}
          onclick={() => onselect({ kind: "plate", id: plate.id })}
        ></button>
      {/each}
    {/each}
    {#each markers as chunk}
      {#each sides as side}
        <i class="marker {side}" style:top={`${((chunk + 0.5) / scale) * 100}%`}
        ></i>
      {/each}
    {/each}
  </div>
</section>

<style>
  .placement-map {
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
  .strip {
    position: relative;
    overflow: hidden;
    background-color: var(--screen);
    background-image: repeating-linear-gradient(
      180deg,
      transparent 0 calc(var(--row) - 1px),
      var(--screen-grid-major) calc(var(--row) - 1px) var(--row)
    );
  }

  .end {
    position: absolute;
    right: 0;
    left: 0;
    border-top: 1px solid var(--screen-line-major);
    pointer-events: none;
  }

  /* One face per resolved chunk, so a repeat with a step > 1 shows its gaps.
     The 8px margins keep the side markers' lane clear. */
  .cell {
    position: absolute;
    right: 8px;
    left: 8px;
    min-height: 4px;
    padding: 0;
    border: 0;
    outline: 1px solid var(--chassis-line);
    background: var(--chassis);
  }

  .cell:hover {
    outline-color: var(--chassis-line-high);
    background: var(--chassis-high);
  }

  .cell[aria-pressed="true"] {
    outline: 2px solid var(--select);
    background: var(--select-dim);
  }

  .marker {
    position: absolute;
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    pointer-events: none;
    transform: translateY(-50%);
  }

  .marker.left {
    left: 0;
    border-left: 5px solid var(--screen-select);
  }

  .marker.right {
    right: 0;
    border-right: 5px solid var(--screen-select);
  }
</style>
