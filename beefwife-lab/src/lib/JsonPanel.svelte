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

<header>
  <div>
    <span>Descriptor</span>
    <h2>Canonical JSON</h2>
  </div>
  <span class="valid-status"><i></i>Valid</span>
</header>

<div class="actions">
  <button>Import file</button>
  <button>Copy</button>
  <button class="export-button">Export JSON</button>
</div>

<label>
  <span>Schema 1 · generated preview</span>
  <textarea readonly spellcheck="false" value={jsonPreview}></textarea>
</label>
<p>Editing will be enabled after the descriptor binding is connected.</p>

<style>
  header {
    position: sticky;
    z-index: 4;
    top: 0;
    display: flex;
    min-height: 64px;
    align-items: center;
    justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--chassis);
  }

  header span,
  label > span {
    display: block;
    color: var(--muted);
    font: var(--label-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h2 {
    margin: 3px 0 0;
    font-size: 16px;
    font-weight: 600;
  }
  .valid-status {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--select);
    font-size: 10px;
  }
  .valid-status i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--select);
  }
  .actions {
    display: flex;
    gap: 5px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--chassis-line);
  }
  .actions button {
    padding: 6px 8px;
    border: 1px solid var(--chassis-line-high);
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 10px;
  }

  .actions .export-button {
    margin-left: auto;
    border-color: var(--select-line);
    background: var(--select-dim);
    color: var(--select-text);
  }
  label {
    display: block;
    min-width: 0;
    padding: 14px;
  }
  label > span {
    margin-bottom: 6px;
  }
  textarea {
    width: 100%;
    min-height: 310px;
    resize: vertical;
    border: 1px solid var(--chassis-line);
    border-radius: var(--radius-screen);
    outline: 0;
    background: var(--screen);
    color: var(--screen-text);
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
