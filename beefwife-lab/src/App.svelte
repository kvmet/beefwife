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
      <button class="quiet" title="Undo" aria-label="Undo">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M6.5 4.5 3 8l3.5 3.5M3 8h7a3 3 0 0 1 0 6H7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </button>
      <button class="quiet" title="Redo" aria-label="Redo">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M9.5 4.5 13 8l-3.5 3.5M13 8H6a3 3 0 0 0 0 6h3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </button>
      <span class="divider"></span>
      <button
        class="quiet"
        title="Light/dark mode"
        aria-label="Light/dark mode"
        onclick={() => (theme = theme === "dark" ? "light" : "dark")}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" />
          <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
        </svg>
      </button>
      {#if !sidebarOpen}
        <span class="divider"></span>
        <button
          class="panel-toggle"
          title="Show panel"
          aria-label="Show panel"
          onclick={() => (sidebarOpen = true)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect
              x="1.5"
              y="2.5"
              width="13"
              height="11"
              fill="none"
              stroke="currentColor"
            />
            <rect x="9.5" y="4" width="3.5" height="8" fill="currentColor" />
          </svg>
        </button>
      {/if}
    </div>
  </header>

  <Stage />

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
