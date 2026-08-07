<script>
  export let visible = false;

  const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90];
</script>

<div class="graticule graticule-x" class:visible aria-hidden="true">
  {#each ticks as tick}
    <i class:major={tick % 20 === 0} style:left={`${tick}%`}
      >{tick % 20 === 0 ? tick : ""}</i
    >
  {/each}
</div>
<div class="graticule graticule-y" class:visible aria-hidden="true">
  {#each ticks as tick}
    <i class:major={tick % 20 === 0} style:top={`${tick}%`}
      >{tick % 20 === 0 ? tick : ""}</i
    >
  {/each}
</div>

<style>
  .graticule {
    position: absolute;
    z-index: 3;
    color: var(--screen-faint);
    font-size: 8px;
    letter-spacing: 0.06em;
    pointer-events: none;
    visibility: hidden;
  }

  .graticule.visible {
    visibility: visible;
  }

  .graticule i {
    position: absolute;
    font-style: normal;
  }

  .graticule-x {
    top: 0;
    right: 0;
    left: 0;
    height: 16px;
    border-bottom: 1px solid var(--screen-grid);
  }

  .graticule-x i {
    top: 0;
    height: 4px;
    padding-left: 3px;
    border-left: 1px solid var(--screen-grid-major);
    line-height: 14px;
  }

  .graticule-x i.major {
    height: 7px;
  }

  .graticule-y {
    top: 16px;
    bottom: 0;
    left: 0;
    width: 22px;
    border-right: 1px solid var(--screen-grid);
  }

  .graticule-y i {
    left: 0;
    width: 22px;
    padding: 3px 0 0 11px;
    background: linear-gradient(
        90deg,
        var(--screen-grid-major) 0 4px,
        transparent 4px
      )
      no-repeat;
    background-size: 100% 1px;
  }

  .graticule-y i.major {
    background-image: linear-gradient(
      90deg,
      var(--screen-grid-major) 0 8px,
      transparent 8px
    );
  }
</style>
