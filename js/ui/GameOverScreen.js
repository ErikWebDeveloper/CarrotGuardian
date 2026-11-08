/**
 * GameOverScreen.js
 * Shows the run summary and wires the retry / menu buttons.
 */

export class GameOverScreen {
  /**
   * @param {import("../core/SaveStore.js").SaveStore} store
   * @param {{onRetry:Function, onMenu:Function}} hooks
   */
  constructor(store, hooks = {}) {
    this.store = store;
    this.hooks = hooks;
    this.el = {
      screen: document.getElementById("game-over"),
      wave: document.getElementById("over-wave"),
      kills: document.getElementById("over-kills"),
      holes: document.getElementById("over-holes"),
      score: document.getElementById("over-score"),
      best: document.getElementById("over-best")
    };

    document.getElementById("btn-retry").addEventListener("click", () => this.hooks.onRetry?.());
    document.getElementById("btn-menu-over").addEventListener("click", () => this.hooks.onMenu?.());
  }

  /**
   * @param {{wave:number, kills:number, holesClosed:number, score:number}} stats
   */
  show(stats) {
    const record = this.store.recordRun(stats.wave, stats.score);

    this.el.wave.textContent = String(stats.wave);
    this.el.kills.textContent = String(stats.kills);
    this.el.holes.textContent = String(stats.holesClosed);
    this.el.score.textContent = String(stats.score);

    const parts = [];
    if (record.newBestScore) parts.push("New high score!");
    else if (record.newBestWave) parts.push("New furthest wave!");
    this.el.best.textContent = parts.join(" ");
    this.el.best.classList.toggle("is-hidden", parts.length === 0);

    this.el.screen.classList.add("is-active");
    requestAnimationFrame(() => document.getElementById("btn-retry")?.focus());
  }

  hide() {
    this.el.screen.classList.remove("is-active");
  }

  get isVisible() {
    return this.el.screen.classList.contains("is-active");
  }
}

/**
 * PauseScreen - small enough to live here rather than in its own file.
 */
export class PauseScreen {
  /** @param {{onResume:Function,onRestart:Function,onMenu:Function}} hooks */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.el = document.getElementById("pause-screen");

    document.getElementById("btn-resume").addEventListener("click", () => this.hooks.onResume?.());
    document.getElementById("btn-restart-pause").addEventListener("click", () => this.hooks.onRestart?.());
    document.getElementById("btn-menu-pause").addEventListener("click", () => this.hooks.onMenu?.());
  }

  show() {
    this.el.classList.add("is-active");
    requestAnimationFrame(() => document.getElementById("btn-resume")?.focus());
  }

  hide() {
    this.el.classList.remove("is-active");
  }

  get isVisible() {
    return this.el.classList.contains("is-active");
  }
}