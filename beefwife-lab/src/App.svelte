<script>
  import ChainMap from "./lib/ChainMap.svelte";
  import Inspector from "./lib/Inspector.svelte";
  import Stage from "./lib/Stage.svelte";
  import packageInfo from "../package.json";

  const version = packageInfo.version;
  let theme = "light";

  $: document.documentElement.dataset.theme = theme;

  let activeTab = "Chain";
  let selected = "eyes";
  let sidebarOpen = true;
  let sidebarWidth = 316;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let resizing = false;

  function selectItem(id) {
    selected = id;
    activeTab = "Chain";
    sidebarOpen = true;
  }

  function clampSidebarWidth(width) {
    const viewportMaximum = Math.max(260, window.innerWidth - 340);
    return Math.min(Math.max(260, width), Math.min(520, viewportMaximum));
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
  <meta
    name="description"
    content="A UI-only exploration of the Beefwife Lab chain editor."
  />
</svelte:head>

<main class="app-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Beefwife Lab home">
      <span class="brand-mark" aria-hidden="true"><i>BW</i></span>
      <span>
        <strong>Beefwife Lab</strong>
        <small>Biomechanics workstation · v{version}</small>
      </span>
    </a>

    <div class="document-title">
      <span>Specimen</span>
      <strong>Rust walker</strong>
      <em>Unsaved</em>
    </div>

    <div class="top-actions">
      <span class="machine-state"><i></i>Runtime online</span>
      <button class="quiet">Undo</button>
      <button class="quiet">Redo</button>
      <span class="divider"></span>
      <button
        class="quiet"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} chassis`}
        title="Switch chassis finish"
        onclick={() => (theme = theme === "dark" ? "light" : "dark")}
        >{theme === "dark" ? "Putty" : "Graphite"}</button
      >
      <span class="divider"></span>
      <button
        class="panel-toggle"
        class:active={sidebarOpen}
        aria-pressed={sidebarOpen}
        onclick={() => (sidebarOpen = !sidebarOpen)}
      >
        <i aria-hidden="true"></i>
        Panel
      </button>
    </div>
  </header>

  <section
    class="editor"
    class:panel-open={sidebarOpen}
    class:resizing
    style:--sidebar-width={`${sidebarWidth}px`}
  >
    <Stage {selected} onselect={selectItem} />
    {#if sidebarOpen}
      <div class="sidebar-wrap">
        <div
          class="resize-handle"
          role="slider"
          aria-label="Tool panel width"
          aria-orientation="horizontal"
          aria-valuemin="260"
          aria-valuemax="520"
          aria-valuenow={sidebarWidth}
          tabindex="0"
          title="Drag to resize · Double-click to reset"
          onpointerdown={beginSidebarResize}
          onpointermove={resizeSidebar}
          onpointerup={endSidebarResize}
          onpointercancel={endSidebarResize}
          onkeydown={resizeSidebarFromKeyboard}
          ondblclick={() => (sidebarWidth = 316)}
        ></div>
        <Inspector
          {selected}
          {activeTab}
          ontab={(tab) => (activeTab = tab)}
          onclose={() => (sidebarOpen = false)}
        />
      </div>
    {/if}
  </section>

  <ChainMap bind:selected />
</main>
