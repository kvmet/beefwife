<script>
  import ControlRow from "./ControlRow.svelte";
  import StepperRow from "./StepperRow.svelte";
  import PlacementFields, { ORNAMENT_PRESET } from "./PlacementFields.svelte";
  import {
    applyError,
    defaults,
    descriptor,
    placementChunks,
    SECTION_NAMES,
  } from "./descriptor.js";

  export let selection = null;
  export let onselect;
  /* Jump to a definition's editor on the Parts tab: (kind, id). */
  export let oneditpart;

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
        at: { scope: "chain", section: null, from: "head", offset: chunk },
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
        at: { scope: "chain", section: null, from: "head", offset: 0 },
        repeat: { count: 1, step: 1 },
        side: "both",
        layer: "over",
        offset: {
          forward: ORNAMENT_PRESET.forward,
          outward: ORNAMENT_PRESET.outward,
        },
        angleDegrees: ORNAMENT_PRESET.angleDegrees,
        scale: 1,
        length: ORNAMENT_PRESET.length,
        sweep: ORNAMENT_PRESET.sweep,
        snapRate: ORNAMENT_PRESET.snapRate,
        dampingRate: ORNAMENT_PRESET.dampingRate,
      },
    ];
    onselect({ kind: "ornament", id });
  }

  function removePlacement(list, index) {
    $descriptor.chain.skin[list] = skin[list].toSpliced(index, 1);
    onselect(null);
  }
</script>

