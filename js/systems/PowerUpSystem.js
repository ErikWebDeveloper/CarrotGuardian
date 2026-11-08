/**
 * PowerUpSystem.js
 * Owns dropped pickups, their timers and how their bonuses apply.
 *
 * Boosts are temporary (AGENTS.md 24) and the system is built so permanent
 * boosts are a one-line change: apply `PERMANENT` instead of a timer.
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { Pool } from "../utils/Pool.js";
import { PowerUp } from "../entities/PowerUp.js";
import { distXZ, pick, randRange } from "../utils/MathUtils.js";

const IDS = ["speed", "strength", "range"];

export class PowerUpSystem {
  /**
   * @param {object} deps
   * @param {object} deps.models
   * @param {import("../world/World.js").World} deps.world
   * @param {import("../entities/Player.js").Player} deps.player
   * @param {import("../systems/ParticleSystem.js").ParticleSystem} deps.particles
   */
  constructor({ models, world, player, particles }) {
    this.world = world;
    this.player = player;
    this.particles = particles;
    this.audio = null;
    this.onCollected = null;

    this.pool = new Pool(() => {
      const p = new PowerUp(models);
      world.scene.add(p.root);
      return p;
    }, 2);

    /** id -> remaining seconds */
    this.timers = { speed: 0, strength: 0, range: 0 };
    this.onChange = null;
    this._tmp = new THREE.Vector3();
  }

  get activeCount() {
    return this.pool.activeCount;
  }

  reset() {
    this.pool.releaseAll();
    this.timers = { speed: 0, strength: 0, range: 0 };
    this._applyBonuses();
    this.onChange?.(this.activeBuffs);
  }

  get activeBuffs() {
    return IDS.filter((id) => this.timers[id] > 0).map((id) => ({
      id,
      label: GAME_CONFIG.powerUp[id].label,
      icon: GAME_CONFIG.powerUp[id].icon,
      color: `#${GAME_CONFIG.powerUp[id].color.toString(16).padStart(6, "0")}`,
      remaining: this.timers[id]
    }));
  }

  /** Roll a drop after a rabbit is defeated. */
  maybeDrop(position) {
    if (Math.random() > GAME_CONFIG.powerUp.dropChance) return false;
    if (this.activeCount >= GAME_CONFIG.powerUp.maxActive) return false;
    return this.drop(position);
  }

  drop(position, id = null) {
    const type = id ?? pick(IDS);
    const spot = this._pickSpot(position);
    const pu = this.pool.acquire();
    if (!pu.spawn(spot, type)) {
      this.pool.release(pu);
      return false;
    }
    return true;
  }

  /** Drop slightly offset from the rabbit so it does not hide under it. */
  _pickSpot(origin) {
    const half = GAME_CONFIG.board.half - 1;
    let x = origin.x + randRange(-0.6, 0.6);
    let z = origin.z + randRange(-0.6, 0.6);
    x = Math.max(-half, Math.min(half, x));
    z = Math.max(-half, Math.min(half, z));
    return this._tmp.set(x, 0, z);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    // Timers.
    let changed = false;
    for (const id of IDS) {
      if (this.timers[id] > 0) {
        this.timers[id] = Math.max(0, this.timers[id] - dt);
        if (this.timers[id] === 0) changed = true;
      }
    }
    if (changed) {
      this._applyBonuses();
      this.onChange?.(this.activeBuffs);
    }

    // Active pickups.
    const radius = GAME_CONFIG.powerUp.pickupRadius;
    const magnet = GAME_CONFIG.powerUp.magnetRadius;
    const magnetSpeed = GAME_CONFIG.powerUp.magnetSpeed;
    for (let i = this.pool.active.length - 1; i >= 0; i--) {
      const pu = this.pool.active[i];

      if (pu.expired) {
        this.pool.releaseAt(i);
        continue;
      }

      // Gentle magnet: walking near a buff is enough, no pixel-perfect step.
      if (!pu.isCollecting) {
        const d = distXZ(pu.position, this.player.position);
        if (d < magnet && d > 0.0001) {
          const pull = magnetSpeed * (1 - d / magnet) * dt;
          pu.position.x += ((this.player.position.x - pu.position.x) / d) * pull;
          pu.position.z += ((this.player.position.z - pu.position.z) / d) * pull;
          this.world.clampToBoard(pu.position);
        }
      }

      if (!pu.isCollecting && distXZ(pu.position, this.player.position) <= radius) {
        const id = pu.id;
        pu.collect(() => {
          this.particles.burst("sparkle", pu.position, { count: 8, speed: 2.6, up: 2.4 });
          this.audio?.play("powerup", { gain: 1 });
          this._grant(id, pu.position);
        });
      }

      pu.update(dt);
    }
  }

  _grant(id, position) {
    const def = GAME_CONFIG.powerUp[id];
    this.timers[id] = def.duration;
    this._applyBonuses();
    this.onChange?.(this.activeBuffs);
    this.onCollected?.(id, def, position);
  }

  /** Recompute the player's derived stats from the active timers. */
  _applyBonuses() {
    const cfg = GAME_CONFIG;
    const speed = cfg.powerUp.speed;
    const strength = cfg.powerUp.strength;
    const range = cfg.powerUp.range;

    this.player.speedMultiplier =
      this.timers.speed > 0 ? speed.multiplier : 1;
    this.player.attackDamage =
      cfg.player.attackDamage + (this.timers.strength > 0 ? strength.bonusDamage : 0);
    this.player.attackRange =
      cfg.player.attackRange + (this.timers.range > 0 ? range.bonusRange : 0);
  }
}