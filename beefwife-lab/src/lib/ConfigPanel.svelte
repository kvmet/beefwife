<script>
  import JsonPanel from "./JsonPanel.svelte";
</script>

<details open>
  <summary>Identity</summary>
  <div class="fields single-column">
    <label><span>Name</span><input value="Rust walker" /></label>
    <label><span>Tags</span><input value="beefwife, ambient, warm" /></label>
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
        ><option>Auto</option><option>Left</option><option>Right</option
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
