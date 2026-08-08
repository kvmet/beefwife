<script context="module">
  /* Each host needs its own anchor name for the popover to resolve against. */
  let instances = 0;
</script>

<script>
  import { onDestroy } from "svelte";

  export let label;
  /* Shortcut, unit, or range: the dim half of the readout. */
  export let keys = "";

  const anchor = `--tip-anchor-${(instances += 1)}`;
  const revealDelay = 400;

  let tip;
  let timer;

  function show() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!tip.matches(":popover-open")) tip.showPopover();
    }, revealDelay);
  }

  function hide() {
    clearTimeout(timer);
    if (tip.matches(":popover-open")) tip.hidePopover();
  }

  onDestroy(() => clearTimeout(timer));
</script>

<!-- The host only observes pointer transit. The control it wraps keeps its own
     semantics, and the readout repeats that control's name, so it is hidden
     from assistive tech rather than announced twice. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="tip-host"
  style:--tip-anchor={anchor}
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
>
  <slot />
  <span class="tip" popover="manual" aria-hidden="true" bind:this={tip}
    >{label}{#if keys}&nbsp;<span class="sub">{keys}</span>{/if}</span
  >
</span>

<style>
  .tip-host {
    display: inline-flex;
    anchor-name: var(--tip-anchor);
  }

  /* Thrown from the trigger rather than set into the chassis: no bevel, and
     the seafoam frame is the reticle's interrupted line, corners only. The
     top layer is what carries it out of the inspector's scroll box. */
  .tip {
    --frame-inset: 3px;

    position: fixed;
    position-anchor: var(--tip-anchor);
    position-area: bottom;
    position-try-fallbacks: flip-block;
    inset: auto;
    justify-self: anchor-center;
    min-width: 84px;
    max-width: 250px;
    margin: 4px 0 0;
    padding: 10px 13px;
    border: 0;
    overflow: visible;
    background-color: color-mix(in oklab, var(--screen) 90%, transparent);
    background-image:
      linear-gradient(
        90deg,
        var(--screen-measure) 0 9px,
        transparent 9px calc(100% - 9px),
        var(--screen-measure) calc(100% - 9px)
      ),
      linear-gradient(
        90deg,
        var(--screen-measure) 0 9px,
        transparent 9px calc(100% - 9px),
        var(--screen-measure) calc(100% - 9px)
      ),
      linear-gradient(
        var(--screen-measure) 0 7px,
        transparent 7px calc(100% - 7px),
        var(--screen-measure) calc(100% - 7px)
      ),
      linear-gradient(
        var(--screen-measure) 0 7px,
        transparent 7px calc(100% - 7px),
        var(--screen-measure) calc(100% - 7px)
      );
    background-repeat: no-repeat;
    /* Inset by --frame-inset so the plate reads wider than the frame it
       carries, rather than the frame doubling as the edge. */
    background-position:
      var(--frame-inset) var(--frame-inset),
      var(--frame-inset) calc(100% - var(--frame-inset)),
      var(--frame-inset) var(--frame-inset),
      calc(100% - var(--frame-inset)) var(--frame-inset);
    background-size:
      calc(100% - var(--frame-inset) * 2) 1px,
      calc(100% - var(--frame-inset) * 2) 1px,
      1px calc(100% - var(--frame-inset) * 2),
      1px calc(100% - var(--frame-inset) * 2);
    color: var(--screen-text);
    font: 12px/1.4 var(--font-mono);
    text-align: center;
    pointer-events: none;
    /* A trigger may be a clipped one-line label. The plate is its own text
       box, so it takes none of that. */
    letter-spacing: normal;
    text-transform: none;
    white-space: normal;
  }

  .tip .sub {
    color: var(--screen-muted);
  }
</style>
