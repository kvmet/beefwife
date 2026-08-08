<script>
  import Tooltip from "./Tooltip.svelte";

  /* One editable value: a name, a typed field, and a track. `field` and
     `slider` are each [min, max, step]. They differ because the field takes
     the schema's whole range while the track covers the useful part of it. */
  export let label;
  /* What the value does, read on the name rather than on the controls, so a
     drag never opens one. */
  export let tip;
  export let value;
  export let reset;
  export let field;
  export let slider;
  export let digits = 2;
  export let unit = null;
  /* Editing units per stored unit, for values the document keeps in radians
     and the panel shows in degrees. */
  export let scale = 1;
  /* Track position for a value and back, for a track that is not linear in
     the value. */
  export let curve = {
    in: (position) => position,
    out: (position) => position,
  };

  /* Committed on change rather than on input: the field rewrites itself to a
     fixed number of decimals, which would fight the digits being typed. */
  function commit(event) {
    const typed = +event.target.value;
    if (Number.isFinite(typed)) value = typed / scale;
    event.target.value = (value * scale).toFixed(digits);
  }

  $: shown = (value * scale).toFixed(digits);
  $: units = unit == null ? [] : [].concat(unit);
</script>

<label class="row">
  <div class="head">
    <Tooltip label={tip}><span>{label}</span></Tooltip>
    {#if units.length}
      <div class="unit">
        <input
          type="number"
          min={field[0]}
          max={field[1]}
          step={field[2]}
          value={shown}
          onchange={commit}
        /><em
          >{units[0]}{#if units[1]}<br />{units[1]}{/if}</em
        >
      </div>
    {:else}
      <input
        type="number"
        min={field[0]}
        max={field[1]}
        step={field[2]}
        value={shown}
        onchange={commit}
      />
    {/if}
  </div>
  <input
    type="range"
    min={slider[0]}
    max={slider[1]}
    step={slider[2]}
    value={curve.in(value * scale)}
    oninput={(event) => (value = curve.out(+event.target.value) / scale)}
    ondblclick={() => (value = reset)}
  />
</label>
