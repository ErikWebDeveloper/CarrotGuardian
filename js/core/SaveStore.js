/**
 * SaveStore.js
 * localStorage persistence for settings and records (AGENTS.md 64).
 * Entirely optional: if storage is unavailable the game runs fine in-memory.
 */

import { STORAGE_KEY } from "./Config.js";

const DEFAULTS = {
  music: true,
  sfx: true,
  shadows: true,
  quality: "auto",
  touch: null,          // null = auto-detect
  bestWave: 0,
  bestScore: 0,
  gamesPlayed: 0
};

export class SaveStore {
  constructor(key = STORAGE_KEY) {
    this.key = key;
    this.available = this._probe();
    this.data = { ...DEFAULTS, ...this._read() };
  }

  _probe() {
    try {
      const k = "__cg_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  _read() {
    if (!this.available) return {};
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _write() {
    if (!this.available) return;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      /* quota or private mode - ignore */
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this._write();
  }

  /** Records a finished run, keeping the bests. */
  recordRun(wave, score) {
    this.data.gamesPlayed = (this.data.gamesPlayed ?? 0) + 1;
    if (wave > (this.data.bestWave ?? 0)) this.data.bestWave = wave;
    if (score > (this.data.bestScore ?? 0)) this.data.bestScore = score;
    this._write();
    return {
      bestWave: this.data.bestWave,
      bestScore: this.data.bestScore,
      newBestWave: wave >= this.data.bestWave,
      newBestScore: score >= this.data.bestScore
    };
  }
}