<script>
  export let counts;

  $: total = counts.reduce((sum, count) => sum + count, 0);

  function setTotal(event) {
    const requested = Number(event.currentTarget.value);
    if (!Number.isFinite(requested)) return;
    const target = Math.min(Math.max(Math.round(requested), 3), 256);
    const next = [...counts];
    let change = target - total;

    if (change >= 0) {
      next[1] += change;
    } else {
      change = -change;
      const trunkChange = Math.min(change, next[1] - 1);
      next[1] -= trunkChange;
      change -= trunkChange;
      const tailChange = Math.min(change, next[2]);
      next[2] -= tailChange;
      change -= tailChange;
      next[0] -= Math.min(change, next[0] - 1);
    }

    counts = next;
    event.currentTarget.value = target;
  }
</script>

<header>
  <span class="panel-name">Chain map</span>
  <dl class="tally">
    {#each [["Sections", 3], ["Plates", 11], ["Ornaments", 5], ["Limbs", 6]] as [name, count]}
      <div>
        <dt>{name}</dt>
        <dd>{count}</dd>
      </div>
    {/each}
  </dl>
  <label>
    <span>Total chunks</span>
    <input
      type="number"
      min="3"
      max="256"
      step="1"
      value={total}
      onchange={setTotal}
    />
    <em>/ 256</em>
  </label>
  <nav aria-label="Chain map tools">
    <button class="active">Select</button>
    <button>Add plate</button>
    <button>Add ornament</button>
    <i></i>
    <button>Fit chain</button>
  </nav>
</header>

<style>
  header {
    display: flex;
    height: 52px;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--chassis-line-high);
    background: var(--chassis-deep);
    box-shadow: inset 0 1px 0 var(--bevel-light);
  }
  .panel-name {
    padding: 6px 10px;
    border: 1px solid var(--chassis-line);
    background: var(--label-paper);
    box-shadow: inset 0 1px 1px var(--bevel-shadow);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .tally {
    display: flex;
    margin: 0 0 0 18px;
    border: 1px solid var(--chassis-line-high);
    background: var(--chassis);
    box-shadow: inset 0 1px 2px var(--bevel-shadow);
  }

  .tally > div {
    min-width: 62px;
    padding: 4px 9px 5px;
    border-left: 1px solid var(--chassis-line);
  }

  .tally > div:first-child {
    border-left: 0;
  }

  .tally dt {
    color: var(--faint);
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .tally dd {
    margin: 2px 0 0;
    color: var(--text);
    font-size: 12px;
  }

  label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    color: var(--muted);
  }
  label span {
    font: var(--label-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  input {
    width: 54px;
    height: 28px;
    padding: 0 5px;
    border: 1px solid var(--chassis-line-high);
    border-radius: var(--radius-screen);
    outline: 0;
    background: var(--screen);
    color: var(--screen-text);
    text-align: right;
  }
  input:focus {
    border-color: var(--screen-select);
  }
  em {
    color: var(--faint);
    font-size: 9px;
    font-style: normal;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: 14px;
  }
  nav i {
    width: 1px;
    height: 18px;
    margin: 0 5px;
    background: var(--chassis-line);
  }
  button {
    padding: 6px 9px;
    border: 0;
    border-radius: var(--radius-control);
    border: 1px solid transparent;
    background: transparent;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--muted);
    cursor: pointer;
  }
  button:hover,
  button.active {
    border-color: var(--chassis-line-high);
    background: var(--chassis-high);
    color: var(--text);
    box-shadow: inset 0 1px 0 var(--bevel-light);
  }
</style>
