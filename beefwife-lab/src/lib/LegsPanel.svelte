<script>
  import ControlRow from "./ControlRow.svelte";
  import StepperRow from "./StepperRow.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { defaults, descriptor, SECTION_NAMES } from "./descriptor.js";

  /* Jump to a definition's editor on the Parts tab: (kind, id). */
  export let oneditpart;
  export let advanced = false;

  const title = (name) => name[0].toUpperCase() + name.slice(1);

  $: shapeIds = Object.keys($descriptor.definitions.shapes);
  $: paintIds = Object.keys($descriptor.definitions.paints);
</script>

<details open>
  <summary>Legs</summary>
  <div class="fields">
    <label>
      <Tooltip label="Section the leg pairs sit on."
        ><span>Section</span></Tooltip
      >
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
      tip="Leg pairs spread evenly along the section by resting distance."
      min={0}
      max={128}
      bind:value={$descriptor.legs.pairs}
    />
    <ControlRow
      label="Reach"
      tip="Length of the forward stance window. A longer reach takes longer steps."
      unit="px"
      digits={1}
      bind:value={$descriptor.legs.reach}
      reset={defaults.legs.reach}
      field={[0.000001, 10000, 0.5]}
      slider={[1, 100, 0.5]}
    />
    <ControlRow
      label="Spread"
      tip="Sideways distance from the body to a planted foot, as a fraction of reach."
      unit="x"
      bind:value={$descriptor.legs.spread}
      reset={defaults.legs.spread}
      field={[0, 4, 0.01]}
      slider={[0, 1.5, 0.01]}
    />
    <ControlRow
      label="Fold"
      tip="Length of the drawn limb against its reach. Higher values fold the limb more."
      bind:value={$descriptor.legs.fold}
      reset={defaults.legs.fold}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    {#if advanced}
      <ControlRow
        label="Joint bend"
        tip="Bow of the knee off the hip-to-foot line. 1 bows back and out, 0 sits on the line, -1 mirrors the bow."
        bind:value={$descriptor.legs.jointBend}
        reset={defaults.legs.jointBend}
        field={[-1, 1, 0.01]}
        slider={[-1, 1, 0.01]}
      />
      <ControlRow
        label="Joint lean"
        tip="Slides each knee lengthwise, up to one limb length. Positive leans knees toward the lean center, negative away."
        bind:value={$descriptor.legs.jointLean}
        reset={defaults.legs.jointLean}
        field={[-1, 1, 0.01]}
        slider={[-1, 1, 0.01]}
      />
      <ControlRow
        label="Lean center"
        tip="Where the lean starts from: the middle of the leg section at 0, its head end at -1, its tail end at 1."
        bind:value={$descriptor.legs.jointLeanCenter}
        reset={defaults.legs.jointLeanCenter}
        field={[-1, 1, 0.01]}
        slider={[-1, 1, 0.01]}
      />
    {/if}
  </div>
</details>

{#if advanced}
  <details open>
    <summary>Leg cycle</summary>
    <div class="rows">
      <ControlRow
        label="Side phase"
        tip="Offsets right-foot contact by this fraction of half a cycle. 1 makes the two sides opposite."
        bind:value={$descriptor.legs.sidePhase}
        reset={defaults.legs.sidePhase}
        field={[0, 1, 0.01]}
        slider={[0, 1, 0.01]}
      />
      <ControlRow
        label="Lead"
        tip="Shifts the plant point forward inside the stance window."
        bind:value={$descriptor.legs.lead}
        reset={defaults.legs.lead}
        field={[0, 1, 0.01]}
        slider={[0, 1, 0.01]}
      />
      <ControlRow
        label="Lift threshold"
        tip="Contact level that releases a planted foot. Higher values step sooner."
        bind:value={$descriptor.legs.liftThreshold}
        reset={defaults.legs.liftThreshold}
        field={[0, 1, 0.01]}
        slider={[0, 1, 0.01]}
      />
      <ControlRow
        label="Swing cycles"
        tip="Time an airborne foot takes to reach its next plant, in gait cycles."
        unit="cyc"
        bind:value={$descriptor.legs.swingCycles}
        reset={defaults.legs.swingCycles}
        field={[0.001, 60, 0.005]}
        slider={[0.001, 1, 0.005]}
      />
      <ControlRow
        label="Swing arc"
        tip="How far outward an airborne foot bows on its way to the next plant, as a fraction of reach."
        unit="x"
        bind:value={$descriptor.legs.swingArc}
        reset={defaults.legs.swingArc}
        field={[0, 4, 0.01]}
        slider={[0, 1.5, 0.01]}
      />
      <ControlRow
        label="Jitter"
        tip="Random variation between legs and between steps. 0 makes the two sides exact mirrors."
        bind:value={$descriptor.legs.jitter}
        reset={defaults.legs.jitter}
        field={[0, 1, 0.01]}
        slider={[0, 1, 0.01]}
      />
    </div>
  </details>
{/if}

<details open>
  <summary>Leg skin</summary>
  <div class="fields">
    <label>
      <Tooltip label="Paint for the two drawn limb segments."
        ><span>Limb paint</span></Tooltip
      >
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
      <Tooltip label="Shape drawn at the end of every leg."
        ><span>Foot shape</span></Tooltip
      >
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
      <Tooltip label="Paint for the foot shape."
        ><span>Foot paint</span></Tooltip
      >
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
      label="Limb width"
      unit="px"
      digits={1}
      bind:value={$descriptor.legs.skin.limbWidth}
      reset={defaults.legs.skin.limbWidth}
      field={[0, 1000, 0.1]}
      slider={[0, 30, 0.1]}
    />
    <ControlRow
      label="Foot scale"
      tip="Size of the foot shape while the leg swings."
      unit="x"
      bind:value={$descriptor.legs.skin.foot.scale}
      reset={defaults.legs.skin.foot.scale}
      field={[0.001, 100, 0.01]}
      slider={[0, 6, 0.01]}
    />
    {#if advanced}
      <ControlRow
        label="Planted scale"
        tip="Extra size while the foot is planted. 1 keeps it at the foot scale."
        unit="x"
        bind:value={$descriptor.legs.skin.foot.plantedScale}
        reset={defaults.legs.skin.foot.plantedScale}
        field={[0.001, 100, 0.01]}
        slider={[0, 6, 0.01]}
      />
    {/if}
  </div>
</details>
