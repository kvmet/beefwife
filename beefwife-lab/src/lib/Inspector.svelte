<script>
  import AssetsPanel from "./AssetsPanel.svelte";
  import ChainMap from "./ChainMap.svelte";
  import JsonPanel from "./JsonPanel.svelte";
  import WaveColumn from "./WaveColumn.svelte";
  import { applyError, defaults, descriptor } from "./descriptor.js";

  export let selected;
  export let activeTab;
  export let ontab;
  export let onhide;

  const tabs = ["Config", "Motion", "Look", "Parts"];
  const TAU = Math.PI * 2;
  const DEG = 180 / Math.PI;
  const SECTION_NAMES = ["head", "trunk", "tail"];
  const CHANNEL_NAMES = ["bend", "thrust", "gather", "contact"];

  /* At time zero a channel runs sin(offset - harmonic·lag·d) down the chain,
     so its on-screen cycle count comes from the lag, not the clock.
     TODO: mirrors BeefwifeGait._phaseAt; sample via the beefwife API once it
     exports the gait channels, instead of keeping this math in step by hand. */
  const waveOf = (gait, channel, length, variant, amp, duty) => ({
    variant,
    amp,
    cycles: (-channel.harmonic * gait.phaseLagRadiansPerPixel * length) / TAU,
    phase: channel.phaseOffset,
    duty,
  });

  const stepHarmonic = (channel, delta) => {
    const next = $descriptor.gait[channel].harmonic + delta;
    if (next >= 1 && next <= 8) $descriptor.gait[channel].harmonic = next;
  };

  $: gait = $descriptor.gait;
  $: chainLength = SECTION_NAMES.reduce((sum, name) => {
    const section = $descriptor.chain.sections[name];
    return sum + section.chunks * section.spacing;
  }, 0);
  /* Bend plots saturated past 1 (the schema allows 10); thrust has no bounded
     unit, so its trace shows timing at full width and the field shows size. */
  $: bodyWaves = [
    waveOf(gait, gait.bend, chainLength, "primary", Math.min(1, gait.bend.amplitude)),
    waveOf(gait, gait.thrust, chainLength, "weave", 1, gait.thrust.dutyCycle),
    waveOf(gait, gait.gather, chainLength, "gather", gait.gather.amplitude),
  ];
  $: liftWaves = [
    waveOf(gait, gait.contact, chainLength, "primary", gait.contact.lift, gait.contact.dutyCycle),
  ];
  const labels = {
    eyes: ["Ornament", "Eyes"],
    feelers: ["Ornament", "Feelers"],
    dorsal: ["Ornament", "Dorsal ridge"],
    spots: ["Ornament", "Spots"],
    "tail-fin": ["Ornament", "Tail fin"],
    "head-plate": ["Plate", "Head shell"],
  };
  $: item = labels[selected] ?? ["Plate", "Trunk plate"];
</script>

