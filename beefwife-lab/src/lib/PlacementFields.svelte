<script context="module">
  /** Values a fresh ornament starts from; its resets aim here too. */
  export const ORNAMENT_PRESET = {
    forward: 0,
    outward: 8,
    angleDegrees: 0,
    source: 0.4,
    react: 1,
    recover: 30,
    wobble: 0.85,
  };
</script>

<script>
  import ControlRow from "./ControlRow.svelte";
  import StepperRow from "./StepperRow.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { descriptor, idPattern, SECTION_NAMES } from "./descriptor.js";

  /* Which placement these fields edit: a list in chain.skin plus an index
     into it. Binding through the store path keeps edits inside the list. */
  export let list;
  export let index;
  /* Jump to a definition's editor on the Parts tab: (kind, id). */
  export let oneditpart;
  /* Tell the owner a rename landed so its selection can follow: (id). */
  export let onrename = null;
  export let advanced = false;

  const title = (name) => name[0].toUpperCase() + name.slice(1);

  $: entry = $descriptor.chain.skin[list][index];
  $: ornament = list === "ornaments";
  $: shapeIds = Object.keys($descriptor.definitions.shapes);
  $: paintIds = Object.keys($descriptor.definitions.paints);

  /* A null section anchors to the whole chain; a name anchors to a section. */
  function setScope(scope) {
    $descriptor.chain.skin[list][index].at = {
      ...entry.at,
      section: scope === "section" ? "trunk" : null,
    };
  }

  function setFill(filled) {
    $descriptor.chain.skin[list][index].repeat.count = filled ? null : 1;
  }

  /* Ids must be unique across plates and ornaments together; an invalid or
     taken name reverts the input to the current id. */
  function rename(event) {
    const from = entry.id;
    const to = event.target.value.trim();
    if (to === from) return;
    const skin = $descriptor.chain.skin;
    const taken = [...skin.plates, ...skin.ornaments].some(
      (placement) => placement.id === to,
    );
    if (!idPattern().test(to) || taken) {
      event.target.value = from;
      return;
    }
    $descriptor.chain.skin[list][index].id = to;
    onrename?.(to);
  }
</script>

<div class="fields">
  <label class="wide">
    <Tooltip label="Name of this placement, unique across plates and ornaments."
      ><span>Id</span></Tooltip
    >
    <input value={entry.id} onchange={rename} />
  </label>
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
        value={entry.at.section === null ? "chain" : "section"}
        onchange={(event) => setScope(event.target.value)}
      >
        <option value="chain">Whole chain</option>
        <option value="section">Section</option>
      </select>
    </label>
    {#if entry.at.section !== null}
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
    tip="Size of the shape at this placement."
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
      field={[-180, 180, 1]}
      slider={[-180, 180, 1]}
    />
    <ControlRow
      label="Source"
      tip="What drives the swing: 0 follows the body wave, 1 reacts to moving through the world."
      bind:value={$descriptor.chain.skin[list][index].source}
      reset={ORNAMENT_PRESET.source}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    <ControlRow
      label="React"
      tip="Size of the swing. 0 rides the root rigidly, positive trails, negative leads."
      bind:value={$descriptor.chain.skin[list][index].react}
      reset={ORNAMENT_PRESET.react}
      field={[-4, 4, 0.05]}
      slider={[-4, 4, 0.05]}
    />
    <ControlRow
      label="Recover"
      tip="How fast the swing chases the drive and returns to rest."
      unit="/s"
      digits={1}
      bind:value={$descriptor.chain.skin[list][index].recover}
      reset={ORNAMENT_PRESET.recover}
      field={[0, 1000, 0.5]}
      slider={[0, 60, 0.5]}
    />
    <ControlRow
      label="Wobble"
      tip="Shape of the return: 0 settles clean, 1 overshoots and rings."
      bind:value={$descriptor.chain.skin[list][index].wobble}
      reset={ORNAMENT_PRESET.wobble}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
  {/if}
</div>
