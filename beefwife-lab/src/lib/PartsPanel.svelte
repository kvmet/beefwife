<script>
  import ControlRow from "./ControlRow.svelte";
  import ShapeEditor, { parsePolygon } from "./ShapeEditor.svelte";
  import Tooltip from "./Tooltip.svelte";
  import {
    applyError,
    defaults,
    descriptor,
    SECTION_NAMES,
  } from "./descriptor.js";

  /* Which definition is under edit: { kind, id } or null. */
  export let selection = null;
  export let onselect;
  export let advanced = false;

  /* Mirrors BeefwifeDescriptor's ID_PATTERN; the validator rejects others. */
  const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
  const TABLE = { shape: "shapes", paint: "paints", material: "materials" };

  const NEW_SHAPE = { path: "M 0 -3 L 3 0 L 0 3 L -3 0 Z" };
  const NEW_PAINT = { fill: "#a8444a", stroke: "#17191d", strokeWidth: 1 };
  const NEW_MATERIAL = {
    velocityRetention: 0.97,
    jointCorrection: 0.5,
    linkCorrection: 0.5,
    grip: { forward: 0.1, backward: 0.4, lateral: 0.5 },
  };

  let sections = {};

  /** Bring a kind's section into view. Called by the Look tab's Edit jump. */
  export function reveal(kind) {
    const panel = sections[kind];
    if (!panel) return;
    panel.open = true;
    panel.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  $: shapes = $descriptor.definitions.shapes;
  $: paints = $descriptor.definitions.paints;
  $: materials = $descriptor.definitions.materials;
  $: selectionRefs = selection
    ? refsOf($descriptor, selection.kind, selection.id)
    : [];
  $: selectionLast =
    selection &&
    Object.keys($descriptor.definitions[TABLE[selection.kind]]).length <= 1;
  $: removeTitle = selectionRefs.length
    ? `Used by ${selectionRefs.join(", ")}`
    : selectionLast
      ? "At least one is required"
      : "Remove";

  /** Places that reference a definition, named for the remove tooltip. */
  function refsOf(d, kind, id) {
    const refs = [];
    if (kind === "shape") {
      for (const p of d.chain.skin.plates)
        if (p.shape === id) refs.push(`plate ${p.id}`);
      for (const o of d.chain.skin.ornaments)
        if (o.shape === id) refs.push(`ornament ${o.id}`);
      if (d.legs.skin.foot.shape === id) refs.push("the foot");
    } else if (kind === "paint") {
      if (d.chain.skin.ribbon.paint === id) refs.push("the ribbon");
      for (const p of d.chain.skin.plates)
        if (p.paint === id) refs.push(`plate ${p.id}`);
      for (const o of d.chain.skin.ornaments)
        if (o.paint === id) refs.push(`ornament ${o.id}`);
      if (d.legs.skin.limbPaint === id) refs.push("the limbs");
      if (d.legs.skin.foot.paint === id) refs.push("the foot");
    } else {
      for (const name of SECTION_NAMES)
        if (d.chain.sections[name].material === id)
          refs.push(`the ${name} section`);
    }
    return refs;
  }

  function uniqueId(table, prefix) {
    const record = $descriptor.definitions[table];
    let n = 1;
    while (record[`${prefix}-${n}`]) n++;
    return `${prefix}-${n}`;
  }

  function add(kind, value) {
    const table = TABLE[kind];
    const id = uniqueId(table, kind);
    descriptor.update((d) => {
      d.definitions[table] = {
        ...d.definitions[table],
        [id]: structuredClone(value),
      };
      return d;
    });
    onselect({ kind, id });
  }

  function duplicate(kind, id) {
    const table = TABLE[kind];
    const copy = uniqueId(table, id);
    descriptor.update((d) => {
      d.definitions[table] = {
        ...d.definitions[table],
        [copy]: structuredClone(d.definitions[table][id]),
      };
      return d;
    });
    onselect({ kind, id: copy });
  }

  function remove(kind, id) {
    const table = TABLE[kind];
    descriptor.update((d) => {
      const { [id]: gone, ...rest } = d.definitions[table];
      d.definitions[table] = rest;
      return d;
    });
    onselect(null);
  }

  /* One update call: the key change and every reference land in the same
     apply, so the canvas never sees a dangling id. */
  function rename(kind, from, event) {
    const to = event.target.value.trim();
    const table = TABLE[kind];
    if (to === from) return;
    if (!ID_PATTERN.test(to) || $descriptor.definitions[table][to]) {
      event.target.value = from;
      return;
    }
    descriptor.update((d) => {
      d.definitions[table] = Object.fromEntries(
        Object.entries(d.definitions[table]).map(([key, value]) => [
          key === from ? to : key,
          value,
        ]),
      );
      if (kind === "shape") {
        for (const p of d.chain.skin.plates) if (p.shape === from) p.shape = to;
        for (const o of d.chain.skin.ornaments)
          if (o.shape === from) o.shape = to;
        if (d.legs.skin.foot.shape === from) d.legs.skin.foot.shape = to;
      } else if (kind === "paint") {
        if (d.chain.skin.ribbon.paint === from) d.chain.skin.ribbon.paint = to;
        for (const p of d.chain.skin.plates) if (p.paint === from) p.paint = to;
        for (const o of d.chain.skin.ornaments)
          if (o.paint === from) o.paint = to;
        if (d.legs.skin.limbPaint === from) d.legs.skin.limbPaint = to;
        if (d.legs.skin.foot.paint === from) d.legs.skin.foot.paint = to;
      } else {
        for (const name of SECTION_NAMES)
          if (d.chain.sections[name].material === from)
            d.chain.sections[name].material = to;
      }
      return d;
    });
    onselect({ kind, id: to });
  }

  function setColour(field, value) {
    $descriptor.definitions.paints[selection.id][field] = value;
  }

  function toggleColour(field, on) {
    const fallback =
      defaults.definitions.paints[selection.id]?.[field] ?? "#888888";
    setColour(field, on ? fallback : null);
  }

  /** Tight viewBox around a shape's own extent for its list thumbnail. */
  function thumbBox(path) {
    const points = parsePolygon(path);
    if (!points) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return `${minX - 0.5} ${minY - 0.5} ${Math.max(...xs) - minX + 1} ${Math.max(...ys) - minY + 1}`;
  }
</script>

{#snippet partActions(kind)}
  <div class="fields">
    <label class="wide">
      <Tooltip
        label="Name the rest of the document refers to. Renaming here updates every reference."
        ><span>Id</span></Tooltip
      >
      <div class="pick part-id">
        <input
          value={selection.id}
          onchange={(event) => rename(kind, selection.id, event)}
        />
        <button onclick={() => duplicate(kind, selection.id)}>Copy</button>
        <button
          disabled={selectionRefs.length > 0 || selectionLast}
          title={removeTitle}
          onclick={() => remove(kind, selection.id)}
        >
          Remove
        </button>
      </div>
    </label>
  </div>
{/snippet}

{#if $applyError}
  <p class="apply-error" role="alert">{$applyError}</p>
{/if}

<details open bind:this={sections.shape}>
  <summary>Shapes</summary>
  <div class="list">
    {#each Object.entries(shapes) as [shapeId, def] (shapeId)}
      {@const box = thumbBox(def.path)}
      <button
        aria-pressed={selection?.kind === "shape" && selection.id === shapeId}
        onclick={() => onselect({ kind: "shape", id: shapeId })}
      >
        {#if box}
          <svg class="thumb" viewBox={box} aria-hidden="true">
            <path d={def.path} />
          </svg>
        {/if}
        {shapeId}
      </button>
    {/each}
    <button onclick={() => add("shape", NEW_SHAPE)}>+ Add</button>
  </div>
  {#if selection?.kind === "shape" && shapes[selection.id]}
    <div class="editor">
      <ShapeEditor id={selection.id} />
    </div>
    {@render partActions("shape")}
  {/if}
</details>

<details open bind:this={sections.paint}>
  <summary>Paints</summary>
  <div class="list">
    {#each Object.entries(paints) as [paintId, paint] (paintId)}
      <button
        aria-pressed={selection?.kind === "paint" && selection.id === paintId}
        onclick={() => onselect({ kind: "paint", id: paintId })}
      >
        <i
          class="swatch"
          style:background={paint.fill ?? "transparent"}
          style:border-color={paint.stroke ?? "var(--chassis-line)"}
        ></i>
        {paintId}
      </button>
    {/each}
    <button onclick={() => add("paint", NEW_PAINT)}>+ Add</button>
  </div>
  {#if selection?.kind === "paint" && paints[selection.id]}
    {@const paint = paints[selection.id]}
    <div class="fields">
      <label>
        <Tooltip
          label="Colour inside the shape. Switch it off for an outline alone."
          ><span>Fill</span></Tooltip
        >
        <div class="colour">
          <div class="switch">
            <input
              type="checkbox"
              checked={paint.fill != null}
              onchange={(event) => toggleColour("fill", event.target.checked)}
            />
          </div>
          <input
            type="color"
            aria-label="Fill colour"
            disabled={paint.fill == null}
            value={paint.fill ?? "#000000"}
            oninput={(event) => setColour("fill", event.target.value)}
          />
        </div>
      </label>
      <label>
        <Tooltip label="Colour of the outline. Switch it off for a fill alone."
          ><span>Stroke</span></Tooltip
        >
        <div class="colour">
          <div class="switch">
            <input
              type="checkbox"
              checked={paint.stroke != null}
              onchange={(event) => toggleColour("stroke", event.target.checked)}
            />
          </div>
          <input
            type="color"
            aria-label="Stroke colour"
            disabled={paint.stroke == null}
            value={paint.stroke ?? "#000000"}
            oninput={(event) => setColour("stroke", event.target.value)}
          />
        </div>
      </label>
    </div>
    <div class="rows">
      <ControlRow
        label="Stroke width"
        tip="Thickness of the outline. Shape scale does not change it."
        unit="px"
        digits={1}
        bind:value={$descriptor.definitions.paints[selection.id].strokeWidth}
        reset={defaults.definitions.paints[selection.id]?.strokeWidth ?? 1}
        field={[0, 1000, 0.1]}
        slider={[0, 10, 0.1]}
      />
    </div>
    {@render partActions("paint")}
  {/if}
</details>

{#if advanced}
  <details open bind:this={sections.material}>
    <summary>Materials</summary>
    <div class="list">
      {#each Object.keys(materials) as materialId (materialId)}
        <button
          aria-pressed={selection?.kind === "material" &&
            selection.id === materialId}
          onclick={() => onselect({ kind: "material", id: materialId })}
        >
          {materialId}
        </button>
      {/each}
      <button onclick={() => add("material", NEW_MATERIAL)}>+ Add</button>
    </div>
    {#if selection?.kind === "material" && materials[selection.id]}
      {@const reset =
        defaults.definitions.materials[selection.id] ?? NEW_MATERIAL}
      <div class="rows">
        <ControlRow
          label="Velocity retention"
          tip="Part of the last step's motion a chunk keeps. Low values drag it to a stop."
          digits={3}
          bind:value={
            $descriptor.definitions.materials[selection.id].velocityRetention
          }
          reset={reset.velocityRetention}
          field={[0, 1, 0.001]}
          slider={[0.5, 1, 0.001]}
        />
        <ControlRow
          label="Joint correction"
          tip="How hard a joint is pulled to the angle the bend wave asks for. 0 ignores the wave."
          bind:value={
            $descriptor.definitions.materials[selection.id].jointCorrection
          }
          reset={reset.jointCorrection}
          field={[0, 1, 0.01]}
          slider={[0, 1, 0.01]}
        />
        <ControlRow
          label="Link correction"
          tip="How hard a link is pulled back to its target length. Low values let the body stretch."
          bind:value={
            $descriptor.definitions.materials[selection.id].linkCorrection
          }
          reset={reset.linkCorrection}
          field={[0.001, 1, 0.01]}
          slider={[0.001, 1, 0.01]}
        />
        <ControlRow
          label="Grip forward"
          tip="Forward slide a chunk gives up while it holds the ground. 1 stops it dead."
          bind:value={
            $descriptor.definitions.materials[selection.id].grip.forward
          }
          reset={reset.grip.forward}
          field={[0, 1, 0.01]}
          slider={[0, 1, 0.01]}
        />
        <ControlRow
          label="Grip backward"
          tip="Backward slide a chunk gives up while it holds the ground. This is what walking pushes against."
          bind:value={
            $descriptor.definitions.materials[selection.id].grip.backward
          }
          reset={reset.grip.backward}
          field={[0, 1, 0.01]}
          slider={[0, 1, 0.01]}
        />
        <ControlRow
          label="Grip lateral"
          tip="Sideways slide a chunk gives up while it holds the ground. High values stop the body slipping out of its turns."
          bind:value={
            $descriptor.definitions.materials[selection.id].grip.lateral
          }
          reset={reset.grip.lateral}
          field={[0, 1, 0.01]}
          slider={[0, 1, 0.01]}
        />
      </div>
      {@render partActions("material")}
    {/if}
  </details>
{/if}

<style>
  .thumb {
    width: 22px;
    height: 16px;
    flex: none;
    fill: currentColor;
  }

  .swatch {
    width: 14px;
    height: 14px;
    flex: none;
    border: 2px solid transparent;
  }

  .list button {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .part-id input {
    min-width: 0;
    flex: 1;
  }

  .editor {
    padding: 6px 2px 15px 23px;
  }

  .colour {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .colour input[type="color"] {
    min-width: 0;
    flex: 1;
    padding: 2px;
  }
</style>
