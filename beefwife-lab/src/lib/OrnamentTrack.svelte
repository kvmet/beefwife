<script>
  export let selected;

  let drag;
  let ornaments = [
    { id: "eyes", label: "Eyes", left: 5, width: 10, lane: 0 },
    { id: "feelers", label: "Feelers", left: 9, width: 14, lane: 1 },
    { id: "dorsal", label: "Dorsal ridge", left: 29, width: 34, lane: 0 },
    { id: "spots", label: "Spots", left: 46, width: 23, lane: 1 },
    { id: "tail-fin", label: "Tail fin", left: 79, width: 16, lane: 0 },
  ];

  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

  function begin(ornament, event) {
    drag = {
      id: ornament.id,
      left: ornament.left,
      lane: ornament.lane,
      startX: event.clientX,
      startY: event.clientY,
      trackWidth: event.currentTarget.parentElement.clientWidth,
    };
    selected = ornament.id;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event) {
    if (!drag) return;
    const delta = ((event.clientX - drag.startX) / drag.trackWidth) * 100;
    ornaments = ornaments.map((ornament) =>
      ornament.id === drag.id
        ? {
            ...ornament,
            left: clamp(drag.left + delta, 0, 100 - ornament.width),
            lane: clamp(
              Math.round(drag.lane + (event.clientY - drag.startY) / 28),
              0,
              1,
            ),
          }
        : ornament,
    );
  }

  function nudge(id, event) {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    ornaments = ornaments.map((ornament) => {
      if (ornament.id !== id) return ornament;
      const horizontal =
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      const vertical =
        event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      return {
        ...ornament,
        left: clamp(ornament.left + horizontal, 0, 100 - ornament.width),
        lane: clamp(ornament.lane + vertical, 0, 1),
      };
    });
    event.preventDefault();
  }

  function finish(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag = undefined;
  }
</script>

<div class="track-row">
  <div class="track-label">
    <strong>Ornaments</strong><span>stackable</span>
  </div>
  <div class="track">
    {#each ornaments as ornament}
      <button
        class:active={selected === ornament.id}
        class:dragging={drag?.id === ornament.id}
        style:left={`${ornament.left}%`}
        style:width={`${ornament.width}%`}
        style:top={`${7 + ornament.lane * 28}px`}
        onclick={() => (selected = ornament.id)}
        onpointerdown={(event) => begin(ornament, event)}
        onpointermove={move}
        onpointerup={finish}
        onpointercancel={finish}
        onkeydown={(event) => nudge(ornament.id, event)}
        ><i></i>{ornament.label}</button
      >
    {/each}
  </div>
</div>

<style>
  .track-row {
    display: grid;
    min-height: 73px;
    border-bottom: 1px solid var(--chassis-line);
    grid-template-columns: var(--track-label) var(--chain-width);
  }

  .track-label {
    padding: 10px 12px 8px 16px;
    border-right: 1px solid var(--chassis-line);
    background: var(--label-paper);
    box-shadow: inset -1px 0 0 var(--bevel-shadow);
  }
  .track-label strong,
  .track-label span {
    display: block;
  }
  .track-label strong {
    font-size: 11px;
    font-weight: 650;
  }
  .track-label span {
    margin-top: 2px;
    color: var(--faint);
    font-size: 9px;
  }

  .track {
    position: relative;
    min-height: 72px;
    background-color: var(--screen);
    background-image:
      linear-gradient(
        90deg,
        transparent var(--head-end),
        var(--screen-line-major) var(--head-end),
        var(--screen-line-major) calc(var(--head-end) + 1px),
        transparent calc(var(--head-end) + 1px)
      ),
      linear-gradient(
        90deg,
        transparent var(--trunk-end),
        var(--screen-line-major) var(--trunk-end),
        var(--screen-line-major) calc(var(--trunk-end) + 1px),
        transparent calc(var(--trunk-end) + 1px)
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0 calc(8.333% - 1px),
        var(--screen-grid) calc(8.333% - 1px) 8.333%
      );
  }

  button {
    position: absolute;
    height: 23px;
    overflow: hidden;
    border: 1px solid var(--ornament-chip-line);
    border-radius: 12px;
    background: var(--ornament-chip);
    color: var(--ornament-chip-text);
    cursor: grab;
    font-size: 9px;
    text-overflow: ellipsis;
    touch-action: none;
    white-space: nowrap;
  }

  button:hover,
  button.active {
    z-index: 3;
    border-color: var(--screen-select);
  }
  button.dragging {
    z-index: 4;
    cursor: grabbing;
  }
  button i {
    display: inline-block;
    width: 5px;
    height: 5px;
    margin-right: 5px;
    border-radius: 50%;
    background: var(--ornament);
  }
</style>
