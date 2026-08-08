<script>
  import Tooltip from "./Tooltip.svelte";

  /* One integer value: a name and a typed field between nudge buttons. For
     settings counted in ones, where a track would waste travel. */
  export let label;
  /* What the value does, read on the name rather than on the controls. */
  export let tip;
  export let value;
  export let min;
  export let max;

  function step(delta) {
    const next = value + delta;
    if (next >= min && next <= max) value = next;
  }
</script>

<div class="row">
  <div class="head">
    <Tooltip label={tip}><span>{label}</span></Tooltip>
    <div class="stepper">
      <button
        type="button"
        aria-label={`Lower ${label.toLowerCase()}`}
        onclick={() => step(-1)}>−</button
      >
      <input type="number" {min} {max} step="1" aria-label={label} bind:value />
      <button
        type="button"
        aria-label={`Raise ${label.toLowerCase()}`}
        onclick={() => step(1)}>+</button
      >
    </div>
  </div>
</div>
