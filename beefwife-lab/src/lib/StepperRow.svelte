<script>
  /* One integer value: a name and a typed field between nudge buttons. For
     settings counted in ones, where a track would waste travel. */
  export let label;
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
    <span>{label}</span>
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
