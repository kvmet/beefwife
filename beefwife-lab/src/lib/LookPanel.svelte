<script>
  export let selected;

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
      <select><option>Section</option><option>Whole chain</option></select>
    </label>
    <label>
      <span>Section</span>
      <select
        ><option>Head</option><option>Trunk</option><option>Tail</option
        ></select
      >
    </label>
    <label>
      <span>From</span>
      <select
        ><option>Start</option><option>Center</option><option>End</option
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
        ><option>Round eye</option><option>Spike</option><option>Fin</option
        ></select
      >
    </label>
    <label>
      <span>Material</span>
      <select
        ><option>Warm glow</option><option>Shell</option><option>Ink</option
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
        ><option>Both</option><option>Left</option><option>Right</option
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

<style>
  .selection-path {
    display: flex;
    gap: 7px;
    padding: 8px 16px;
    overflow: hidden;
    border-bottom: 1px solid var(--chassis-line);
    color: var(--muted);
    font-size: 11px;
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
</style>
