import { mount } from "svelte";
import * as PIXI from "pixi.js";
import App from "./App.svelte";
import "@fontsource/b612-mono/latin-400.css";
import "@fontsource/b612-mono/latin-700.css";
import "@fontsource/b612/latin-400.css";
import "./app.css";
import "./controls.css";

// BeefwifeCanvas is intentionally shipped by this repository as a classic
// browser bundle. Give it Pixi first, then load the bundle before Svelte can
// mount a canvas component.
window.PIXI = PIXI;
await new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = "/vendor/beefwife-canvas.js";
  script.onload = resolve;
  script.onerror = () => reject(new Error("Unable to load BeefwifeCanvas"));
  document.head.append(script);
});

mount(App, {
  target: document.getElementById("app"),
});