{#if $applyError}
  <p class="apply-error" role="alert">{$applyError}</p>
{/if}

<details open>
  <summary>Body</summary>
  <div class="rows">
    <ControlRow
      label="Scale"
      unit="x"
      bind:value={$descriptor.appearance.scale}
      reset={defaults.appearance.scale}
      field={[0.01, 100, 0.01]}
      slider={[0.1, 8, 0.01]}
    />
    <ControlRow
      label="Load scale"
      bind:value={$descriptor.chain.skin.loadScale}
      reset={defaults.chain.skin.loadScale}
      field={[0, 10, 0.01]}
      slider={[0, 2, 0.01]}
    />
  </div>
  <div class="fields">
    <label class="wide">
      <span>Ribbon paint</span>
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
  </div>
</details>

<details open>
  <summary>Plates</summary>
  <div class="list">
    {#each skin.plates as plate (plate.id)}
      <button
        aria-pressed={selection?.kind === "plate" && selection.id === plate.id}
        onclick={() => onselect({ kind: "plate", id: plate.id })}
      >
        {plate.id}
      </button>
    {/each}
    <button onclick={addPlate}>+ Add</button>
  </div>
  {#if plateIndex >= 0}
    <PlacementFields list="plates" index={plateIndex} {oneditpart} />
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
        {ornament.id}
      </button>
    {/each}
    <button onclick={addOrnament}>+ Add</button>
  </div>
  {#if ornamentIndex >= 0}
    <PlacementFields list="ornaments" index={ornamentIndex} {oneditpart} />
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
        unit="px"
        digits={1}
        bind:value={$descriptor.chain.sections[name].profile.ribbonWidth.start}
        reset={defaults.chain.sections[name].profile.ribbonWidth.start}
        field={[0, 1000, 0.1]}
        slider={[0, 20, 0.1]}
      />
      <ControlRow
        label="Ribbon width end"
        unit="px"
        digits={1}
        bind:value={$descriptor.chain.sections[name].profile.ribbonWidth.end}
        reset={defaults.chain.sections[name].profile.ribbonWidth.end}
        field={[0, 1000, 0.1]}
        slider={[0, 20, 0.1]}
      />
      <ControlRow
        label="Plate scale start"
        bind:value={$descriptor.chain.sections[name].profile.plateScale.start}
        reset={defaults.chain.sections[name].profile.plateScale.start}
        field={[0, 100, 0.01]}
        slider={[0, 3, 0.01]}
      />
      <ControlRow
        label="Plate scale end"
        bind:value={$descriptor.chain.sections[name].profile.plateScale.end}
        reset={defaults.chain.sections[name].profile.plateScale.end}
        field={[0, 100, 0.01]}
        slider={[0, 3, 0.01]}
      />
    </div>
  </details>
{/each}

<details open>
  <summary>Legs</summary>
  <div class="fields">
    <label>
      <span>Section</span>
      <select bind:value={$descriptor.legs.section}>
        {#each SECTION_NAMES as name}
          <option value={name}>{title(name)}</option>
        {/each}
      </select>
    </label>
  </div>
  <div class="rows">
    <StepperRow
      label="Pairs"
      min={0}
      max={128}
      bind:value={$descriptor.legs.pairs}
    />
    <ControlRow
      label="Reach"
      unit="px"
      digits={1}
      bind:value={$descriptor.legs.reach}
      reset={defaults.legs.reach}
      field={[0.000001, 10000, 0.5]}
      slider={[1, 100, 0.5]}
    />
    <ControlRow
      label="Spread"
      unit="px"
      digits={1}
      bind:value={$descriptor.legs.spread}
      reset={defaults.legs.spread}
      field={[0, 1000, 0.5]}
      slider={[0, 60, 0.5]}
    />
    <ControlRow
      label="Fold"
      bind:value={$descriptor.legs.fold}
      reset={defaults.legs.fold}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    <ControlRow
      label="Joint bend"
      bind:value={$descriptor.legs.jointBend}
      reset={defaults.legs.jointBend}
      field={[-1, 1, 0.01]}
      slider={[-1, 1, 0.01]}
    />
    <ControlRow
      label="Joint lean"
      bind:value={$descriptor.legs.jointLean}
      reset={defaults.legs.jointLean}
      field={[-1, 1, 0.01]}
      slider={[-1, 1, 0.01]}
    />
    <ControlRow
      label="Lean center"
      bind:value={$descriptor.legs.jointLeanCenter}
      reset={defaults.legs.jointLeanCenter}
      field={[-1, 1, 0.01]}
      slider={[-1, 1, 0.01]}
    />
  </div>
</details>

<details open>
  <summary>Leg cycle</summary>
  <div class="rows">
    <ControlRow
      label="Side phase"
      bind:value={$descriptor.legs.sidePhase}
      reset={defaults.legs.sidePhase}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    <ControlRow
      label="Lead"
      bind:value={$descriptor.legs.lead}
      reset={defaults.legs.lead}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    <ControlRow
      label="Lift threshold"
      bind:value={$descriptor.legs.liftThreshold}
      reset={defaults.legs.liftThreshold}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    <ControlRow
      label="Swing time"
      unit="s"
      bind:value={$descriptor.legs.swingSeconds}
      reset={defaults.legs.swingSeconds}
      field={[0.001, 60, 0.01]}
      slider={[0.001, 1, 0.005]}
    />
    <ControlRow
      label="Swing arc"
      unit="px"
      digits={1}
      bind:value={$descriptor.legs.swingArc}
      reset={defaults.legs.swingArc}
      field={[0, 1000, 0.5]}
      slider={[0, 40, 0.5]}
    />
    <ControlRow
      label="Jitter"
      bind:value={$descriptor.legs.jitter}
      reset={defaults.legs.jitter}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
  </div>
</details>

<details open>
  <summary>Leg skin</summary>
  <div class="fields">
    <label>
      <span>Limb paint</span>
      <div class="pick">
        <select bind:value={$descriptor.legs.skin.limbPaint}>
          {#each paintIds as paintId}
            <option value={paintId}>{paintId}</option>
          {/each}
        </select>
        <button
          title="Edit on the Parts tab"
          onclick={() => oneditpart("paint", $descriptor.legs.skin.limbPaint)}
        >
          Edit
        </button>
      </div>
    </label>
    <label>
      <span>Foot shape</span>
      <div class="pick">
        <select bind:value={$descriptor.legs.skin.foot.shape}>
          {#each shapeIds as shapeId}
            <option value={shapeId}>{shapeId}</option>
          {/each}
        </select>
        <button
          title="Edit on the Parts tab"
          onclick={() => oneditpart("shape", $descriptor.legs.skin.foot.shape)}
        >
          Edit
        </button>
      </div>
    </label>
    <label>
      <span>Foot paint</span>
      <div class="pick">
        <select bind:value={$descriptor.legs.skin.foot.paint}>
          {#each paintIds as paintId}
            <option value={paintId}>{paintId}</option>
          {/each}
        </select>
        <button
          title="Edit on the Parts tab"
          onclick={() => oneditpart("paint", $descriptor.legs.skin.foot.paint)}
        >
          Edit
        </button>
      </div>
    </label>
  </div>
  <div class="rows">
    <ControlRow
      label="Foot scale"
      unit="x"
      bind:value={$descriptor.legs.skin.foot.scale}
      reset={defaults.legs.skin.foot.scale}
      field={[0.001, 100, 0.01]}
      slider={[0, 6, 0.01]}
    />
    <ControlRow
      label="Planted scale"
      unit="x"
      bind:value={$descriptor.legs.skin.foot.plantedScale}
      reset={defaults.legs.skin.foot.plantedScale}
      field={[0.001, 100, 0.01]}
      slider={[0, 6, 0.01]}
    />
  </div>
</details>
