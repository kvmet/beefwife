<script>
  const jsonPreview = `{
  "schema": 1,
  "name": "Rust walker",
  "body": {
    "sections": ["head", "trunk", "tail"]
  },
  "placements": [
    { "asset": "eyes", "section": "head", "position": 1 }
  ]
}`;
</script>

<div class="actions">
  <button>Import file</button>
  <button>Copy</button>
  <button class="export-button">Export JSON</button>
</div>

<label>
  <span class="schema-row">
    <span>Schema 1 · generated preview</span>
    <span class="valid-status"><i></i>Valid</span>
  </span>
  <textarea readonly spellcheck="false" value={jsonPreview}></textarea>
</label>
<p>Editing will be enabled after the descriptor binding is connected.</p>

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

  p {
    margin: 0;
    padding: 0 14px 20px;
    color: var(--faint);
    font-size: 10px;
  }
</style>
