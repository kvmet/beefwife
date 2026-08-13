<script>
  /* Obstacles the runtime measures. Terrain has no coordinate API: it reads
     the boxes of the elements its `avoid` selector matches, so these divs are
     the terrain, and moving one is what tells the runtime it moved.
     Percentages keep them over the same part of the stage as it resizes. */
  export let boxes;
  export let pending = null;
  export let editable = false;
  export let onremove;
</script>

{#each boxes as box (box.id)}
  <button
    type="button"
    class="terrain-box"
    class:editable
    data-lab-terrain
    disabled={!editable}
    title="Remove this obstacle"
    aria-label={`Remove obstacle ${box.id}`}
    style:left={`${box.left}%`}
    style:top={`${box.top}%`}
    style:width={`${box.width}%`}
    style:height={`${box.height}%`}
    onclick={() => onremove(box.id)}
  ></button>
{/each}

{#if pending}
  <div
    class="terrain-box pending"
    aria-hidden="true"
    style:left={`${pending.left}%`}
    style:top={`${pending.top}%`}
    style:width={`${pending.width}%`}
    style:height={`${pending.height}%`}
  ></div>
{/if}

<style>
  /* Above the canvas so a box can be clicked away, and unfilled so the
     specimen stays visible under one. */
  .terrain-box {
    position: absolute;
    z-index: 2;
    padding: 0;
    border: 1px solid var(--screen-select);
    border-radius: 0;
    outline: none;
    background: repeating-linear-gradient(
      45deg,
      transparent 0 5px,
      color-mix(in oklch, var(--screen-select) 22%, transparent) 5px 6px
    );
  }

  .terrain-box:disabled {
    pointer-events: none;
    opacity: 0.55;
  }

  .terrain-box.editable:hover,
  .terrain-box.editable:focus-visible {
    border-style: dashed;
    background: color-mix(in oklch, var(--screen-select) 18%, transparent);
  }

  .pending {
    border-style: dashed;
    pointer-events: none;
  }
</style>