<aside class="inspector" aria-label="Beefwife tools">
  <div class="chain-rail">
    <button
      class="hide-panel"
      aria-label="Hide panel"
      title="Hide panel"
      onclick={onhide}>−</button
    >
    <ChainMap />
  </div>

  <div class="inspector-main">
    <div class="panel-nav">
      <nav role="tablist" aria-label="Editor modes">
        {#each tabs as tab}
          <button
            role="tab"
            aria-selected={activeTab === tab}
            onclick={() => ontab(tab)}
          >
            {tab}
          </button>
        {/each}
      </nav>
    </div>

    <div class="inspector-body">
      {#if activeTab === "Motion"}
        <WaveColumn title="Body waves" waves={bodyWaves} />
        <WaveColumn title="Lift" waves={liftWaves} />
      {:else if activeTab === "Look"}
        <div class="selector-column">
          <header>Plates</header>
          <div class="selector-screen"></div>
        </div>
        <div class="selector-column">
          <header>Ornaments</header>
          <div class="selector-screen"></div>
        </div>
      {/if}

      <div class="inspector-scroll" role="tabpanel" aria-label={activeTab}>
        <div class="slim-heading"></div>
        {#if activeTab === "Look"}
          <div class="selection-path">
            <span>Head</span><b>/</b><span>Upper surface</span><b>/</b><strong
              >{item[1]}</strong
            >
          </div>

          <details open>
            <summary>Placement</summary>
            <div class="fields">
              <label class="wide">
                <span>Anchor scope</span>
                <select
                  ><option>Section</option><option>Whole chain</option></select
                >
              </label>
              <label>
                <span>Section</span>
                <select
                  ><option>Head</option><option>Trunk</option><option
                    >Tail</option
                  ></select
                >
              </label>
              <label>
                <span>From</span>
                <select
                  ><option>Start</option><option>Center</option><option
                    >End</option
                  ></select
                >
              </label>
              <label>
                <span>Position</span>
                <div class="unit"><input value="1.00" /><em>u</em></div>
              </label>
              <label>
                <span>Normal offset</span>
                <div class="unit"><input value="0.16" /><em>u</em></div>
              </label>
            </div>
          </details>

          <details open>
            <summary>Appearance</summary>
            <div class="fields">
              <label>
                <span>Shape</span>
                <select
                  ><option>Round eye</option><option>Spike</option><option
                    >Fin</option
                  ></select
                >
              </label>
              <label>
                <span>Material</span>
                <select
                  ><option>Warm glow</option><option>Shell</option><option
                    >Ink</option
                  ></select
                >
              </label>
              <label>
                <span>Layer</span>
                <select><option>Over</option><option>Under</option></select>
              </label>
              <label>
                <span>Side</span>
                <select
                  ><option>Both</option><option>Left</option><option
                    >Right</option
                  ></select
                >
              </label>
              <label>
                <span>Scale</span>
                <input type="range" min="0" max="100" value="54" />
              </label>
              <label>
                <span>Rotation</span>
                <div class="unit"><input value="4" /><em>deg</em></div>
              </label>
            </div>
          </details>

          <details><summary>Visibility &amp; effects</summary></details>
        {:else if activeTab === "Config"}
          <details open>
            <summary>Identity</summary>
            <div class="fields single-column">
              <label><span>Name</span><input value="Rust walker" /></label>
              <label
                ><span>Tags</span><input
                  value="beefwife, ambient, warm"
                /></label
              >
            </div>
          </details>
          <details open>
            <summary>Body defaults</summary>
            <div class="fields">
              <label
                ><span>Scale</span>
                <div class="unit"><input value="1.00" /><em>x</em></div></label
              >
              <label
                ><span>Facing</span><select
                  ><option>Auto</option><option>Left</option><option
                    >Right</option
                  ></select
                ></label
              >
              <label class="wide"
                ><span>Base material</span><select
                  ><option>Rust shell</option><option>Ink shell</option></select
                ></label
              >
            </div>
          </details>
          <details><summary>Visual effects</summary></details>
          <details open>
            <summary>Canonical JSON</summary>
            <JsonPanel />
          </details>
        {:else if activeTab === "Motion"}
          {#if $applyError}
            <p class="apply-error" role="alert">{$applyError}</p>
          {/if}

          <!-- Sliders sweep the useful range; the textbox takes the schema's
               full range, so a typed value can sit past the slider's end. -->
          <details open>
            <summary>Gait clock</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Pace</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      bind:value={$descriptor.gait.cyclesPerSecond}
                    /><em>Hz</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.01"
                  bind:value={$descriptor.gait.cyclesPerSecond}
                  ondblclick={() =>
                    ($descriptor.gait.cyclesPerSecond =
                      defaults.gait.cyclesPerSecond)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Wave travel</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="-3.14"
                      max="3.14"
                      step="0.005"
                      bind:value={$descriptor.gait.phaseLagRadiansPerPixel}
                    /><em>rad/px</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="-0.3"
                  max="0.3"
                  step="0.001"
                  bind:value={$descriptor.gait.phaseLagRadiansPerPixel}
                  ondblclick={() =>
                    ($descriptor.gait.phaseLagRadiansPerPixel =
                      defaults.gait.phaseLagRadiansPerPixel)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Bend</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Amplitude</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    bind:value={$descriptor.gait.bend.amplitude}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  bind:value={$descriptor.gait.bend.amplitude}
                  ondblclick={() =>
                    ($descriptor.gait.bend.amplitude =
                      defaults.gait.bend.amplitude)}
                />
              </label>
              <div class="row">
                <div class="head">
                  <span>Harmonic</span>
                  <div class="stepper">
                    <button
                      type="button"
                      aria-label="Lower harmonic"
                      onclick={() => stepHarmonic("bend", -1)}>−</button
                    >
                    <input
                      type="number"
                      min="1"
                      max="8"
                      step="1"
                      aria-label="Harmonic"
                      bind:value={$descriptor.gait.bend.harmonic}
                    />
                    <button
                      type="button"
                      aria-label="Raise harmonic"
                      onclick={() => stepHarmonic("bend", 1)}>+</button
                    >
                  </div>
                </div>
              </div>
              <label class="row">
                <div class="head">
                  <span>Phase</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="1"
                      value={Math.round($descriptor.gait.bend.phaseOffset * DEG)}
                      onchange={(event) =>
                        ($descriptor.gait.bend.phaseOffset =
                          +event.target.value / DEG)}
                    /><em>deg</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={$descriptor.gait.bend.phaseOffset * DEG}
                  oninput={(event) =>
                    ($descriptor.gait.bend.phaseOffset =
                      +event.target.value / DEG)}
                  ondblclick={() =>
                    ($descriptor.gait.bend.phaseOffset =
                      defaults.gait.bend.phaseOffset)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Thrust</summary>
            <div class="rows">
              <!-- No slider: linear 0..1e6 is unusable; wants a log taper. -->
              <label class="row">
                <div class="head">
                  <span>Acceleration</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      step="1"
                      bind:value={$descriptor.gait.thrust.acceleration}
                    /><em>px/s²</em>
                  </div>
                </div>
              </label>
              <div class="row">
                <div class="head">
                  <span>Harmonic</span>
                  <div class="stepper">
                    <button
                      type="button"
                      aria-label="Lower harmonic"
                      onclick={() => stepHarmonic("thrust", -1)}>−</button
                    >
                    <input
                      type="number"
                      min="1"
                      max="8"
                      step="1"
                      aria-label="Harmonic"
                      bind:value={$descriptor.gait.thrust.harmonic}
                    />
                    <button
                      type="button"
                      aria-label="Raise harmonic"
                      onclick={() => stepHarmonic("thrust", 1)}>+</button
                    >
                  </div>
                </div>
              </div>
              <label class="row">
                <div class="head">
                  <span>Phase</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="1"
                      value={Math.round(
                        $descriptor.gait.thrust.phaseOffset * DEG,
                      )}
                      onchange={(event) =>
                        ($descriptor.gait.thrust.phaseOffset =
                          +event.target.value / DEG)}
                    /><em>deg</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={$descriptor.gait.thrust.phaseOffset * DEG}
                  oninput={(event) =>
                    ($descriptor.gait.thrust.phaseOffset =
                      +event.target.value / DEG)}
                  ondblclick={() =>
                    ($descriptor.gait.thrust.phaseOffset =
                      defaults.gait.thrust.phaseOffset)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Duty cycle</span>
                  <input
                    type="number"
                    min="0.01"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.gait.thrust.dutyCycle}
                  />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.gait.thrust.dutyCycle}
                  ondblclick={() =>
                    ($descriptor.gait.thrust.dutyCycle =
                      defaults.gait.thrust.dutyCycle)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Gather</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Amplitude</span>
                  <input
                    type="number"
                    min="0"
                    max="0.95"
                    step="0.01"
                    bind:value={$descriptor.gait.gather.amplitude}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.01"
                  bind:value={$descriptor.gait.gather.amplitude}
                  ondblclick={() =>
                    ($descriptor.gait.gather.amplitude =
                      defaults.gait.gather.amplitude)}
                />
              </label>
              <div class="row">
                <div class="head">
                  <span>Harmonic</span>
                  <div class="stepper">
                    <button
                      type="button"
                      aria-label="Lower harmonic"
                      onclick={() => stepHarmonic("gather", -1)}>−</button
                    >
                    <input
                      type="number"
                      min="1"
                      max="8"
                      step="1"
                      aria-label="Harmonic"
                      bind:value={$descriptor.gait.gather.harmonic}
                    />
                    <button
                      type="button"
                      aria-label="Raise harmonic"
                      onclick={() => stepHarmonic("gather", 1)}>+</button
                    >
                  </div>
                </div>
              </div>
              <label class="row">
                <div class="head">
                  <span>Phase</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="1"
                      value={Math.round(
                        $descriptor.gait.gather.phaseOffset * DEG,
                      )}
                      onchange={(event) =>
                        ($descriptor.gait.gather.phaseOffset =
                          +event.target.value / DEG)}
                    /><em>deg</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={$descriptor.gait.gather.phaseOffset * DEG}
                  oninput={(event) =>
                    ($descriptor.gait.gather.phaseOffset =
                      +event.target.value / DEG)}
                  ondblclick={() =>
                    ($descriptor.gait.gather.phaseOffset =
                      defaults.gait.gather.phaseOffset)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Contact</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Lift</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.gait.contact.lift}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.gait.contact.lift}
                  ondblclick={() =>
                    ($descriptor.gait.contact.lift =
                      defaults.gait.contact.lift)}
                />
              </label>
              <div class="row">
                <div class="head">
                  <span>Harmonic</span>
                  <div class="stepper">
                    <button
                      type="button"
                      aria-label="Lower harmonic"
                      onclick={() => stepHarmonic("contact", -1)}>−</button
                    >
                    <input
                      type="number"
                      min="1"
                      max="8"
                      step="1"
                      aria-label="Harmonic"
                      bind:value={$descriptor.gait.contact.harmonic}
                    />
                    <button
                      type="button"
                      aria-label="Raise harmonic"
                      onclick={() => stepHarmonic("contact", 1)}>+</button
                    >
                  </div>
                </div>
              </div>
              <label class="row">
                <div class="head">
                  <span>Phase</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="1"
                      value={Math.round(
                        $descriptor.gait.contact.phaseOffset * DEG,
                      )}
                      onchange={(event) =>
                        ($descriptor.gait.contact.phaseOffset =
                          +event.target.value / DEG)}
                    /><em>deg</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={$descriptor.gait.contact.phaseOffset * DEG}
                  oninput={(event) =>
                    ($descriptor.gait.contact.phaseOffset =
                      +event.target.value / DEG)}
                  ondblclick={() =>
                    ($descriptor.gait.contact.phaseOffset =
                      defaults.gait.contact.phaseOffset)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Duty cycle</span>
                  <input
                    type="number"
                    min="0.01"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.gait.contact.dutyCycle}
                  />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.gait.contact.dutyCycle}
                  ondblclick={() =>
                    ($descriptor.gait.contact.dutyCycle =
                      defaults.gait.contact.dutyCycle)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Section response</summary>
            <div class="matrix">
              <i></i>
              {#each CHANNEL_NAMES as channel}
                <span>{channel}</span>
              {/each}
              {#each SECTION_NAMES as name}
                <span>{name}</span>
                {#each CHANNEL_NAMES as channel}
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.05"
                    aria-label={`${name} ${channel} scale`}
                    bind:value={
                      $descriptor.chain.sections[name].motionScale[channel]
                    }
                  />
                {/each}
              {/each}
            </div>
          </details>

          <details open>
            <summary>Steering</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Gain</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.05"
                    bind:value={$descriptor.chain.physics.steering.gain}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.05"
                  bind:value={$descriptor.chain.physics.steering.gain}
                  ondblclick={() =>
                    ($descriptor.chain.physics.steering.gain =
                      defaults.chain.physics.steering.gain)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Limit</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="0"
                      max="180"
                      step="1"
                      value={Math.round(
                        $descriptor.chain.physics.steering.limit * DEG,
                      )}
                      onchange={(event) =>
                        ($descriptor.chain.physics.steering.limit =
                          +event.target.value / DEG)}
                    /><em>deg</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="1"
                  value={$descriptor.chain.physics.steering.limit * DEG}
                  oninput={(event) =>
                    ($descriptor.chain.physics.steering.limit =
                      +event.target.value / DEG)}
                  ondblclick={() =>
                    ($descriptor.chain.physics.steering.limit =
                      defaults.chain.physics.steering.limit)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Rate</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.5"
                      bind:value={$descriptor.chain.physics.steering.rate}
                    /><em>/s</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  bind:value={$descriptor.chain.physics.steering.rate}
                  ondblclick={() =>
                    ($descriptor.chain.physics.steering.rate =
                      defaults.chain.physics.steering.rate)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Ground lift</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.chain.physics.autoLift.amount}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.chain.physics.autoLift.amount}
                  ondblclick={() =>
                    ($descriptor.chain.physics.autoLift.amount =
                      defaults.chain.physics.autoLift.amount)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Share</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.005"
                    bind:value={$descriptor.chain.physics.autoLift.share}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.005"
                  bind:value={$descriptor.chain.physics.autoLift.share}
                  ondblclick={() =>
                    ($descriptor.chain.physics.autoLift.share =
                      defaults.chain.physics.autoLift.share)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Rate</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.5"
                      bind:value={$descriptor.chain.physics.autoLift.rate}
                    /><em>/s</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  bind:value={$descriptor.chain.physics.autoLift.rate}
                  ondblclick={() =>
                    ($descriptor.chain.physics.autoLift.rate =
                      defaults.chain.physics.autoLift.rate)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Idle behavior</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Breathing</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.chain.breathing}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.chain.breathing}
                  ondblclick={() =>
                    ($descriptor.chain.breathing = defaults.chain.breathing)}
                />
              </label>
            </div>
          </details>

          <details open>
            <summary>Leg cycle</summary>
            <div class="rows">
              <label class="row">
                <div class="head">
                  <span>Side phase</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.legs.sidePhase}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.legs.sidePhase}
                  ondblclick={() =>
                    ($descriptor.legs.sidePhase = defaults.legs.sidePhase)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Lead</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.legs.lead}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.legs.lead}
                  ondblclick={() => ($descriptor.legs.lead = defaults.legs.lead)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Lift threshold</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.legs.liftThreshold}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.legs.liftThreshold}
                  ondblclick={() =>
                    ($descriptor.legs.liftThreshold =
                      defaults.legs.liftThreshold)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Swing time</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="0.001"
                      max="60"
                      step="0.01"
                      bind:value={$descriptor.legs.swingSeconds}
                    /><em>s</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="1"
                  step="0.005"
                  bind:value={$descriptor.legs.swingSeconds}
                  ondblclick={() =>
                    ($descriptor.legs.swingSeconds = defaults.legs.swingSeconds)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Swing arc</span>
                  <div class="unit">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.5"
                      bind:value={$descriptor.legs.swingArc}
                    /><em>px</em>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="0.5"
                  bind:value={$descriptor.legs.swingArc}
                  ondblclick={() =>
                    ($descriptor.legs.swingArc = defaults.legs.swingArc)}
                />
              </label>
              <label class="row">
                <div class="head">
                  <span>Jitter</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    bind:value={$descriptor.legs.jitter}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={$descriptor.legs.jitter}
                  ondblclick={() =>
                    ($descriptor.legs.jitter = defaults.legs.jitter)}
                />
              </label>
            </div>
          </details>
        {:else if activeTab === "Parts"}
          <AssetsPanel />
        {/if}
      </div>
    </div>
  </div>
</aside>

<style>
  /* The bevel belongs to the panel, so it runs the full height of its left
     edge beside the chain map. The lines live in the padding, where no child
     background can cover them. */
  .inspector {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding-left: 3px;
    overflow: hidden;
    background: var(--bg);
    box-shadow:
      inset 2px 0 0 var(--chassis-line-high),
      inset 3px 0 0 var(--bevel-light);
  }

  /* minmax(0, 1fr) pins the implicit column to the panel's width; an auto
     column would grow to the tab row's max-content and push the right-aligned
     tabs off-screen when the panel is narrow. */
  .inspector-main {
    display: grid;
    min-width: 0;
    min-height: 0;
    flex: 1;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .chain-rail {
    display: flex;
    width: 66px;
    min-height: 0;
    flex: none;
    flex-direction: column;
    background: var(--bg);
  }

  /* 26px face at 10px from the top matches the topbar buttons, and the 16px
     left margin mirrors the topbar's right padding across the divider; the
     margins total 46px so the rail hands off to the chain map at the same y
     as the tabs do to the body. */
  .hide-panel {
    display: grid;
    height: 26px;
    flex: none;
    margin: 10px auto 10px 16px;
    padding: 0 9px;
    place-items: center;
    font-size: 12px;
    line-height: 1;
  }

  .hide-panel:hover {
    background: var(--select-dim);
    color: var(--select-text);
  }

  /* Above .inspector-scroll so the selected tab paints over the panel's top
     edge; the overhang is why this strip cannot clip. */
  /* 46px puts the body's top edge level with the stage's top under the
     46px topbar; the padding grows instead of the tabs. */
  .panel-nav {
    position: relative;
    z-index: 2;
    display: flex;
    min-width: 0;
    height: 46px;
    padding: 8px 5px 0;
    background: var(--bg);
  }

  .panel-nav nav {
    min-width: 0;
    flex: 1;
    justify-content: flex-end;
  }

  /* min-width: 0 is what lets a flex item shrink past its label; without it the
     strip clips the last tab instead. */
  .panel-nav nav button {
    position: relative;
    min-width: 0;
    padding: 0 7px;
    overflow: hidden;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* The top edge the tabs sit on. A border rather than an inset shadow, so the
     sticky .panel-heading scrolls under it instead of covering it. */
  .inspector-body {
    position: relative;
    z-index: 1;
    display: flex;
    min-height: 0;
    border-top: 2px solid var(--edge-light);
    background: var(--chassis);
  }

  .inspector-scroll {
    min-width: 0;
    min-height: 0;
    flex: 1;
    background: var(--chassis);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .selector-column {
    display: grid;
    width: 72px;
    min-height: 0;
    flex: none;
    border-right: 1px solid var(--chassis-line);
    grid-template-rows: 22px minmax(0, 1fr);
  }

  .selector-column header {
    overflow: hidden;
    padding: 5px 6px 0;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
    color: var(--muted);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .selector-screen {
    background: var(--screen);
  }

  label > span {
    display: block;
    color: var(--muted);
    font: var(--label-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .selection-path {
    display: flex;
    gap: 7px;
    padding: 8px 16px;
    overflow: hidden;
    border-bottom: 1px solid var(--chassis-line);
    color: var(--muted);
    font-size: 10px;
    white-space: nowrap;
  }

  .selection-path b {
    color: var(--faint);
  }
  .selection-path strong {
    overflow: hidden;
    color: var(--select);
    text-overflow: ellipsis;
  }

  details {
    margin: 4px 10px;
  }

  /* Section headings are silkscreen on the chassis, not controls; the only
     control face is the small latch, which presses in while open. */
  summary {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 2px;
    border: 0;
    outline: none;
    background: none;
    color: var(--text);
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  summary:hover,
  details[open] > summary {
    border: 0;
    outline: none;
    background: none;
    color: var(--text);
  }

  summary::before {
    display: grid;
    width: 14px;
    height: 14px;
    flex: none;
    place-items: center;
    outline: 2px outset var(--bevel-face);
    background: var(--chassis);
    color: var(--muted);
    content: "+";
    font-size: 10px;
    line-height: 1;
  }

  details[open] summary::before {
    outline-style: inset;
    background: var(--select-dim);
    color: var(--select-text);
    content: "−";
  }

  /* Engraved rule: dark line over light, running to the section's edge. */
  summary::after {
    flex: 1;
    height: 2px;
    background: linear-gradient(
      var(--chassis-line-high) 1px,
      var(--bevel-light) 1px
    );
    content: "";
  }

  /* 23px lines the fields up under the heading text, past the 14px latch
     and its 9px gap. */
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px 10px;
    padding: 6px 2px 15px 23px;
  }

  .fields.single-column {
    grid-template-columns: 1fr;
  }

  /* Same 22px rule the wave column headers draw, so the strips read as one
     band across the panel. */
  .slim-heading {
    position: sticky;
    z-index: 4;
    top: 0;
    height: 22px;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
  }

  .apply-error {
    margin: 0;
    padding: 8px 16px;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--danger-dim);
    color: var(--danger);
    font-size: 10px;
  }

  /* Row labels get the leftover width; four equal value columns line up with
     the wave plots' idea of one column per channel. */
  .matrix {
    display: grid;
    align-items: center;
    grid-template-columns: minmax(38px, auto) repeat(4, 1fr);
    gap: 8px 5px;
    padding: 6px 2px 15px 23px;
  }

  .matrix span {
    overflow: hidden;
    color: var(--muted);
    font: var(--label-font);
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    text-transform: uppercase;
  }

  .matrix input {
    padding: 0 4px;
    text-align: right;
  }
  label {
    min-width: 0;
  }
  label.wide {
    grid-column: 1 / -1;
  }
  label > span {
    margin-bottom: 6px;
  }

  select,
  input:not([type="range"]) {
    width: 100%;
    height: 34px;
    padding: 0 8px;
    outline-color: var(--bevel-face-screen);
  }

  input[type="number"] {
    appearance: textfield;
  }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
    -webkit-appearance: none;
  }

  /* Same bevel language as the fields: a recessed groove with a raised,
     pressable thumb. */
  input[type="range"] {
    width: 100%;
    height: 18px;
    margin: 0;
    outline: none;
    background: transparent;
    appearance: none;
    cursor: ew-resize;
    -webkit-appearance: none;
  }
  input[type="range"]::-webkit-slider-runnable-track {
    height: 6px;
    outline: 2px inset var(--bevel-face-screen);
    background: var(--screen);
  }
  input[type="range"]::-webkit-slider-thumb {
    width: 14px;
    height: 16px;
    margin-top: -5px;
    outline: 2px outset var(--bevel-face);
    background: var(--chassis);
    appearance: none;
    -webkit-appearance: none;
  }
  input[type="range"]:hover::-webkit-slider-thumb {
    background: var(--select-dim);
  }
  input[type="range"]::-moz-range-track {
    height: 6px;
    outline: 2px inset var(--bevel-face-screen);
    background: var(--screen);
  }
  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 16px;
    border: none;
    border-radius: 0;
    outline: 2px outset var(--bevel-face);
    background: var(--chassis);
  }

  .rows {
    display: grid;
    gap: 12px;
    padding: 6px 2px 15px 23px;
  }

  .row {
    display: grid;
    min-width: 0;
    gap: 5px;
  }

  .row .head {
    display: grid;
    align-items: center;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) 104px;
  }

  .row .head > span {
    overflow: hidden;
    color: var(--muted);
    font: 11px/1.2 var(--font-mono);
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .row input[type="number"] {
    text-align: right;
  }

  .stepper {
    display: grid;
    gap: calc(var(--bevel-width) * 2);
    grid-template-columns: 26px minmax(0, 1fr) 26px;
  }

  .stepper button {
    height: 34px;
    padding: 0;
    font-size: 12px;
    line-height: 1;
  }
  /* The unit sits in a ruled gutter of its own so digits always end at the
     same x, which is what makes a column of values scannable. */
  .unit {
    position: relative;
  }

  .unit input {
    padding-right: 38px;
    text-align: right;
  }

  .unit em {
    position: absolute;
    top: 1px;
    right: 1px;
    bottom: 1px;
    display: grid;
    width: 30px;
    place-items: center;
    border-left: 1px solid var(--chassis-line-high);
    color: var(--screen-muted);
    font-size: 9px;
    font-style: normal;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
