<script>
  import ControlRow from "./ControlRow.svelte";
  import StepperRow from "./StepperRow.svelte";
  import Tooltip from "./Tooltip.svelte";
  import {
    applyError,
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
  /* Segment resets: a short head, a long trunk, and a tail between them. */
  const SECTION_PRESET = {
    head: { chunks: 2, spacing: 12 },
    trunk: { chunks: 8, spacing: 12 },
    tail: { chunks: 4, spacing: 12 },
  };

  /* Every channel carries these three rows, and they mean the same thing in
     each one. */
  const HARMONIC_TIP =
    "Waves this channel runs per gait cycle. Higher values shorten the wavelength too.";
  const PHASE_TIP = "Shifts this channel ahead of or behind the shared clock.";
  const DUTY_TIP =
    "Part of the cycle the pulse fills. 0.5 matches the positive half of a sine.";

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

  /* Presentation only: the schema stores phaseLagRadiansPerPixel; the panel
     shows it as a wavelength and a travel direction. */
  const TAU = Math.PI * 2;
  const DEFAULT_WAVELENGTH = 200;
  let lastWavelength = DEFAULT_WAVELENGTH;
  $: lag = $descriptor.gait.phaseLagRadiansPerPixel;
  $: travelDirection = lag === 0 ? "none" : lag > 0 ? "head-tail" : "tail-head";
  $: if (lag !== 0) lastWavelength = TAU / Math.abs(lag);

  const lagFor = (direction, wavelength) =>
    direction === "none"
      ? 0
      : ((direction === "head-tail" ? 1 : -1) * TAU) / wavelength;

  function setTravelDirection(direction) {
    $descriptor.gait.phaseLagRadiansPerPixel = lagFor(
      direction,
      lastWavelength,
    );
  }

  function applyWavelength(px) {
    lastWavelength = px;
    if (travelDirection !== "none")
      $descriptor.gait.phaseLagRadiansPerPixel = lagFor(travelDirection, px);
  }

  function commitWavelength(event) {
    const typed = +event.target.value;
    if (Number.isFinite(typed))
      applyWavelength(Math.min(5000, Math.max(5, typed)));
    event.target.value = Math.round(lastWavelength);
  }

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
  <div class="fields">
    <label>
      <Tooltip
        label="Way the wave runs along the body. None moves the body as one."
        ><span>Wave travel</span></Tooltip
      >
      <select
        value={travelDirection}
        onchange={(event) => setTravelDirection(event.target.value)}
      >
        <option value="head-tail">Head to tail</option>
        <option value="tail-head">Tail to head</option>
        <option value="none">None</option>
      </select>
    </label>
  </div>
  <div class="rows">
    <ControlRow
      label="Pace"
      tip="Gait cycles each second. Every channel reads this one clock."
      unit="Hz"
      bind:value={$descriptor.gait.cyclesPerSecond}
      reset={1}
      field={[0, 100, 0.01]}
      slider={[0, 10, 0.01]}
    />
    <label class="row">
      <div class="head">
        <Tooltip
          label="Distance one full wave covers along the body. Shorter wavelengths pack in more curves."
          ><span>Wavelength</span></Tooltip
        >
        <div class="unit">
          <input
            type="number"
            min={5}
            max={5000}
            step={1}
            value={Math.round(lastWavelength)}
            disabled={travelDirection === "none"}
            onchange={commitWavelength}
          /><em>px</em>
        </div>
      </div>
      <input
        type="range"
        min={20}
        max={600}
        step={1}
        value={lastWavelength}
        disabled={travelDirection === "none"}
        oninput={(event) => applyWavelength(+event.target.value)}
        ondblclick={() => applyWavelength(DEFAULT_WAVELENGTH)}
      />
    </label>
  </div>
</details>

<details open={!advanced}>
  <summary>Bend</summary>
  <div class="rows">
    <ControlRow
      label="Amplitude"
      tip="Curve the wave puts in each joint, in radians at the trunk's resting spacing."
      bind:value={$descriptor.gait.bend.amplitude}
      reset={0}
      field={[0, 10, 0.01]}
      slider={[0, 2, 0.01]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        tip={HARMONIC_TIP}
        min={1}
        max={8}
        bind:value={$descriptor.gait.bend.harmonic}
      />
    {/if}
  </div>
</details>

<details open={!advanced}>
  <summary>Thrust</summary>
  <div class="rows">
    <ControlRow
      label="Acceleration"
      tip="Push along the body axis at the peak of each pulse."
      unit={["px", "/s²"]}
      digits={0}
      curve={thrustCurve}
      bind:value={$descriptor.gait.thrust.acceleration}
      reset={0}
      field={[0, 1000000, 1]}
      slider={[0, 1, 0.001]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        tip={HARMONIC_TIP}
        min={1}
        max={8}
        bind:value={$descriptor.gait.thrust.harmonic}
      />
      <ControlRow
        label="Phase"
        tip={PHASE_TIP}
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.gait.thrust.phaseOffset}
        reset={0}
        field={PHASE}
        slider={PHASE}
      />
      <ControlRow
        label="Duty cycle"
        tip={DUTY_TIP}
        bind:value={$descriptor.gait.thrust.dutyCycle}
        reset={0.5}
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
      tip="Fraction the wave shortens and lengthens the resting spacing between chunks."
      bind:value={$descriptor.gait.gather.amplitude}
      reset={0}
      field={[0, 0.95, 0.01]}
      slider={[0, 0.95, 0.01]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        tip={HARMONIC_TIP}
        min={1}
        max={8}
        bind:value={$descriptor.gait.gather.harmonic}
      />
      <ControlRow
        label="Phase"
        tip={PHASE_TIP}
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.gait.gather.phaseOffset}
        reset={0}
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
      label="Amplitude"
      tip="Grip the contact rhythm takes away at its peak. At 1 a chunk fully releases the ground there."
      bind:value={$descriptor.gait.contact.amplitude}
      reset={0}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    {#if advanced}
      <StepperRow
        label="Harmonic"
        tip={HARMONIC_TIP}
        min={1}
        max={8}
        bind:value={$descriptor.gait.contact.harmonic}
      />
      <ControlRow
        label="Phase"
        tip={PHASE_TIP}
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.gait.contact.phaseOffset}
        reset={0}
        field={PHASE}
        slider={PHASE}
      />
      <ControlRow
        label="Duty cycle"
        tip={DUTY_TIP}
        bind:value={$descriptor.gait.contact.dutyCycle}
        reset={0.5}
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
          <Tooltip
            label="Physics for every chunk in this section. Sections that name the same material behave alike."
            ><span>Material</span></Tooltip
          >
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
        tip="Number of chunks in this section. Head and trunk hold at least one; the tail may be empty."
        digits={0}
        bind:value={$descriptor.chain.sections[name].chunks}
        reset={SECTION_PRESET[name].chunks}
        field={[SECTION_MINIMUMS[name], 256, 1]}
        slider={[SECTION_MINIMUMS[name], 64, 1]}
      />
      <ControlRow
        label="Link distance"
        tip="Resting distance between two chunks of this section."
        unit="px"
        digits={1}
        bind:value={$descriptor.chain.sections[name].spacing}
        reset={SECTION_PRESET[name].spacing}
        field={[0.000001, 1000, 0.5]}
        slider={[1, 40, 0.5]}
      />
      {#if advanced}
        <hr class="rule" />
        {#each CHANNEL_NAMES as channel}
          <ControlRow
            label="{title(channel)} sensitivity"
            tip="Scales the {channel} channel in this section. 0 mutes it, 1 leaves it whole."
            bind:value={$descriptor.chain.sections[name].motionScale[channel]}
            reset={1}
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
        tip="Turn the head asks for per unit of heading error. Higher values steer harder."
        bind:value={$descriptor.chain.physics.steering.gain}
        reset={0.6}
        field={[0, 100, 0.05]}
        slider={[0, 5, 0.05]}
      />
      <ControlRow
        label="Limit"
        tip="Cap on the steering bend, however far off the heading is."
        unit="deg"
        digits={0}
        scale={DEG}
        bind:value={$descriptor.chain.physics.steering.limit}
        reset={0.5}
        field={[0, 180, 1]}
        slider={[0, 180, 1]}
      />
      <ControlRow
        label="Rate"
        tip="Speed the steering bend follows the wanted turn. Low values answer slowly."
        unit="/s"
        digits={1}
        bind:value={$descriptor.chain.physics.steering.rate}
        reset={6}
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
      tip="Picks up the chunks pushing the least, whatever the contact rhythm says. 0 holds every chunk down."
      bind:value={$descriptor.chain.physics.autoLift.amount}
      reset={0}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
    {#if advanced}
      <ControlRow
        label="Share"
        tip="Fraction of the chain that may lift at one time."
        digits={3}
        bind:value={$descriptor.chain.physics.autoLift.share}
        reset={0.3}
        field={[0, 1, 0.005]}
        slider={[0, 1, 0.005]}
      />
      <ControlRow
        label="Rate"
        tip="Speed lift builds on a chunk and fades again."
        unit="/s"
        digits={1}
        bind:value={$descriptor.chain.physics.autoLift.rate}
        reset={12}
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
      tip="Slow swell and shrink of the trunk links. At 1 their length changes by 10%."
      bind:value={$descriptor.chain.breathing}
      reset={0}
      field={[0, 1, 0.01]}
      slider={[0, 1, 0.01]}
    />
  </div>
</details>
