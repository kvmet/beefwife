<script>
  import ApplyNotices from "./ApplyNotices.svelte";
  import JsonPanel from "./JsonPanel.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { descriptor, namePattern } from "./descriptor.js";

  export let advanced = false;

  /* Committed on change rather than on input, so a half-typed name never
     reaches the runtime as a rejected document. */
  function renameOnCommit(event) {
    $descriptor.name = event.target.value;
  }
</script>

<ApplyNotices />

<details open>
  <summary>Identity</summary>
  <div class="fields single-column">
    <label>
      <Tooltip
        label="Used as the file name and as this beefwife's name in a cast. Up to 64 lowercase letters, digits, and hyphens; the first character must be a letter or digit."
        ><span>Name</span></Tooltip
      >
      <input
        value={$descriptor.name}
        pattern={namePattern()}
        maxlength="64"
        spellcheck="false"
        onchange={renameOnCommit}
      />
    </label>
    {#if advanced}
      <label>
        <Tooltip
          label="Descriptor version this document follows. The runtime reads only version 1."
          ><span>Schema</span></Tooltip
        >
        <input value={$descriptor.schemaVersion} readonly />
      </label>
    {/if}
  </div>
</details>

<details open>
  <summary>Document</summary>
  <JsonPanel />
</details>

<style>
  /* A rejected name is the one edit here the browser can catch on its own.
     The kit sets outline-color on every field, so this has to answer with the
     same longhand and outrank it; :not([readonly]) supplies the weight and
     keeps the schema field out. */
  input:not([readonly]):invalid {
    outline-width: 1px;
    outline-style: solid;
    outline-color: var(--danger);
  }

  input[readonly] {
    color: var(--muted);
  }
</style>
