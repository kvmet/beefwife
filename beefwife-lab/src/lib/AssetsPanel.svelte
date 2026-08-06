<section>
  <div class="section-title"><strong>Shapes</strong><span>4</span></div>
  <div class="asset-grid">
    <button><i class="shape round"></i><span>Round eye</span></button>
    <button><i class="shape spike"></i><span>Shell spike</span></button>
    <button><i class="shape fin"></i><span>Tail fin</span></button>
    <button><i class="shape plate"></i><span>Soft plate</span></button>
  </div>
</section>

<section>
  <div class="section-title"><strong>Materials</strong><span>3</span></div>
  <div class="material-list">
    <button><i class="rust"></i><span>Rust shell</span></button>
    <button><i class="glow"></i><span>Warm glow</span></button>
    <button><i class="ink"></i><span>Ink</span></button>
  </div>
</section>

<style>
  section {
    padding: 16px;
    border-bottom: 1px solid var(--chassis-line);
  }
  .section-title {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .section-title strong {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .section-title span {
    color: var(--faint);
    font-size: 10px;
  }
  .asset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
  }
  .asset-grid button,
  .material-list button {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    background: var(--screen);
    outline-color: var(--bevel-face-screen);
    color: var(--screen-muted);
    font-size: 10px;
  }

  .asset-grid button {
    min-height: 58px;
    flex-direction: column;
    justify-content: center;
  }
  .asset-grid button:hover,
  .material-list button:hover {
    background: #1b212a;
    color: var(--screen-text);
  }
  .shape {
    display: block;
    width: 23px;
    height: 17px;
    background: #a8444a;
  }
  .shape.round {
    width: 17px;
    border-radius: 50%;
    background: #e1b86c;
  }
  .shape.spike {
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
  }
  .shape.fin {
    clip-path: polygon(0 50%, 100% 0, 78% 100%);
  }
  .shape.plate {
    border-radius: 50% 20% 50% 20%;
  }
  .material-list {
    display: grid;
    gap: 6px;
  }
  .material-list button {
    height: 37px;
    padding: 0 10px;
  }
  .material-list i {
    width: 17px;
    height: 17px;
    border: 1px solid #ffffff22;
    border-radius: var(--radius-screen);
  }
  .rust {
    background: #a8444a;
  }
  .glow {
    background: #e1b86c;
    box-shadow: 0 0 3px #e1b86c1f;
  }
  .ink {
    background: #17191d;
  }
</style>
