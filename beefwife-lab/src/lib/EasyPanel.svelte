<script>
  import Tooltip from "./Tooltip.svelte";
  import {
    applyError,
    canonicalDocument,
    copyText,
    descriptor,
    dirty,
    downloadDocument,
    openDocumentFile,
    replaceDocument,
    revertDocument,
  } from "./descriptor.js";
  import { PRESETS } from "./presets.js";

  /* Every step is one press of a button, so each one has to move the body by
     a visible amount without running off its schema bound in a few presses. */
  const SIZE_STEP = 1.25;
  const PACE_STEP = 1.25;
  const BEND_STEP = 0.1;
  /* A stopped body cannot be multiplied faster, so the first press of Faster
     sets a pace instead of scaling zero. */
  const SLOWEST_PACE = 0.1;

  const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

  let loaded = null;
  let picker;
  let notice = null;
  /* A replacement waiting on the confirm row: { label, run }. */
  let pending = null;

  /* Presets are the panel's own imported documents and the panels write what
     they are given in place, so each load hands over a copy. */
  const copyOf = (value) => structuredClone(value);

  /* Swapping between presets to watch the styles is the point of this panel,
     so only edits made on top of one are worth stopping for. */
  function guard(label, run) {
    if ($dirty) pending = { label, run };
    else run();
  }

  function choose(preset) {
    guard(preset.label, () => {
      replaceDocument(copyOf(preset.document));
      loaded = preset.key;
      notice = null;
    });
  }

  function openFile(event) {
    const file = event.target.files[0];
    // Clear the picker so choosing the same file twice loads it twice.
    event.target.value = "";
    if (!file) return;
    guard(file.name, async () => {
      try {
        await openDocumentFile(file);
        loaded = null;
        notice = null;
      } catch (error) {
        notice = error.message;
      }
    });
  }

  function revert() {
    guard("the last one you opened", () => {
      revertDocument();
      notice = null;
    });
  }

  function confirmPending() {
    const run = pending.run;
    pending = null;
    run();
  }

  function stepLegs(delta) {
    $descriptor.legs.pairs = clamp($descriptor.legs.pairs + delta, 0, 128);
  }

  function stepPace(factor) {
    const pace = $descriptor.gait.cyclesPerSecond * factor;
    $descriptor.gait.cyclesPerSecond = clamp(
      factor > 1 ? Math.max(pace, SLOWEST_PACE) : pace,
      0,
      100,
    );
  }

  function stepBend(delta) {
    $descriptor.gait.bend.amplitude = clamp(
      $descriptor.gait.bend.amplitude + delta,
      0,
      10,
    );
  }

  /* Resizing multiplies every length in the document, so a factor that puts
     one of them outside its bound is refused whole rather than in part. */
  function stepSize(factor) {
    try {
      descriptor.set(
        window.BeefwifeCanvas.Descriptor.scale($descriptor, factor),
      );
      notice = null;
    } catch (error) {
      notice = error.message;
    }
  }

  function copy() {
    copyText(canonicalDocument()).then((message) => (notice = message));
  }
</script>

