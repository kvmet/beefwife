<script>
  import { descriptor } from "./descriptor.js";

  export let channel;

  function step(delta) {
    const next = $descriptor.gait[channel].harmonic + delta;
    if (next >= 1 && next <= 8) $descriptor.gait[channel].harmonic = next;
  }
</script>

<div class="row">
  <div class="head">
    <span>Harmonic</span>
    <div class="stepper">
      <button type="button" aria-label="Lower harmonic" onclick={() => step(-1)}
        >−</button
      >
      <input
        type="number"
        min="1"
        max="8"
        step="1"
        aria-label="Harmonic"
        bind:value={$descriptor.gait[channel].harmonic}
      />
      <button type="button" aria-label="Raise harmonic" onclick={() => step(1)}
        >+</button
      >
    </div>
  </div>
</div>
