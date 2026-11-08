/**
 * HUD.js
 * Everything drawn over the game: carrot health, wave, score, active buffs,
 * wave banner, contextual hints and the debug readout.
 *
 * DOM only - no per-frame layout thrash: values are written with textContent
 * and only when they actually change.
 */

import { GAME_CONFIG, DEBUG } from "../core/Config.js";

export class HUD {
  constructor(root = document) {
    this.el = {
      hud: root.getElementById("hud"),
      carrotPanel: root.getElementById("hud-carrot-panel"),
      carrotFill: root.getElementById("hud-carrot-fill"),
      carrotValue: root.getElementById("hud-carrot-value"),
      wave: root.getElementById("hud-wave-value"),
      score: root.getElementById("hud-score-value"),
      buffs: root.getElementById("hud-buffs"),
      banner: root.getElementById("wave-banner"),
      bannerText: root.getElementById("wave-banner-text"),
      hint: root.getElementById("hint-toast"),
      pause: root.getElementById("btn-pause"),
      debug: root.getElementById("debug-panel")
    };

    this._last = { pct: -1, wave: -1, score: -1 };
    this._chips = new Map();
    this._hintTimer = 0;
    this._bannerTimer = 0;
    this.debugEnabled = DEBUG;
    if (this.el.debug) this.el.debug.hidden = !this.debugEnabled;
  }

  show(on) {
    this.el.hud.classList.toggle("is-active", on);
  }

  /* ------------------------------------------------------------ */

  /**
   * @param {{healthPercent:number, healthState:string}} carrot
   * @param {number} wave
   * @param {number} score
   */
  setStatus(carrot, wave, score) {
    const pct = Math.round(carrot.healthPercent * 100);
    if (pct !== this._last.pct) {
      this._last.pct = pct;
      this.el.carrotFill.style.width = `${pct}%`;
      this.el.carrotValue.textContent = `${pct}%`;
      const panel = this.el.carrotPanel;
      panel.classList.toggle("is-warning", carrot.healthState === "warning");
      panel.classList.toggle("is-critical", carrot.healthState === "critical");
    }

    if (wave !== this._last.wave) {
      this._last.wave = wave;
      this.el.wave.textContent = String(Math.max(1, wave));
    }

    if (score !== this._last.score) {
      this._last.score = score;
      this.el.score.textContent = String(score);
    }
  }

  /** Little kick when the carrot takes a bite. */
  flashDamage() {
    const p = this.el.carrotPanel;
    p.classList.remove("is-hit");
    // Force reflow so the animation restarts.
    void p.offsetWidth;
    p.classList.add("is-hit");
  }

  bumpWave() {
    const w = this.el.wave;
    w.classList.remove("is-bump");
    void w.offsetWidth;
    w.classList.add("is-bump");
  }

  /* ------------------------------------------------------------ */

  /** @param {Array<{id:string,label:string,icon:string,color:string,remaining:number}>} buffs */
  setBuffs(buffs) {
    const seen = new Set();

    for (const b of buffs) {
      seen.add(b.id);
      let chip = this._chips.get(b.id);
      if (!chip) {
        chip = this._createChip(b);
        this._chips.set(b.id, chip);
        this.el.buffs.appendChild(chip.root);
      }
      chip.time.textContent = `${Math.ceil(b.remaining)}s`;
      chip.root.classList.toggle("is-low", b.remaining <= 3);
    }

    for (const [id, chip] of this._chips) {
      if (seen.has(id)) continue;
      chip.root.classList.add("is-leaving");
      const el = chip.root;
      setTimeout(() => el.remove(), 260);
      this._chips.delete(id);
    }
  }

  _createChip(b) {
    const root = document.createElement("div");
    root.className = "buff-chip";
    root.style.setProperty("--buff-color", b.color);

    const icon = document.createElement("span");
    icon.className = "buff-chip__icon";
    icon.textContent = b.icon;

    const label = document.createElement("span");
    label.textContent = b.label;

    const time = document.createElement("span");
    time.className = "buff-chip__time";

    root.append(icon, label, time);
    return { root, time };
  }

  clearBuffs() {
    for (const [, chip] of this._chips) chip.root.remove();
    this._chips.clear();
    this.el.buffs.innerHTML = "";
  }

  /* ------------------------------------------------------------ */

  /** @param {string} text @param {number} seconds */
  showBanner(text, seconds = 1.9) {
    this.el.bannerText.textContent = text;
    this.el.banner.classList.remove("is-show");
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add("is-show");
    this._bannerTimer = seconds;
  }

  /**
   * Contextual coaching hint. Supports <kbd>-like markup via {{key}} tokens.
   * @param {string} html
   * @param {number} [seconds]
   */
  showHint(html, seconds = 4) {
    this.el.hint.innerHTML = html;
    this.el.hint.classList.add("is-show");
    this._hintTimer = seconds;
  }

  hideHint() {
    this.el.hint.classList.remove("is-show");
    this._hintTimer = 0;
  }

  /* ------------------------------------------------------------ */

  setDebug(text) {
    if (!this.debugEnabled || !this.el.debug) return;
    this.el.debug.textContent = text;
  }

  /** @param {number} dt */
  update(dt) {
    if (this._hintTimer > 0) {
      this._hintTimer -= dt;
      if (this._hintTimer <= 0) this.el.hint.classList.remove("is-show");
    }
  }

  reset() {
    this._last = { pct: -1, wave: -1, score: -1 };
    this.clearBuffs();
    this.hideHint();
    this.el.banner.classList.remove("is-show");
  }
}

/** Platform-aware control hints used by the tutorial (AGENTS.md 29). */
export function controlHints(isTouch) {
  return isTouch
    ? "Move with the <span class=\"hint-toast__key\">stick</span>, tap <span class=\"hint-toast__key\">HIT!</span> to attack and <span class=\"hint-toast__key\">CLOSE</span> on a hole."
    : "Move with <span class=\"hint-toast__key\">WASD</span>, attack with <span class=\"hint-toast__key\">Space</span>, close holes with <span class=\"hint-toast__key\">E</span>.";
}

export { GAME_CONFIG };