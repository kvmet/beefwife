<script>
  import ControlRow from "./ControlRow.svelte";
  import StepperRow from "./StepperRow.svelte";
  import {
    applyError,
    defaults,
    descriptor,
    SECTION_MINIMUMS,
    SECTION_NAMES,
  } from "./descriptor.js";

  export let advanced = false;
  /* Jump to a definition's editor on the Parts tab: (kind, id). */
  export let oneditpart;

  const DEG = 180 / Math.PI;
  const CHANNEL_NAMES = ["bend", "thrust", "gather", "contact"];
  const PHASE = [-180, 180, 1];

  /* Thrust spans 0..1e6 in the schema, but bodies walk between 0 and a few
     thousand, so a linear track spends all its travel above the useful band.
     The taper puts that band across the whole track and keeps 0 at the left
     end, where two of the sample bodies sit. */
  const THRUST_SLIDER_MAX = 10000;
  const THRUST_TAPER = 20;
  const thrustCurve = {
    in: (value) =>
      Math.log1p((THRUST_TAPER * value) / THRUST_SLIDER_MAX) /
      Math.log1p(THRUST_TAPER),
    out: (position) =>
      Math.round(
        (Math.expm1(position * Math.log1p(THRUST_TAPER)) / THRUST_TAPER) *
          THRUST_SLIDER_MAX,
      ),
  };

  const title = (name) => name[0].toUpperCase() + name.slice(1);

  let sectionPanels = {};

  $: materialIds = Object.keys($descriptor.definitions.materials);

  /** Open a section's panel and bring it into view. Called by the chain map. */
  export function reveal(name) {
    const panel = sectionPanels[name];
    if (!panel) return;
    panel.open = true;
    panel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
</script>

{#if $applyError}
  <p class="apply-error" role="alert">{$applyError}</p>
{/if}

<!-- Basic mode opens every panel so the short list reads as one page;
     advanced mode adds enough rows that open panels bury the summaries, so
     switching collapses them. -->
<details open={!advanced}>
  <summary>Gait clock</summary>
  <div class="rows">
    <ControlRow
      label="Pace"
      unit="Hz"
      bind:value={$descriptor.gait.cyclesPerSecond}
      reset={defaults.gait.cyclesPerSecond}
      field={[0, 100, 0.01]}
      slider={[0, 10, 0.01]}
    />
    <ControlRow
      label="Wave travel"
      unit={["rad", "/px"]}
      digits={3}
      bind:value={$descriptor.gait.phaseLagRadiansPerPixel}
      reset={defaults.gait.phaseLagRadiansPerPixel}
      field={[-3.14, 3.14, 0.005]}
      slider={[-0.3, 0.3, 0.001]}
    />
  </div>
</details>

<details open={!advanced}>
  <summary>Bend</summary>
  <div class="rows">
    <ControlRow
      label="Amplitude"
      bind:value={$descriptor.gait.bend.amplitude}
      reset={defaults.gait.bend.amplitude}
      field={[0, 10, 0.01]}
      slider={[0, 2, 0.01]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        min={1}
        max={8}
        bind:value={$descriptor.gait.bend.harmonic}
      />
      <ControlRow
        label="Phase"
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.gait.bend.phaseOffset}
        reset={defaults.gait.bend.phaseOffset}
        field={PHASE}
        slider={PHASE}
      />
    {/if}
  </div>
</details>

<details open={!advanced}>
  <summary>Thrust</summary>
  <div class="rows">
    <ControlRow
      label="Acceleration"
      unit={["px", "/s²"]}
      digits={0}
      curve={thrustCurve}
      bind:value={$descriptor.gait.thrust.acceleration}
      reset={defaults.gait.thrust.acceleration}
      field={[0, 1000000, 1]}
      slider={[0, 1, 0.001]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        min={1}
        max={8}
        bind:value={$descriptor.gait.thrust.harmonic}
      />
      <ControlRow
        label="Phase"
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.gait.thrust.phaseOffset}
        reset={defaults.gait.thrust.phaseOffset}
        field={PHASE}
        slider={PHASE}
      />
      <ControlRow
        label="Duty cycle"
        bind:value={$descriptor.gait.thrust.dutyCycle}
        reset={defaults.gait.thrust.dutyCycle}
        field={[0.01, 1, 0.01]}
        slider={[0.01, 1, 0.01]}
      />
    {/if}
  </div>
</details>

<details open={!advanced}>
  <summary>Gather</summary>
  <div class="rows">
    <ControlRow
      label="Amplitude"
      bind:value={$descriptor.gait.gather.amplitude}
      reset={defaults.gait.gather.amplitude}
      field={[0, 0.95, 0.01]}
      slider={[0, 0.95, 0.01]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        min={1}
        max={8}
        bind:value={$descriptor.gait.gather.harmonic}
      />
      <ControlRow
        label="Phase"
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.gait.gather.phaseOffset}
        reset={defaults.gait.gather.phaseOffset}
        field={PHASE}
        slider={PHASE}
      />
    {/if}
  </div>
</details>

<details open={!advanced}>
  <summary>Contact</summary>
  <div class="rows">
    <ControlRow
      label="Lift"
      bind:value={$descriptor.gait.contact.lift}
      reset={defaults.gait.contact.lift}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        min={1}
        max={8}
        bind:value={$descriptor.gait.contact.harmonic}
      />
      <ControlRow
        label="Phase"
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.gait.contact.phaseOffset}
        reset={defaults.gait.contact.phaseOffset}
        field={PHASE}
        slider={PHASE}
      />
      <ControlRow
        label="Duty cycle"
        bind:value={$descriptor.gait.contact.dutyCycle}
        reset={defaults.gait.contact.dutyCycle}
        field={[0.01, 1, 0.01]}
        slider={[0.01, 1, 0.01]}
      />
    {/if}
  </div>
</details>

{#each SECTION_NAMES as name}
  <details bind:this={sectionPanels[name]} open={!advanced}>
    <summary>{title(name)}</summary>
    {#if advanced}
      <div class="fields">
        <label class="wide">
          <span>Material</span>
          <div class="pick">
            <select bind:value={$descriptor.chain.sections[name].material}>
              {#each materialIds as materialId}
                <option value={materialId}>{materialId}</option>
              {/each}
            </select>
            <button
              title="Edit on the Parts tab"
              onclick={() =>
                oneditpart(
                  "material",
                  $descriptor.chain.sections[name].material,
                )}
            >
              Edit
            </button>
          </div>
        </label>
      </div>
    {/if}
    <div class="rows">
      <ControlRow
        label="Segment length"
        digits={0}
        bind:value={$descriptor.chain.sections[name].chunks}
        reset={defaults.chain.sections[name].chunks}
        field={[SECTION_MINIMUMS[name], 256, 1]}
        slider={[SECTION_MINIMUMS[name], 64, 1]}
      />
      <ControlRow
        label="Link distance"
        unit="px"
        digits={1}
        bind:value={$descriptor.chain.sections[name].spacing}
        reset={defaults.chain.sections[name].spacing}
        field={[0.000001, 1000, 0.5]}
        slider={[1, 40, 0.5]}
      />
      {#if advanced}
        <hr class="rule" />
        {#each CHANNEL_NAMES as channel}
          <ControlRow
            label="{title(channel)} sensitivity"
            bind:value={$descriptor.chain.sections[name].motionScale[channel]}
            reset={defaults.chain.sections[name].motionScale[channel]}
            field={[0, 4, 0.05]}
            slider={[0, 2, 0.05]}
          />
        {/each}
      {/if}
    </div>
  </details>
{/each}

{#if advanced}
  <details>
    <summary>Steering</summary>
    <div class="rows">
      <ControlRow
        label="Gain"
        bind:value={$descriptor.chain.physics.steering.gain}
        reset={defaults.chain.physics.steering.gain}
        field={[0, 100, 0.05]}
        slider={[0, 5, 0.05]}
      />
      <ControlRow
        label="Limit"
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.chain.physics.steering.limit}
        reset={defaults.chain.physics.steering.limit}
        field={[0, 180, 1]}
        slider={[0, 180, 1]}
      />
      <ControlRow
        label="Rate"
        unit="/s"
        digits={1}
        bind:value={$descriptor.chain.physics.steering.rate}
        reset={defaults.chain.physics.steering.rate}
        field={[0, 1000, 0.5]}
        slider={[0, 50, 0.5]}
      />
    </div>
  </details>
{/if}

<details open={!advanced}>
  <summary>Ground lift</summary>
  <div class="rows">
    <ControlRow
      label="Amount"
      bind:value={$descriptor.chain.physics.autoLift.amount}
      reset={defaults.chain.physics.autoLift.amount}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    {#if advanced}
      <ControlRow
        label="Share"
        digits={3}
        bind:value={$descriptor.chain.physics.autoLift.share}
        reset={defaults.chain.physics.autoLift.share}
        field={[0, 1, 0.005]}
        slider={[0, 1, 0.005]}
      />
      <ControlRow
        label="Rate"
        unit="/s"
        digits={1}
        bind:value={$descriptor.chain.physics.autoLift.rate}
        reset={defaults.chain.physics.autoLift.rate}
        field={[0, 1000, 0.5]}
        slider={[0, 50, 0.5]}
      />
    {/if}
  </div>
</details>

<details open={!advanced}>
  <summary>Idle behavior</summary>
  <div class="rows">
    <ControlRow
      label="Breathing"
      bind:value={$descriptor.chain.breathing}
      reset={defaults.chain.breathing}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
  </div>
</details>
