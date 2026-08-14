<script>
  import ControlRow from "./ControlRow.svelte";
  import StepperRow from "./StepperRow.svelte";
  import PlacementFields, { ORNAMENT_PRESET } from "./PlacementFields.svelte";
  import { thumbBox } from "./ShapeEditor.svelte";
  import Tooltip from "./Tooltip.svelte";
  import {
    applyError,
    descriptor,
    placementChunks,
    SECTION_NAMES,
  } from "./descriptor.js";

  export let selection = null;
  export let onselect;
  /* Jump to a definition's editor on the Parts tab: (kind, id). */
  export let oneditpart;
  export let advanced = false;

  const title = (name) => name[0].toUpperCase() + name.slice(1);

  $: skin = $descriptor.chain.skin;
  $: shapeIds = Object.keys($descriptor.definitions.shapes);
  $: paintIds = Object.keys($descriptor.definitions.paints);
  $: plateIndex =
    selection?.kind === "plate"
      ? skin.plates.findIndex((entry) => entry.id === selection.id)
      : -1;
  $: ornamentIndex =
    selection?.kind === "ornament"
      ? skin.ornaments.findIndex((entry) => entry.id === selection.id)
      : -1;

  function uniqueId(prefix) {
    const taken = new Set(
      [...skin.plates, ...skin.ornaments].map((entry) => entry.id),
    );
    let n = 1;
    while (taken.has(`${prefix}-${n}`)) n++;
    return `${prefix}-${n}`;
  }

  /* Plates may not overlap, so a new one lands on the first free chunk
     rather than on top of chunk 0's occupant. */
  function addPlate() {
    const total = SECTION_NAMES.reduce(
      (sum, name) => sum + $descriptor.chain.sections[name].chunks,
      0,
    );
    const occupied = new Set(
      skin.plates.flatMap((entry) => placementChunks($descriptor.chain, entry)),
    );
    let chunk = 0;
    while (chunk < total - 1 && occupied.has(chunk)) chunk++;
    const id = uniqueId("plate");
    $descriptor.chain.skin.plates = [
      ...skin.plates,
      {
        id,
        shape: shapeIds[0],
        paint: paintIds[0],
        at: { section: null, from: "head", offset: chunk },
        repeat: { count: 1, step: 1 },
        scale: 1,
      },
    ];
    onselect({ kind: "plate", id });
  }

  function addOrnament() {
    const id = uniqueId("ornament");
    $descriptor.chain.skin.ornaments = [
      ...skin.ornaments,
      {
        id,
        shape: shapeIds[0],
        paint: paintIds[0],
        at: { section: null, from: "head", offset: 0 },
        repeat: { count: 1, step: 1 },
        side: "both",
        layer: "over",
        offset: {
          forward: ORNAMENT_PRESET.forward,
          outward: ORNAMENT_PRESET.outward,
        },
        angleDegrees: ORNAMENT_PRESET.angleDegrees,
        scale: 1,
        source: ORNAMENT_PRESET.source,
        react: ORNAMENT_PRESET.react,
        recover: ORNAMENT_PRESET.recover,
        wobble: ORNAMENT_PRESET.wobble,
      },
    ];
    onselect({ kind: "ornament", id });
  }

  function removePlacement(list, index) {
    $descriptor.chain.skin[list] = skin[list].toSpliced(index, 1);
    onselect(null);
  }

  let resizeFactor = 1;
  let resizeError = null;

  /* Bakes the factor into every length field via the schema transform;
     the input returns to 1 so the next apply starts fresh. */
  function applyResize() {
    try {
      descriptor.set(
        window.BeefwifeCanvas.Descriptor.scale($descriptor, resizeFactor),
      );
      resizeFactor = 1;
      resizeError = null;
    } catch (error) {
      resizeError = error.message;
    }
  }
</script>

