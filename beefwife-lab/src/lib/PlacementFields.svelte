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
  import Tooltip from "./Tooltip.svelte";
  import { descriptor, SECTION_NAMES } from "./descriptor.js";

  /* Which placement these fields edit: a list in chain.skin plus an index
     into it. Binding through the store path keeps edits inside the list. */
  export let list;
  export let index;
  /* Jump to a definition's editor on the Parts tab: (kind, id). */
  export let oneditpart;
  export let advanced = false;

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
    <Tooltip label="Shape drawn at this placement."><span>Shape</span></Tooltip>
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
    <Tooltip label="Fill and stroke for this placement."
      ><span>Paint</span></Tooltip
    >
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
  {#if advanced}
    <label>
      <Tooltip
        label="What the offset counts along: the whole chain or one section. Copies never leave that scope."
        ><span>Anchor</span></Tooltip
      >
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
        <Tooltip label="Section the offset counts inside."
          ><span>Section</span></Tooltip
        >
        <select bind:value={$descriptor.chain.skin[list][index].at.section}>
          {#each SECTION_NAMES as name}
            <option value={name}>{title(name)}</option>
          {/each}
        </select>
      </label>
    {/if}
    <label>
      <Tooltip
        label="End the offset counts from. Copies walk away from that end."
        ><span>From</span></Tooltip
      >
      <select bind:value={$descriptor.chain.skin[list][index].at.from}>
        <option value="head">Head</option>
        <option value="tail">Tail</option>
      </select>
    </label>
  {/if}
  {#if ornament}
    <label>
      <Tooltip
        label="Side of the body that carries the ornament. Both mirrors it."
        ><span>Side</span></Tooltip
      >
      <select bind:value={$descriptor.chain.skin[list][index].side}>
        <option value="both">Both</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
      </select>
    </label>
    {#if advanced}
      <label>
        <Tooltip label="Draws the ornament over or under the ribbon and plates."
          ><span>Layer</span></Tooltip
        >
        <select bind:value={$descriptor.chain.skin[list][index].layer}>
          <option value="over">Over</option>
          <option value="under">Under</option>
        </select>
      </label>
    {/if}
  {/if}
  {#if advanced}
    <label>
      <Tooltip label="Repeats through the rest of the anchor's scope."
        ><span>Fill to end</span></Tooltip
      >
      <div class="switch">
        <input
          type="checkbox"
          checked={entry.repeat.count === null}
          onchange={(event) => setFill(event.target.checked)}
        />
      </div>
    </label>
  {/if}
</div>

<div class="rows">
  <StepperRow
    label="Offset"
    tip="Chunks from the chosen end to the first copy. 0 is that end itself."
    min={0}
    max={255}
    bind:value={$descriptor.chain.skin[list][index].at.offset}
  />
  {#if entry.repeat.count !== null}
    <StepperRow
      label="Count"
      tip="Number of copies to place."
      min={1}
      max={256}
      bind:value={$descriptor.chain.skin[list][index].repeat.count}
    />
  {/if}
  {#if advanced}
    <StepperRow
      label="Step"
      tip="Chunks between one copy and the next."
      min={1}
      max={256}
      bind:value={$descriptor.chain.skin[list][index].repeat.step}
    />
  {/if}
  <ControlRow
    label="Scale"
    tip="Size of the shape at this placement, on top of the body scale."
    unit="x"
    bind:value={$descriptor.chain.skin[list][index].scale}
    reset={1}
    field={[0.001, 100, 0.01]}
    slider={[0, 4, 0.01]}
  />
  {#if ornament}
    <ControlRow
      label="Forward offset"
      tip="Moves the root along the body. Positive goes toward the head."
      unit="px"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].offset.forward}
      reset={ORNAMENT_PRESET.forward}
      field={[-10000, 10000, 0.5]}
      slider={[-40, 40, 0.5]}
    />
    <ControlRow
      label="Outward offset"
      tip="Moves the root away from the body, toward its own side."
      unit="px"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].offset.outward}
      reset={ORNAMENT_PRESET.outward}
      field={[-10000, 10000, 0.5]}
      slider={[-40, 40, 0.5]}
    />
    <ControlRow
      label="Angle"
      tip="Turns the ornament away from the body's forward direction."
      unit="deg"
      digits={0}
      bind:value={$descriptor.chain.skin[list][index].angleDegrees}
      reset={ORNAMENT_PRESET.angleDegrees}
      field={[-3600, 3600, 1]}
      slider={[-180, 180, 1]}
    />
    <ControlRow
      label="Length"
      tip="Distance held between the root and the tip after every step."
      unit="px"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].length}
      reset={ORNAMENT_PRESET.length}
      field={[0.000001, 10000, 0.5]}
      slider={[0.5, 60, 0.5]}
    />
    {#if advanced}
      <ControlRow
        label="Sweep"
        tip="How much root motion the tip leaves behind. 0 follows the root exactly."
        bind:value={$descriptor.chain.skin[list][index].sweep}
        reset={ORNAMENT_PRESET.sweep}
        field={[0, 4, 0.05]}
        slider={[0, 4, 0.05]}
      />
      <ControlRow
        label="Snap rate"
        tip="How fast the tip returns to its rest angle."
        unit="/s"
        digits={1}
        bind:value={$descriptor.chain.skin[list][index].snapRate}
        reset={ORNAMENT_PRESET.snapRate}
        field={[0, 1000, 0.5]}
        slider={[0, 60, 0.5]}
      />
      <ControlRow
        label="Damping rate"
        tip="How fast tip motion dies away. Low values swing for longer."
        unit="/s"
        digits={1}
        bind:value={$descriptor.chain.skin[list][index].dampingRate}
        reset={ORNAMENT_PRESET.dampingRate}
        field={[0, 1000, 0.5]}
        slider={[0, 60, 0.5]}
      />
    {/if}
  {/if}
</div>
