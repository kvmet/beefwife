<script>
  import Inspector from "./lib/Inspector.svelte";
  import Stage from "./lib/Stage.svelte";
  import packageInfo from "../package.json";

  const version = packageInfo.version;
  let theme = "light";

  $: document.documentElement.dataset.theme = theme;

  let activeTab = "Look";
  let selected = "eyes";
  let sidebarOpen = true;
  let sidebarWidth = 480;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let resizing = false;

  function selectItem(id) {
    selected = id;
    activeTab = "Look";
    sidebarOpen = true;
  }

  function clampSidebarWidth(width) {
    const viewportMaximum = Math.max(400, window.innerWidth - 340);
    return Math.min(Math.max(400, width), Math.min(800, viewportMaximum));
  }

  function beginSidebarResize(event) {
    resizing = true;
    resizeStartX = event.clientX;
    resizeStartWidth = sidebarWidth;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeSidebar(event) {
    if (!resizing) return;
    sidebarWidth = clampSidebarWidth(
      resizeStartWidth + resizeStartX - event.clientX,
    );
  }

  function endSidebarResize(event) {
    resizing = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeSidebarFromKeyboard(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    sidebarWidth = clampSidebarWidth(
      sidebarWidth + (event.key === "ArrowLeft" ? 16 : -16),
    );
  }
</script>

<svelte:head>
  <meta name="description" content="The Beefwife chain editor." />
</svelte:head>

<main
  class="app-shell"
  class:panel-open={sidebarOpen}
  class:resizing
  style:--sidebar-width={`${sidebarWidth}px`}
>
  <header class="topbar">
    <a class="brand" href="/" aria-label="Beefwife Lab home">
      <span>
        <strong>Beefwife Lab</strong>
        <small>Biomechanics workstation · v{version}</small>
      </span>
    </a>

    <div class="top-actions">
      <span class="save-state">Unsaved</span>
      <button class="quiet">Undo</button>
      <button class="quiet">Redo</button>
      <span class="divider"></span>
      <button
        class="quiet"
        title="Switch chassis finish"
        onclick={() => (theme = theme === "dark" ? "light" : "dark")}
        >Theme</button
      >
      {#if !sidebarOpen}
        <span class="divider"></span>
        <button class="panel-toggle" onclick={() => (sidebarOpen = true)}>
          <b aria-hidden="true">+</b>
          Panel
        </button>
      {/if}
    </div>
  </header>

  <Stage {selected} onselect={selectItem} />

  {#if sidebarOpen}
    <div class="sidebar-wrap">
      <div
        class="resize-handle"
        role="slider"
        aria-label="Tool panel width"
        aria-orientation="horizontal"
        aria-valuemin="400"
        aria-valuemax="800"
        aria-valuenow={sidebarWidth}
        tabindex="0"
        title="Drag to resize · Double-click to reset"
        onpointerdown={beginSidebarResize}
        onpointermove={resizeSidebar}
        onpointerup={endSidebarResize}
        onpointercancel={endSidebarResize}
        onkeydown={resizeSidebarFromKeyboard}
        ondblclick={() => (sidebarWidth = 480)}
      ></div>
      <Inspector
        {selected}
        {activeTab}
        ontab={(tab) => (activeTab = tab)}
        onhide={() => (sidebarOpen = false)}
      />
    </div>
  {/if}
</main>
