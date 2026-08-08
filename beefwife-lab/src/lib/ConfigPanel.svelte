<script>
  import JsonPanel from "./JsonPanel.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { applyError, descriptor } from "./descriptor.js";

  /* The hyphen must be escaped: `pattern` compiles in unicodeSets mode, where
     a bare one is an invalid character class, and a pattern that fails to
     compile is ignored rather than reported.
     TODO: mirrors BeefwifeDescriptor's NAME_PATTERN; read it from the library
     once the canvas bundle exports the descriptor API. */
  const NAME_PATTERN = "[a-z0-9][a-z0-9\\-]{0,63}";

  /* Committed on change rather than on input, so a half-typed name never
     reaches the runtime as a rejected document. */
  function renameOnCommit(event) {
    $descriptor.name = event.target.value;
  }
</script>

{#if $applyError}
  <p class="apply-error" role="alert">{$applyError}</p>
{/if}

<details open>
  <summary>Identity</summary>
  <div class="fields single-column">
    <label>
      <Tooltip
        label="Portable identity and file name stem. Lowercase letters, digits, and hyphens, up to 64."
        ><span>Name</span></Tooltip
      >
      <input
        value={$descriptor.name}
        pattern={NAME_PATTERN}
        maxlength="64"
        spellcheck="false"
        onchange={renameOnCommit}
      />
    </label>
    <label>
      <Tooltip
        label="Descriptor version this document follows. The runtime reads version 1 alone."
        ><span>Schema</span></Tooltip
      >
      <input value={$descriptor.schemaVersion} readonly />
    </label>
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
