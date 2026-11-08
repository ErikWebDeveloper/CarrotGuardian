/**
 * Rabbit.js
 * Cute, simple, non-threatening enemy.
 *
 *   EMERGE ──▶ CHASE ──▶ EAT ──▶ CHASE (if knocked back)
 *      │         │        │
 *      └─────────┴────────┴──▶ STUN ──▶ CHASE / DEFEATED
 *
 * Instances are pooled: `spawn()` resets the object instead of allocating a
 * new one, and all rabbits of the same tint share one set of GPU buffers.
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { clamp, damp, distXZ, rotateToward } from "../utils/MathUtils.js";

export const RabbitState = Object.freeze({
  IDLE: "IDLE",
  EMERGE: "EMERGE",
  CHASE: "CHASE",
  EAT: "EAT",
  STUN: "STUN",
  DEFEATED: "DEFEATED"
});

const TINTS = [
  { asset: "rabbit", jump: 1 },
  { asset: "rabbitTint", jump: 1.07 },
  { asset: "rabbitGrey", jump: 0.93 }
];

export class Rabbit {
  /**
   * @param {object} models AssetManager.models
   */
  constructor(models) {
    this.models = models;
    /** All three tints pre-built; one is picked at spawn time. */
    this.views = TINTS.map((t) => this._makeView(models[t.asset]));
    this.root = new THREE.Group();
    this.root.visible = false;
    this.root.name = "rabbit-slot";
    this.active = false;

    this.state = RabbitState.IDLE;
    this.position = new THREE.Vector3();
    this.facing = 0;
    this.radius = GAME_CONFIG.rabbit.radius;

    this.health = 1;
    this.maxHealth = 1;
    this.speed = GAME_CONFIG.rabbit.speed;
    this.tint = 0;

    this._hop = 0;
    this._t = 0;
    this._emerge = 0;
    this._biteTimer = 0;
    this._knock = new THREE.Vector3();
    this._squash = 0;
    this._deathT = 0;
    this._eatWobble = 0;
    this._view = this.views[0];
  }

  _makeView(template) {
    const root = template.root.clone(true);
    root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    });
    return {
      root,
      parts: {
        hop: root.getObjectByName("hop"),
        head: root.getObjectByName("head"),
        earL: root.getObjectByName("earL"),
        earR: root.getObjectByName("earR")
      }
    };
  }

  /** Show the requested tint. Called from the pool factory. */
  setTint(tint) {
    const i = tint % this.views.length;
    if (i === this.tint && this.root.children.includes(this._view.root)) return;
    this.root.remove(this._view.root);
    this._view = this.views[i];
    this.tint = i;
    this.root.add(this._view.root);
  }

  /**
   * @param {THREE.Vector3} position
   * @param {{speedScale?:number, health?:number, tint?:number, hopHeight?:number}} opts
   */
  spawn(position, opts = {}) {
    this.setTint(opts.tint ?? Math.floor(Math.random() * 3));
    this.position.copy(position);
    this.position.y = 0;
    this.root.position.set(position.x, 0, position.z);
    this.root.visible = true;
    this.root.scale.setScalar(1);

    this.maxHealth = opts.health ?? GAME_CONFIG.rabbit.health;
    this.health = this.maxHealth;
    const base = GAME_CONFIG.rabbit.speed * (opts.speedScale ?? 1);
    const jitter = 0.9 + Math.random() * 0.25;
    this.speed = base * jitter * (TINTS[this.tint].jump ?? 1) * 0.5 + base * 0.5;
    this.biteDamage = opts.biteDamage ?? GAME_CONFIG.carrot.damagePerBite;

    this.state = RabbitState.EMERGE;
    this._emerge = 0;
    this._t = Math.random() * 10;
    this._biteTimer = 0;
    this._knock.set(0, 0, 0);
    this._squash = 0;
    this._deathT = 0;
    this._eatWobble = 0;
    this._stunT = 0;
    this._hopHeight = opts.hopHeight ?? 1;
    this.facing = Math.atan2(-position.x, -position.z);
    this.active = true;
  }

  /** Return to the pool. */
  despawn() {
    this.active = false;
    this.state = RabbitState.IDLE;
    this.root.visible = false;
  }

  /**
   * @param {number} dt
   * @param {{carrot:import("../world/Carrot.js").Carrot, others:Rabbit[], onBite:Function}} ctx
   */
  update(dt, ctx) {
    if (!this.active) return;
    this._t += dt;

    switch (this.state) {
      case RabbitState.EMERGE:
        this._updateEmerge(dt);
        break;
      case RabbitState.CHASE:
        this._updateChase(dt, ctx);
        break;
      case RabbitState.EAT:
        this._updateEat(dt, ctx);
        break;
      case RabbitState.STUN:
        this._updateStun(dt, ctx);
        break;
      case RabbitState.DEFEATED:
        this._updateDefeated(dt);
        break;
      default:
        break;
    }

    this._animate(dt);
  }

  /* ------------------------------------------------------------ */

  _updateEmerge(dt) {
    this._emerge += dt;
    const p = clamp(this._emerge / 0.5, 0, 1);
    // Rise out of the hole with an overshoot.
    const e = 1 - Math.pow(1 - p, 3);
    const overshoot = 1 + Math.sin(p * Math.PI) * 0.16;
    this.root.position.set(this.position.x, -1.1 * (1 - e), this.position.z);
    this.root.scale.set(overshoot * 0.7 + 0.3 * e, 0.6 + 0.4 * e, overshoot * 0.7 + 0.3 * e);
    if (p >= 1) {
      this.state = RabbitState.CHASE;
      this.root.position.y = 0;
      this.root.scale.setScalar(1);
    }
  }

  _updateChase(dt, ctx) {
    const carrot = ctx.carrot;
    const target = carrot.root.position;
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const d = Math.hypot(dx, dz) || 1;

    // Reached the carrot: start nibbling.
    if (d <= GAME_CONFIG.rabbit.eatRange) {
      this.state = RabbitState.EAT;
      this._biteTimer = GAME_CONFIG.carrot.biteInterval;
      return;
    }

    const nx = dx / d;
    const nz = dz / d;
    this.position.x += nx * this.speed * dt;
    this.position.z += nz * this.speed * dt;

    // Cheap crowd separation so rabbits do not stack into one blob.
    for (const other of ctx.others) {
      if (other === this || !other.active) continue;
      const ox = this.position.x - other.position.x;
      const oz = this.position.z - other.position.z;
      const dSq = ox * ox + oz * oz;
      const minD = GAME_CONFIG.rabbit.separation;
      if (dSq > 0.0001 && dSq < minD * minD) {
        const dd = Math.sqrt(dSq);
        const push = (minD - dd) * 0.5 * dt * 6;
        this.position.x += (ox / dd) * push;
        this.position.z += (oz / dd) * push;
      }
    }

    // Apply knockback velocity decay.
    if (this._knock.lengthSq() > 0.0001) {
      this.position.x += this._knock.x * dt;
      this.position.z += this._knock.z * dt;
      this._knock.multiplyScalar(1 - damp(6, dt));
    }

    this.facing = rotateToward(this.facing, Math.atan2(nx, nz), 9 * dt);
    this._hop += dt * (6 + this.speed * 1.6);
    this.root.position.set(this.position.x, 0, this.position.z);
    this.root.rotation.y = this.facing;
  }

  _updateEat(dt, ctx) {
    this._eatWobble += dt;
    this._biteTimer -= dt;
    // Keep facing the carrot while chewing.
    const dx = ctx.carrot.root.position.x - this.position.x;
    const dz = ctx.carrot.root.position.z - this.position.z;
    this.facing = rotateToward(this.facing, Math.atan2(dx, dz), 8 * dt);
    this.root.rotation.y = this.facing;

    if (this._biteTimer <= 0) {
      this._biteTimer = GAME_CONFIG.carrot.biteInterval;
      ctx.onBite?.(this);
    }
  }

  _updateStun(dt, ctx) {
    this._knock.multiplyScalar(1 - damp(7, dt));
    this.position.x += this._knock.x * dt;
    this.position.z += this._knock.z * dt;
    this.root.position.set(this.position.x, 0, this.position.z);
    this.root.rotation.y = this.facing;
    this._stunT -= dt;
    if (this._stunT <= 0) this.state = RabbitState.CHASE;
  }

  _updateDefeated(dt) {
    this._deathT += dt;
    const p = clamp(this._deathT / 0.35, 0, 1);
    // Squash flat and spin away.
    this.root.scale.set(1 + p * 0.5, Math.max(0.02, 1 - p * 1.4), 1 + p * 0.5);
    this.root.rotation.y += dt * 9;
    this.root.position.y = p * 0.4;
    if (p >= 1) this.despawn();
  }

  /* ------------------------------------------------------------ */

  /**
   * @param {number} amount
   * @param {{from:THREE.Vector3, knockback?:number}} hit
   * @returns {boolean} true if this hit defeated the rabbit
   */
  takeDamage(amount, hit) {
    if (!this.active || this.state === RabbitState.DEFEATED) return false;
    this.health -= amount;
    this._squash = 1;

    if (hit?.from) {
      const dx = this.position.x - hit.from.x;
      const dz = this.position.z - hit.from.z;
      const d = Math.hypot(dx, dz) || 1;
      const kb = hit.knockback ?? 1.5;
      this._knock.set((dx / d) * kb, 0, (dz / d) * kb);
    }

    if (this.health <= 0) {
      this.state = RabbitState.DEFEATED;
      this._deathT = 0;
      this._knock.set(0, 0, 0);
      return true;
    }

    this.state = RabbitState.STUN;
    this._stunT = GAME_CONFIG.rabbit.hitStun;
    return false;
  }

  /** True once the rabbit has finished popping out of the hole. */
  get isEngaged() {
    return this.active && this.state !== RabbitState.EMERGE && this.state !== RabbitState.DEFEATED;
  }

  /* ------------------------------------------------------------ */

  _animate(dt) {
    const v = this._view;
    if (!this.active) return;

    this._squash = Math.max(0, this._squash - dt * 4);
    const sq = this._squash;

    if (this.state === RabbitState.EMERGE) {
      // handled by _updateEmerge transforms
    } else if (this.state === RabbitState.EAT) {
      // Little chew bob + head dip.
      const chew = Math.sin(this._eatWobble * 11) * 0.5 + 0.5;
      v.parts.hop.position.y = chew * 0.045;
      v.parts.head.position.y = 0.58 - chew * 0.05;
      v.parts.head.rotation.x = 0.28 + chew * 0.22;
      const ear = Math.sin(this._eatWobble * 8) * 0.16;
      v.parts.earL.rotation.z = -0.24 + ear;
      v.parts.earR.rotation.z = 0.24 - ear;
      v.parts.hop.rotation.z = 0;
    } else if (this.state === RabbitState.CHASE) {
      // Hop cycle: squash on the ground, stretch in the air.
      const h = Math.abs(Math.sin(this._hop));
      const lift = Math.max(0, Math.sin(this._hop)) ** 2;
      v.parts.hop.position.y = lift * 0.16 * (this._hopHeight ?? 1);
      const stretch = 1 + lift * 0.14;
      const squash = 1 - lift * 0.1;
      v.parts.hop.scale.set(squash, stretch, squash);
      v.parts.head.position.y = 0.58 + lift * 0.03;
      v.parts.head.rotation.x = -lift * 0.12 + Math.sin(this._hop * 2) * 0.05;
      const flop = Math.sin(this._hop * 0.5) * 0.2 + lift * 0.25;
      v.parts.earL.rotation.z = -0.24 - flop;
      v.parts.earR.rotation.z = 0.24 + flop;
      v.parts.hop.rotation.z = Math.sin(this._hop) * 0.08;
    } else if (this.state === RabbitState.STUN) {
      const t = this._stunT ?? 0;
      v.parts.hop.position.y = 0;
      v.parts.hop.scale.set(1 + sq * 0.3, 1 - sq * 0.35, 1 + sq * 0.3);
      v.parts.head.rotation.x = -0.5 * (1 - t / 0.3);
      v.parts.earL.rotation.z = -0.7;
      v.parts.earR.rotation.z = 0.7;
    } else if (this.state === RabbitState.DEFEATED) {
      v.parts.hop.scale.set(1, 1, 1);
    }

    if (sq > 0 && this.state === RabbitState.CHASE) {
      v.parts.hop.scale.x *= 1 + sq * 0.22;
      v.parts.hop.scale.z *= 1 + sq * 0.22;
      v.parts.hop.scale.y *= 1 - sq * 0.2;
    }
  }

  /** Distance to a point, used by combat. */
  distanceTo(v) {
    return distXZ(this.position, v);
  }
}