<script>
  import { applyError, applyWarnings } from "./descriptor.js";
</script>

{#if $applyError}
  <p class="apply-error" role="alert">{$applyError}</p>
{/if}
{#each $applyWarnings as warning}
  <p class="apply-warning">
    {warning.path}: {warning.rule}. {warning.repaired}
  </p>
{/each}
