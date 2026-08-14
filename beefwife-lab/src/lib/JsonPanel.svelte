<script>
  import {
    applyError,
    copyText,
    descriptor,
    downloadDocument,
    openDocumentFile,
  } from "./descriptor.js";

  let draft = "";
  let editing = false;
  let parseError = null;
  let copyNotice = null;
  let picker;

  /* The editor writes plainly so a half-finished document still shows. */
  const shown = (value) => JSON.stringify(value, null, 2);

  $: if (!editing) {
    draft = shown($descriptor);
    // What was copied is no longer what the panel shows.
    copyNotice = null;
  }
  /* Malformed text never reaches the store, so the runtime's complaint is
     about the last document it did accept. */
  $: problem = parseError ?? $applyError;

  /* A failed parse keeps the panel in editing, so the text the user typed
     survives instead of being overwritten by the store's. */
  function load(text) {
    // Every set rebuilds the actor, so leaving the text alone must cost nothing.
    if (text === shown($descriptor)) {
      parseError = null;
      editing = false;
      return true;
    }
    try {
      descriptor.set(JSON.parse(text));
      parseError = null;
      editing = false;
      return true;
    } catch (error) {
      draft = text;
      editing = true;
      parseError = error.message;
      return false;
    }
  }

  function copy() {
    copyText(draft).then((notice) => (copyNotice = notice));
  }

  async function importJson(event) {
    const file = event.target.files[0];
    // Clear the picker so choosing the same file twice loads it twice.
    event.target.value = "";
    if (!file) return;
    try {
      await openDocumentFile(file);
      parseError = null;
      editing = false;
    } catch (error) {
      // The text the file carried, so the panel can be edited into shape.
      draft = await file.text();
      editing = true;
      parseError = error.message;
    }
  }
</script>

<div class="actions">
  <button onclick={() => picker.click()}>Import file</button>
  <button onclick={copy}>Copy</button>
  {#if copyNotice}<span class="notice">{copyNotice}</span>{/if}
  <button class="export-button" onclick={downloadDocument}>Export JSON</button>
  <input
    bind:this={picker}
    class="picker"
    type="file"
    accept="application/json,.json"
    onchange={importJson}
  />
</div>

<label>
  <span class="schema-row">
    <span>Schema {$descriptor.schemaVersion} · live document</span>
    {#if problem}
      <span class="valid-status invalid"><i></i>Invalid</span>
    {:else}
      <span class="valid-status"><i></i>Valid</span>
    {/if}
  </span>
  <textarea
    spellcheck="false"
    bind:value={draft}
    onfocus={() => (editing = true)}
    onblur={() => load(draft)}></textarea>
</label>
{#if problem}
  <p class="problem" role="alert">{problem}</p>
{/if}

<style>
  .actions {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--chassis-line);
  }
  .actions button {
    padding: 6px 8px;
    font-size: 11px;
  }

  /* The button opens it; the input itself never shows its own control. */
  .picker {
    display: none;
  }

  .notice {
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .valid-status {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--select);
    font-size: 10px;
    text-transform: none;
    letter-spacing: normal;
  }
  .valid-status i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--select);
  }
  .valid-status.invalid {
    color: var(--danger);
  }
  .valid-status.invalid i {
    background: var(--danger);
  }

  .export-button {
    margin-left: auto;
    background: var(--select-dim);
    color: var(--select-text);
  }

  .schema-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  label {
    display: block;
    min-width: 0;
    padding: 14px;
  }
  label > span {
    display: block;
    margin-bottom: 6px;
    color: var(--muted);
    font: var(--label-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  textarea {
    width: 100%;
    min-height: 310px;
    resize: vertical;
    outline-color: var(--bevel-face-screen);
    font:
      11px/1.6 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    tab-size: 2;
  }

  .problem {
    margin: 0;
    padding: 0 14px 20px;
    color: var(--danger);
    font-size: 11px;
  }
</style>
