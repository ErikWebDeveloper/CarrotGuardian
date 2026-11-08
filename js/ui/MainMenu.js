/**
 * MainMenu.js
 * Loading screen, title screen and the options panel.
 *
 * All of it is keyboard navigable (AGENTS.md 62) and every button is a real
 * <button> so focus rings and Enter/Space come for free.
 */

export class MainMenu {
  /**
   * @param {import("../core/SaveStore.js").SaveStore} store
   * @param {{onPlay:Function, onOptionChange:Function}} hooks
   */
  constructor(store, hooks = {}) {
    this.store = store;
    this.hooks = hooks;

    this.el = {
      loading: document.getElementById("loading-screen"),
      loadingFill: document.getElementById("loading-fill"),
      loadingStatus: document.getElementById("loading-status"),
      menu: document.getElementById("main-menu"),
      best: document.getElementById("menu-best"),
      options: document.getElementById("options-panel"),
      optMusic: document.getElementById("opt-music"),
      optSfx: document.getElementById("opt-sfx"),
      optTouch: document.getElementById("opt-touch"),
      optShadows: document.getElementById("opt-shadows"),
      optQuality: document.getElementById("opt-quality")
    };

    this._bind();
    this.refreshBest();
  }

  /* ------------------------------------------------------------ */

  _bind() {
    document.getElementById("btn-play").addEventListener("click", () => {
      this.hooks.onPlay?.();
    });
    document.getElementById("btn-options").addEventListener("click", () => this.toggleOptions(true));
    document.getElementById("btn-options-close").addEventListener("click", () => this.toggleOptions(false));

    const emit = (key) => (e) => {
      this.store.set(key, e.target.checked);
      this.hooks.onOptionChange?.(key, e.target.checked);
    };
    this.el.optMusic.addEventListener("change", emit("music"));
    this.el.optSfx.addEventListener("change", emit("sfx"));
    this.el.optShadows.addEventListener("change", emit("shadows"));
    this.el.optTouch.addEventListener("change", (e) => {
      this.store.set("touch", e.target.checked);
      this.hooks.onOptionChange?.("touch", e.target.checked);
    });
    this.el.optQuality.addEventListener("change", (e) => {
      this.store.set("quality", e.target.value);
      this.hooks.onOptionChange?.("quality", e.target.value);
    });

    // Escape closes the options panel.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.el.options.hidden) this.toggleOptions(false);
    });
  }

  /** Push stored settings into the controls. */
  syncFromStore(defaultTouch) {
    const s = this.store;
    this.el.optMusic.checked = s.get("music") !== false;
    this.el.optSfx.checked = s.get("sfx") !== false;
    this.el.optShadows.checked = s.get("shadows") !== false;
    this.el.optTouch.checked = s.get("touch") === null ? defaultTouch : s.get("touch");
    this.el.optQuality.value = s.get("quality") ?? "auto";
  }

  /* ------------------------------------------------------------ */

  /** @param {number} fraction @param {string} label */
  setLoading(fraction, label) {
    this.el.loadingFill.style.width = `${Math.round(fraction * 100)}%`;
    if (label) this.el.loadingStatus.textContent = label;
    const bar = this.el.loadingFill.parentElement;
    bar?.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
  }

  hideLoading() {
    this.el.loading.classList.remove("is-active");
    this.el.loading.setAttribute("hidden", "");
  }

  showMenu() {
    this.el.menu.classList.add("is-active");
    this.refreshBest();
    // Put keyboard focus on Play so Enter starts the game straight away.
    requestAnimationFrame(() => document.getElementById("btn-play")?.focus());
  }

  hideMenu() {
    this.el.menu.classList.remove("is-active");
    this.toggleOptions(false);
  }

  refreshBest() {
    const wave = this.store.get("bestWave") ?? 0;
    const score = this.store.get("bestScore") ?? 0;
    if (!this.el.best) return;
    this.el.best.textContent =
      wave > 0 ? `Best: wave ${wave} · ${score} pts` : "New gardener!";
  }

  toggleOptions(open) {
    this.el.options.hidden = !open;
    if (open) requestAnimationFrame(() => this.el.optMusic?.focus());
  }
}