{#if $applyError}
  <p class="apply-error" role="alert">{$applyError}</p>
{/if}

{#if pending}
  <div class="confirm" role="alert">
    <p>
      Load <strong>{pending.label}</strong>? This beefwife has changes, and the
      only copy is the one the lab saved.
    </p>
    <div class="confirm-actions">
      <button onclick={confirmPending}>Load anyway</button>
      <button onclick={() => (pending = null)}>Keep editing</button>
    </div>
  </div>
{/if}

<details open>
  <summary>Move style</summary>
  <div class="list">
    {#each PRESETS as preset (preset.key)}
      <button
        aria-pressed={loaded === preset.key}
        onclick={() => choose(preset)}
      >
        {preset.label}
      </button>
    {/each}
  </div>
  <p class="hint">
    <span aria-hidden="true">&#8592;</span>
    Drag the chain map to make the body longer or shorter.
  </p>
</details>

<details open>
  <summary>Adjust</summary>
  <div class="macros">
    <div class="macro">
      <Tooltip
        label="Leg pairs, spread evenly along the section that carries them."
        ><span>Legs</span></Tooltip
      >
      <div class="pair">
        <button onclick={() => stepLegs(1)}>More</button>
        <button onclick={() => stepLegs(-1)}>Fewer</button>
      </div>
    </div>
    <div class="macro">
      <Tooltip
        label="Every length in the document at once. The pace and the wave shape are left alone."
        ><span>Size</span></Tooltip
      >
      <div class="pair">
        <button onclick={() => stepSize(SIZE_STEP)}>Bigger</button>
        <button onclick={() => stepSize(1 / SIZE_STEP)}>Smaller</button>
      </div>
    </div>
    <div class="macro">
      <Tooltip
        label="Gait cycles each second. Every channel reads this one clock."
        ><span>Pace</span></Tooltip
      >
      <div class="pair">
        <button onclick={() => stepPace(PACE_STEP)}>Faster</button>
        <button onclick={() => stepPace(1 / PACE_STEP)}>Slower</button>
      </div>
    </div>
    <div class="macro">
      <Tooltip
        label="Curve the wave puts in each joint as it runs down the body."
        ><span>Wiggle</span></Tooltip
      >
      <div class="pair">
        <button onclick={() => stepBend(BEND_STEP)}>More</button>
        <button onclick={() => stepBend(-BEND_STEP)}>Less</button>
      </div>
    </div>
  </div>
</details>

<details open>
  <summary>This beefwife</summary>
  <div class="list">
    <button onclick={() => picker.click()}>Open</button>
    <button onclick={downloadDocument}>Download</button>
    <button onclick={copy}>Copy</button>
    <button disabled={!$dirty} onclick={revert}>Revert</button>
    <input
      bind:this={picker}
      class="picker"
      type="file"
      accept="application/json,.json"
      onchange={openFile}
    />
  </div>
  {#if notice}<p class="notice">{notice}</p>{/if}
</details>

<style>
  /* The rail the arrow points at is off the left edge of this panel, so the
     glyph rides in the list's own left gutter rather than beside the text. */
  .hint {
    display: flex;
    align-items: baseline;
    gap: 7px;
    margin: 0;
    padding: 0 16px 14px 23px;
    color: var(--muted);
    font-size: 11px;
  }

  .hint span {
    color: var(--select);
    font-size: 13px;
  }

  .macros {
    display: grid;
    gap: 10px;
    padding: 6px 16px 14px 23px;
  }

  .macro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  /* The kit hangs a 6px gutter under a label's span for the control below it;
     here the buttons sit beside the text instead. */
  .macro > :global(.tip-host) {
    margin-bottom: 0;
  }

  .macro span {
    color: var(--text);
    font-size: 12px;
  }

  .pair {
    display: flex;
    gap: calc(var(--bevel-width) * 2 + 2px);
  }

  .pair button {
    width: 68px;
    height: 26px;
    padding: 0;
    font-size: 11px;
  }

  .confirm {
    padding: 10px 16px;
    border-bottom: 1px solid var(--chassis-line);
    background: var(--danger-dim);
  }

  .confirm p {
    margin: 0 0 8px;
    color: var(--text);
    font-size: 11px;
  }

  .confirm-actions {
    display: flex;
    gap: calc(var(--bevel-width) * 2 + 2px);
  }

  .confirm-actions button {
    height: 26px;
    padding: 0 9px;
    font-size: 11px;
  }

  /* The button opens it; the input itself never shows its own control. */
  .picker {
    display: none;
  }

  .notice {
    margin: 0;
    padding: 0 16px 14px 23px;
    color: var(--muted);
    font-size: 11px;
  }
</style>
