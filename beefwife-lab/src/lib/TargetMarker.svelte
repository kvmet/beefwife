<script>
  /* Percentages of the stage, the same units the target is held in. */
  export let x;
  export let y;
</script>

<div
  class="target"
  style:left={`${x}%`}
  style:top={`${y}%`}
  aria-hidden="true"
></div>

<style>
  .target {
    position: absolute;
    z-index: 3;
    width: 23px;
    height: 23px;
    border: 1px solid var(--screen-measure-line);
    border-radius: 50%;
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition:
      left 700ms cubic-bezier(0.22, 1, 0.36, 1),
      top 700ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .target::before,
  .target::after {
    position: absolute;
    content: "";
  }

  .target::before {
    top: 10px;
    left: -8px;
    width: 37px;
    height: 1px;
    background: linear-gradient(
      90deg,
      var(--screen-measure-line) 0 9px,
      transparent 9px 28px,
      var(--screen-measure-line) 28px 37px
    );
  }

  .target::after {
    top: -8px;
    left: 10px;
    width: 1px;
    height: 37px;
    background: linear-gradient(
      var(--screen-measure-line) 0 9px,
      transparent 9px 28px,
      var(--screen-measure-line) 28px 37px
    );
  }
</style>
