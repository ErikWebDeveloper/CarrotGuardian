/**
 * SpawnSystem.js
 * Decides *which* hole a rabbit comes out of and *when*.
 *
 * Rules (AGENTS.md 26 + 53):
 *  - never spawn on top of the player
 *  - only ever use holes that are open
 *  - never exceed the active rabbit cap
 *  - stagger spawns instead of dumping a wave at once
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { Pool } from "../utils/Pool.js";
import { Rabbit } from "../entities/Rabbit.js";
import { randRange, shuffled, clamp } from "../utils/MathUtils.js";

export class SpawnSystem {
  /**
   * @param {object} deps
   * @param {object} deps.models AssetManager.models
   * @param {import("../world/World.js").World} deps.world
   * @param {import("../systems/WaveSystem.js").WaveSystem} deps.waves
   * @param {import("../systems/ParticleSystem.js").ParticleSystem} deps.particles
   * @param {number} deps.maxActive
   */
  constructor({ models, world, waves, particles, maxActive }) {
    this.world = world;
    this.waves = waves;
    this.particles = particles;
    this.maxActive = maxActive ?? GAME_CONFIG.rabbit.maxActive;

    this.pool = new Pool(() => {
      const r = new Rabbit(models);
      world.scene.add(r.root);
      return r;
    }, 6);

    this._interval = 1.5;
    this._timer = 0;
    this._telegraphing = 0;    // holes currently rumbling
    this._openTarget = 0;
    this._tmp = new THREE.Vector3();
  }

  get rabbits() {
    return this.pool.active;
  }

  get activeCount() {
    return this.pool.active.length;
  }

  reset() {
    for (const r of this.pool.active) r.despawn();
    this.pool.releaseAll();
    this._telegraphing = 0;
    this._timer = 0;
    this._openTarget = 0;
  }

  /**
   * Open `count` holes for the wave, preferring ones the player is not standing
   * on.
   * @param {number} count
   * @param {THREE.Vector3} [playerPos]
   */
  openHoles(count, playerPos) {
    const holes = this.world.holes;
    const candidates = shuffled(holes.filter((h) => h.isReopenable)).sort((a, b) => {
      if (!playerPos) return 0;
      const da = Math.hypot(a.position.x - playerPos.x, a.position.z - playerPos.z);
      const db = Math.hypot(b.position.x - playerPos.x, b.position.z - playerPos.z);
      return db - da;
    });

    let opened = 0;
    for (const h of candidates) {
      if (opened >= count) break;
      if (h.open()) opened += 1;
    }
    this._openTarget = count;
    return opened;
  }

  /** @param {number} dt */
  update(dt, { playerPos, audio, onSpawn }) {
    const wave = this.waves;

    // Keep the desired number of holes available as the player closes them.
    if (this._openTarget > 0) {
      const available = this.world.openHoles.length + this._telegraphing;
      if (available < this._openTarget) {
        const next = shuffled(this.world.holes).find((h) => h.isReopenable);
        if (next?.open()) audio?.play("holeOpen", { gain: 0.5 });
      }
    }

    if (!wave.isSpawning) return;
    if (wave.spawnedThisWave >= wave.toSpawn) return;
    if (this.activeCount >= this.maxActive) return;

    this._interval = wave.intervalFor(wave.wave);
    this._timer -= dt;
    if (this._timer > 0) return;

    const ready = this.world.holes.filter((h) => h.canSpawn());
    if (!ready.length) {
      // Everything is closed or busy - check back shortly.
      this._timer = GAME_CONFIG.spawn.retryInterval;
      return;
    }

    // Choose the hole furthest from the player (with a little randomness).
    const player = playerPos ?? { x: 0, z: 0 };
    let choice = ready[0];
    let best = -Infinity;
    for (const h of ready) {
      const d = Math.hypot(h.position.x - player.x, h.position.z - player.z) + randRange(-1.2, 1.2);
      if (d > best) {
        best = d;
        choice = h;
      }
    }

    const started = choice.beginSpawn(() => {
      this._telegraphing = Math.max(0, this._telegraphing - 1);
      this._emit(choice, playerPos, audio, onSpawn);
    });

    if (started) {
      this._telegraphing += 1;
      audio?.play("spawn", { gain: 0.5 });
      this.particles?.burst("dirt", choice.position, { count: 5, speed: 1.6, up: 1.6 });
      this._timer = this._interval;
    } else {
      this._timer = GAME_CONFIG.spawn.retryInterval;
    }
  }

  _emit(hole, playerPos, audio, onSpawn) {
    if (this.activeCount >= this.maxActive) return;
    const wave = this.waves;

    // Spawn at the hole mouth (never under the player).
    const pos = this._tmp.set(hole.position.x, 0, hole.position.z);
    if (playerPos) {
      const d = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
      if (d < 1.2) {
        // Nudge sideways so we never materialise inside the gardener.
        const a = Math.random() * Math.PI * 2;
        pos.x += Math.cos(a) * 1.2;
        pos.z += Math.sin(a) * 1.2;
        this.world.clampToBoard(pos);
      }
    }

    const rabbit = this.pool.acquire();
    rabbit.spawn(pos, {
      speedScale: wave.speedScale,
      health: wave.healthFor(wave.wave),
      biteDamage: wave.biteFor(wave.wave),
      tint: Math.floor(Math.random() * 3)
    });

    wave.notifySpawned();
    this.particles?.burst("dust", hole.position, { count: 6, speed: 2.1, up: 1.2 });
    audio?.play("spawn", { gain: 0.4, pitch: 1.1 });
    onSpawn?.(rabbit);
  }
}

export { clamp };