/**
 * Carrot.js
 * The thing you are protecting.
 *
 * Owns its health, the damage feedback (squash, shake, leaf shiver, colour
 * shift toward the danger hue) and the ground ring that mirrors its health so
 * the player can read the danger without looking at the HUD.
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { clamp, damp } from "../utils/MathUtils.js";
import { TORUS, mat } from "../models/GeoCache.js";

export class Carrot {
  /**
   * @param {{root:THREE.Group, parts:{bob:THREE.Group, leaves:THREE.Group, ring:THREE.Group}}} assets
   */
  constructor(assets) {
    this.root = assets.root.clone(true);
    this.parts = {
      bob: this.root.getObjectByName("carrotBob"),
      leaves: this.root.getObjectByName("leaves"),
      ring: this.root.getObjectByName("healthRing")
    };
    this.root.position.set(0, 0, 0);
    // Face the camera so the eyes and smile are always readable.
    this.root.rotation.y = -Math.PI / 4;

    this.maxHealth = GAME_CONFIG.carrot.maxHealth;
    this.health = this.maxHealth;
    this.radius = GAME_CONFIG.carrot.radius;
    this.alive = true;

    this._t = 0;
    this._hit = 0;          // damage flash timer
    this._pulse = 0;        // heal flash timer
    this._shake = new THREE.Vector3();
    this._bounce = 0;

    this._buildHealthRing();

    this.onDamaged = null;
    this.onDeath = null;
  }

  _buildHealthRing() {
    const ring = new THREE.Mesh(
      TORUS(1.55, 0.09, 24, 6),
      mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.25 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.ringMesh = ring;
    this.ringMat = ring.material;
    this.parts.ring.add(ring);

    // Full-health reference ring underneath.
    const track = new THREE.Mesh(
      TORUS(1.55, 0.09, 24, 6),
      mat(0x000000, { transparent: true, opacity: 0.12 })
    );
    track.rotation.x = Math.PI / 2;
    track.position.y = 0.015;
    this.parts.ring.add(track);
  }

  get healthPercent() {
    return clamp(this.health / this.maxHealth, 0, 1);
  }

  /** healthy | warning | critical - drives the HUD bar colour. */
  get healthState() {
    if (this.health > 0.5) return "healthy";
    if (this.healthPercent > 0.2) return "warning";
    return "critical";
  }

  /**
   * @param {number} amount
   * @returns {{dealt:number, killed:boolean}}
   */
  takeDamage(amount) {
    if (!this.alive || amount <= 0) return { dealt: 0, killed: false };
    const before = this.health;
    this.health = Math.max(0, this.health - amount);
    const dealt = before - this.health;
    this._hit = 1;
    this._shake.set(
      (Math.random() - 0.5) * 0.34,
      0,
      (Math.random() - 0.5) * 0.34
    );
    this.onDamaged?.(dealt, this.healthPercent);
    if (this.health <= 0 && this.alive) {
      this.alive = false;
      this.onDeath?.();
      return { dealt, killed: true };
    }
    return { dealt, killed: false };
  }

  /** Top the carrot back up (wave reward). @returns {number} health restored */
  heal(amount) {
    if (!this.alive || amount <= 0) return 0;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    if (this.health !== before) this._pulse = 1;
    return this.health - before;
  }

  reset() {
    this.health = this.maxHealth;
    this.alive = true;
    this._hit = 0;
    this._pulse = 0;
    this._shake.set(0, 0, 0);
    this._bounce = 0;
    this.root.visible = true;
    this.parts.bob.scale.setScalar(1);
    this.parts.bob.rotation.set(0, 0, 0);
    this.parts.leaves.rotation.set(0, 0, 0);
    this._syncRing(true);
  }

  /** Death animation: wilt and shrink away. */
  _updateDeath(dt) {
    this._t += dt;
    const t = clamp(this._t / 1.1, 0, 1);
    const s = 1 - t * 0.85;
    this.parts.bob.scale.set(s, s * (1 - t * 0.6), s);
    this.parts.bob.rotation.z = Math.sin(this._t * 14) * 0.12 * (1 - t);
    this.parts.leaves.rotation.x = t * 1.2;
    this.parts.leaves.rotation.z = Math.sin(this._t * 9) * 0.2 * (1 - t);
    this.parts.ring.visible = false;
    if (t >= 1) this.root.visible = false;
  }

  _syncRing(immediate = false) {
    const p = this.healthPercent;
    this._ringP = p;
    const color = p > 0.5 ? 0x8ad46b : p > 0.2 ? 0xffc44d : 0xff6b52;
    this.ringMat.color.setHex(color);
    this.ringMat.emissive.setHex(color);
    this.ringMat.emissiveIntensity = p <= 0.2 ? 0.5 : 0.25;
    if (immediate) this.ringMesh.scale.setScalar(1);
  }

  update(dt) {
    if (!this.alive) {
      this._updateDeath(dt);
      return;
    }

    this._t += dt;
    this._hit = Math.max(0, this._hit - dt * 3.2);
    this._bounce = Math.max(0, this._bounce - dt * 2.6);
    this._pulse = Math.max(0, this._pulse - dt * 2.2);

    // Idle: gentle breathing bob plus leaf sway.
    const bobY = Math.sin(this._t * 1.9) * 0.055;
    this.parts.bob.position.y = bobY + this._bounce * 0.5;
    this.parts.bob.rotation.z = Math.sin(this._t * 1.35) * 0.022;
    this.parts.leaves.rotation.x = Math.sin(this._t * 2.1) * 0.06;
    this.parts.leaves.rotation.z = Math.cos(this._t * 1.6) * 0.06;

    // Damage shake decays.
    this.root.position.x = this._shake.x * this._hit;
    this.root.position.z = this._shake.z * this._hit;

    // Damage squash-and-stretch, plus a soft pulse when healed.
    const sq = this._hit * 0.16;
    const pulse = Math.sin(this._pulse * Math.PI) * 0.1;
    this.parts.bob.scale.set(1 + sq * 0.5 + pulse, 1 - sq + pulse, 1 + sq * 0.5 + pulse);

    // Health ring drains toward the current value.
    this._syncRing();
    const cur = this.ringMesh.scale.x;
    const k = damp(6, dt);
    this.ringMesh.scale.setScalar(Math.max(0.001, cur + (this._ringP - cur) * k));

    // Critical health: the whole plant trembles and glows warmer.
    if (this.healthPercent <= 0.2) {
      const f = (Math.sin(this._t * 14) * 0.5 + 0.5) * (1 - this.healthPercent * 5);
      this.parts.ring.scale.setScalar(1 + f * 0.06);
    } else {
      this.parts.ring.scale.setScalar(1);
    }
  }

  /** Little celebratory hop, used when the carrot survives a wave. */
  celebrate() {
    this._bounce = 1;
  }
}