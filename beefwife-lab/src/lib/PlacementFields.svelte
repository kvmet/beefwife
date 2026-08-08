<script context="module">
  /** Values a fresh ornament starts from; its resets aim here too. */
  export const ORNAMENT_PRESET = {
    forward: 0,
    outward: 8,
    angleDegrees: 0,
    length: 20,
    sweep: 1.5,
    snapRate: 22,
    dampingRate: 12,
  };
</script>

<script>
  import ControlRow from "./ControlRow.svelte";
  import StepperRow from "./StepperRow.svelte";
  import { descriptor, SECTION_NAMES } from "./descriptor.js";

  /* Which placement these fields edit: a list in chain.skin plus an index
     into it. Binding through the store path keeps edits inside the list. */
  export let list;
  export let index;
  /* Jump to a definition's editor on the Parts tab: (kind, id). */
  export let oneditpart;

  const title = (name) => name[0].toUpperCase() + name.slice(1);

  $: entry = $descriptor.chain.skin[list][index];
  $: ornament = list === "ornaments";
  $: shapeIds = Object.keys($descriptor.definitions.shapes);
  $: paintIds = Object.keys($descriptor.definitions.paints);

  /* The schema pairs scope with section: chain scope demands a null section,
     section scope a named one, so the two change together. */
  function setScope(scope) {
    $descriptor.chain.skin[list][index].at = {
      ...entry.at,
      scope,
      section: scope === "section" ? (entry.at.section ?? "trunk") : null,
    };
  }

  function setFill(filled) {
    $descriptor.chain.skin[list][index].repeat.count = filled ? null : 1;
  }
</script>

<div class="fields">
  <label>
    <span>Shape</span>
    <div class="pick">
      <select bind:value={$descriptor.chain.skin[list][index].shape}>
        {#each shapeIds as shapeId}
          <option value={shapeId}>{shapeId}</option>
        {/each}
      </select>
      <button
        title="Edit on the Parts tab"
        onclick={() => oneditpart("shape", entry.shape)}
      >
        Edit
      </button>
    </div>
  </label>
  <label>
    <span>Paint</span>
    <div class="pick">
      <select bind:value={$descriptor.chain.skin[list][index].paint}>
        {#each paintIds as paintId}
          <option value={paintId}>{paintId}</option>
        {/each}
      </select>
      <button
        title="Edit on the Parts tab"
        onclick={() => oneditpart("paint", entry.paint)}
      >
        Edit
      </button>
    </div>
  </label>
  <label>
    <span>Anchor</span>
    <select
      value={entry.at.scope}
      onchange={(event) => setScope(event.target.value)}
    >
      <option value="chain">Whole chain</option>
      <option value="section">Section</option>
    </select>
  </label>
  {#if entry.at.scope === "section"}
    <label>
      <span>Section</span>
      <select bind:value={$descriptor.chain.skin[list][index].at.section}>
        {#each SECTION_NAMES as name}
          <option value={name}>{title(name)}</option>
        {/each}
      </select>
    </label>
  {/if}
  <label>
    <span>From</span>
    <select bind:value={$descriptor.chain.skin[list][index].at.from}>
      <option value="head">Head</option>
      <option value="tail">Tail</option>
    </select>
  </label>
  {#if ornament}
    <label>
      <span>Side</span>
      <select bind:value={$descriptor.chain.skin[list][index].side}>
        <option value="both">Both</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
      </select>
    </label>
    <label>
      <span>Layer</span>
      <select bind:value={$descriptor.chain.skin[list][index].layer}>
        <option value="over">Over</option>
        <option value="under">Under</option>
      </select>
    </label>
  {/if}
  <label>
    <span>Fill to end</span>
    <div class="switch">
      <input
        type="checkbox"
        checked={entry.repeat.count === null}
        onchange={(event) => setFill(event.target.checked)}
      />
    </div>
  </label>
</div>

<div class="rows">
  <StepperRow
    label="Offset"
    min={0}
    max={255}
    bind:value={$descriptor.chain.skin[list][index].at.offset}
  />
  {#if entry.repeat.count !== null}
    <StepperRow
      label="Count"
      min={1}
      max={256}
      bind:value={$descriptor.chain.skin[list][index].repeat.count}
    />
  {/if}
  <StepperRow
    label="Step"
    min={1}
    max={256}
    bind:value={$descriptor.chain.skin[list][index].repeat.step}
  />
  <ControlRow
    label="Scale"
    unit="x"
    bind:value={$descriptor.chain.skin[list][index].scale}
    reset={1}
    field={[0.001, 100, 0.01]}
    slider={[0, 4, 0.01]}
  />
  {#if ornament}
    <ControlRow
      label="Forward offset"
      unit="px"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].offset.forward}
      reset={ORNAMENT_PRESET.forward}
      field={[-10000, 10000, 0.5]}
      slider={[-40, 40, 0.5]}
    />
    <ControlRow
      label="Outward offset"
      unit="px"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].offset.outward}
      reset={ORNAMENT_PRESET.outward}
      field={[-10000, 10000, 0.5]}
      slider={[-40, 40, 0.5]}
    />
    <ControlRow
      label="Angle"
      unit="deg"
      digits={0}
      bind:value={$descriptor.chain.skin[list][index].angleDegrees}
      reset={ORNAMENT_PRESET.angleDegrees}
      field={[-3600, 3600, 1]}
      slider={[-180, 180, 1]}
    />
    <ControlRow
      label="Length"
      unit="px"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].length}
      reset={ORNAMENT_PRESET.length}
      field={[0.000001, 10000, 0.5]}
      slider={[0.5, 60, 0.5]}
    />
    <ControlRow
      label="Sweep"
      bind:value={$descriptor.chain.skin[list][index].sweep}
      reset={ORNAMENT_PRESET.sweep}
      field={[0, 4, 0.05]}
      slider={[0, 4, 0.05]}
    />
    <ControlRow
      label="Snap rate"
      unit="/s"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].snapRate}
      reset={ORNAMENT_PRESET.snapRate}
      field={[0, 1000, 0.5]}
      slider={[0, 60, 0.5]}
    />
    <ControlRow
      label="Damping rate"
      unit="/s"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].dampingRate}
      reset={ORNAMENT_PRESET.dampingRate}
      field={[0, 1000, 0.5]}
      slider={[0, 60, 0.5]}
    />
  {/if}
</div>