{#snippet placementThumb(entry)}
  {@const shape = $descriptor.definitions.shapes[entry.shape]}
  {@const paint = $descriptor.definitions.paints[entry.paint]}
  {@const box = shape && thumbBox(shape.path)}
  {#if box && paint}
    <svg class="thumb" viewBox={box} aria-hidden="true">
      <path
        d={shape.path}
        fill={paint.fill ?? "none"}
        stroke={paint.stroke?.colour ?? "none"}
        stroke-width={paint.stroke?.width ?? 0}
      />
    </svg>
  {/if}
{/snippet}

{#if $applyError}
  <p class="apply-error" role="alert">{$applyError}</p>
{/if}

<details open>
  <summary>Body</summary>
  <div class="rows">
    {#if advanced}
      <ControlRow
        label="Load scale"
        tip="Swells each plate with the grip under its chunk. Negative values shrink them under grip instead; 0 keeps plates at one size."
        bind:value={$descriptor.chain.skin.loadScale}
        reset={0}
        field={[-1, 10, 0.01]}
        slider={[-1, 2, 0.01]}
      />
    {/if}
  </div>
  <div class="fields">
    <label class="wide">
      <Tooltip label="Paint for the ribbon drawn along the whole chain."
        ><span>Ribbon paint</span></Tooltip
      >
      <div class="pick">
        <select bind:value={$descriptor.chain.skin.ribbon.paint}>
          {#each paintIds as paintId}
            <option value={paintId}>{paintId}</option>
          {/each}
        </select>
        <button
          title="Edit on the Parts tab"
          onclick={() => oneditpart("paint", skin.ribbon.paint)}
        >
          Edit
        </button>
      </div>
    </label>
    <label>
      <Tooltip
        label="Resizes the whole creature: every length in the descriptor is multiplied by this factor and baked in."
        ><span>Resize</span></Tooltip
      >
      <div class="pick">
        <input
          type="number"
          min="0.01"
          max="100"
          step="0.01"
          bind:value={resizeFactor}
        />
        <button onclick={applyResize}>Apply</button>
      </div>
    </label>
  </div>
  {#if resizeError}
    <p class="apply-error" role="alert">{resizeError}</p>
  {/if}
</details>

<details open>
  <summary>Plates</summary>
  <div class="list">
    {#each skin.plates as plate (plate.id)}
      <button
        aria-pressed={selection?.kind === "plate" && selection.id === plate.id}
        onclick={() => onselect({ kind: "plate", id: plate.id })}
      >
        {@render placementThumb(plate)}
        {plate.id}
      </button>
    {/each}
    <button onclick={addPlate}>+ Add</button>
  </div>
  {#if plateIndex >= 0}
    <PlacementFields
      list="plates"
      index={plateIndex}
      {oneditpart}
      {advanced}
      onrename={(id) => onselect({ kind: "plate", id })}
    />
    <div class="list-actions">
      <button onclick={() => removePlacement("plates", plateIndex)}>
        Remove
      </button>
    </div>
  {/if}
</details>

<details open>
  <summary>Ornaments</summary>
  <div class="list">
    {#each skin.ornaments as ornament (ornament.id)}
      <button
        aria-pressed={selection?.kind === "ornament" &&
          selection.id === ornament.id}
        onclick={() => onselect({ kind: "ornament", id: ornament.id })}
      >
        {@render placementThumb(ornament)}
        {ornament.id}
      </button>
    {/each}
    <button onclick={addOrnament}>+ Add</button>
  </div>
  {#if ornamentIndex >= 0}
    <PlacementFields
      list="ornaments"
      index={ornamentIndex}
      {oneditpart}
      {advanced}
      onrename={(id) => onselect({ kind: "ornament", id })}
    />
    <div class="list-actions">
      <button onclick={() => removePlacement("ornaments", ornamentIndex)}>
        Remove
      </button>
    </div>
  {/if}
</details>

{#each SECTION_NAMES as name}
  <details open>
    <summary>{title(name)} profile</summary>
    <div class="rows">
      <ControlRow
        label="Ribbon width start"
        tip="Ribbon half-width at the first chunk of this section."
        unit="px"
        digits={1}
        bind:value={$descriptor.chain.sections[name].profile.ribbonWidth.start}
        reset={4.5}
        field={[0, 1000, 0.1]}
        slider={[0, 20, 0.1]}
      />
      <ControlRow
        label="Ribbon width end"
        tip="Ribbon half-width at the last chunk of this section."
        unit="px"
        digits={1}
        bind:value={$descriptor.chain.sections[name].profile.ribbonWidth.end}
        reset={4.5}
        field={[0, 1000, 0.1]}
        slider={[0, 20, 0.1]}
      />
      {#if advanced}
        <ControlRow
          label="Plate scale start"
          tip="Plate size at the first chunk of this section."
          bind:value={$descriptor.chain.sections[name].profile.plateScale.start}
          reset={1}
          field={[0, 100, 0.01]}
          slider={[0, 3, 0.01]}
        />
        <ControlRow
          label="Plate scale end"
          tip="Plate size at the last chunk of this section."
          bind:value={$descriptor.chain.sections[name].profile.plateScale.end}
          reset={1}
          field={[0, 100, 0.01]}
          slider={[0, 3, 0.01]}
        />
      {/if}
    </div>
  </details>
{/each}

<style>
  .thumb {
    width: 22px;
    height: 16px;
    flex: none;
  }

  .list button {
    display: flex;
    align-items: center;
    gap: 7px;
  }
</style>
