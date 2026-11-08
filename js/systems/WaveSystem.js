/**
 * WaveSystem.js
 * Owns pacing: how many rabbits, how fast, how long the breather is, and when a
 * wave is finished.
 *
 *   IDLE ─▶ LEAD_IN ─▶ ACTIVE ─▶ CLEARING ─▶ INTERMISSION ─▶ LEAD_IN(2) …
 *
 * Difficulty ramps by raising one axis at a time rather than everything at
 * once (AGENTS.md 25):
 *   wave 1-2  -> more rabbits
 *   wave 3-6  -> faster rabbits
 *   wave 7+   -> more holes open, then faster spawns
 *   wave 16+  -> tougher rabbits
 */

import { GAME_CONFIG } from "../core/Config.js";

export const WavePhase = Object.freeze({
  IDLE: "IDLE",
  LEAD_IN: "LEAD_IN",
  ACTIVE: "ACTIVE",
  CLEARING: "CLEARING",
  INTERMISSION: "INTERMISSION"
});

export class WaveSystem {
  /**
   * @param {{onWaveStart?:Function,onWaveClear?:Function}} hooks
   */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.phase = WavePhase.IDLE;
    this.timer = 0;
    this.toSpawn = 0;
    this.spawnedThisWave = 0;
    this.speedScale = 1;
    this.waveTotal = 0;
  }

  start() {
    this.reset();
    this._beginWave();
  }

  get isRunning() {
    return this.phase !== WavePhase.IDLE;
  }

  /** Seconds until the next wave begins (intermission only). */
  get intermissionRemaining() {
    return this.phase === WavePhase.INTERMISSION ? Math.max(0, this.timer) : 0;
  }

  /* --- difficulty curves --- */

  countFor(wave) {
    const cfg = GAME_CONFIG.wave;
    return Math.min(cfg.maxCount, cfg.baseCount + (wave - 1) * cfg.countPerWave);
  }

  speedFor(wave) {
    const cfg = GAME_CONFIG.wave;
    return Math.min(cfg.maxSpeedMultiplier, 1 + (wave - 1) * cfg.speedPerWave);
  }

  /** How many holes should be available at once this wave. */
  openHolesFor(wave) {
    if (wave <= 1) return 2;
    if (wave <= 3) return 3;
    if (wave <= 5) return 4;
    if (wave <= 8) return 5;
    if (wave <= 12) return 6;
    return Math.min(8, 6 + Math.floor((wave - 12) / 3));
  }

  intervalFor(wave) {
    const cfg = GAME_CONFIG.spawn;
    return Math.max(cfg.minInterval, cfg.maxInterval - (wave - 1) * cfg.intervalDecay);
  }

  /** Rabbit HP, so late waves still take a couple of hits. */
  healthFor(wave) {
    if (wave < 16) return 1;
    if (wave < 24) return 2;
    return 3;
  }

  /**
   * Bite damage ramps slowly. Wave 1 must feel gentle (AGENTS.md 55), so the
   * carrot only starts taking real nibbles once the player has seen the loop.
   */
  biteFor(wave) {
    const max = GAME_CONFIG.carrot.damagePerBite;
    if (wave <= 2) return Math.max(1, max - 2);
    if (wave <= 5) return Math.max(2, max - 1);
    return max;
  }

  _beginWave() {
    this.wave += 1;
    this.phase = WavePhase.LEAD_IN;
    this.timer = GAME_CONFIG.wave.leadIn;
    this.toSpawn = this.countFor(this.wave);
    this.waveTotal = this.toSpawn;
    this.spawnedThisWave = 0;
    this.speedScale = this.speedFor(this.wave);

    this.hooks.onWaveStart?.(this.wave, {
      total: this.toSpawn,
      openHoles: this.openHolesFor(this.wave),
      health: this.healthFor(this.wave)
    });
  }

  /**
   * @param {number} dt
   * @param {{rabbitsAlive:number}} ctx
   */
  update(dt, ctx) {
    switch (this.phase) {
      case WavePhase.LEAD_IN:
        // Breathing room so the player can read the field before rabbits pop.
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.phase = WavePhase.ACTIVE;
        }
        break;

      case WavePhase.INTERMISSION:
        this.timer -= dt;
        if (this.timer <= 0) this._beginWave();
        break;

      case WavePhase.ACTIVE:
        // Every rabbit for this wave has left a hole.
        if (this.spawnedThisWave >= this.toSpawn) {
          this.phase = WavePhase.CLEARING;
        }
        break;

      case WavePhase.CLEARING:
        // The wave is only clear once the field is empty again.
        if (ctx.rabbitsAlive === 0) {
          this.hooks.onWaveClear?.(this.wave);
          this.phase = WavePhase.INTERMISSION;
          this.timer = GAME_CONFIG.wave.intermission;
        }
        break;

      default:
        break;
    }
  }

  /** Called by SpawnSystem each time a rabbit actually appears. */
  notifySpawned() {
    this.spawnedThisWave += 1;
  }

  /** True while rabbits should still be appearing. */
  get isSpawning() {
    return this.phase === WavePhase.ACTIVE || this.phase === WavePhase.LEAD_IN;
  }

  /** 0..1 progress through the current wave's spawns. */
  get spawnProgress() {
    if (!this.toSpawn) return 0;
    return Math.min(1, this.spawnedThisWave / this.toSpawn);
  }
}