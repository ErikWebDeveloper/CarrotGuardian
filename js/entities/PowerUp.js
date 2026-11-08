/**
 * PowerUp.js
 * A floating buff pickup: speed, power or range.
 *
 * Collect by touch. Effects are temporary by default (AGENTS.md 24) so the
 * moment-to-moment play keeps changing.
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { clamp } from "../utils/MathUtils.js";

export class PowerUp {
  /** @param {object} models */
  constructor(models) {
    this.root = new THREE.Group();
    this.root.visible = false;
    this.position = new THREE.Vector3();
    this.def = null;
    this.active = false;
    this._t = 0;
    this._life = 0;
    this._collecting = 0;
    this._views = {};
    this._models = models;
  }

  _view(id) {
    if (!this._views[id]) {
      const def = GAME_CONFIG.powerUp[id];
      const built = this._models[`powerup.${id}`];
      if (!built) return null;
      this._views[id] = built.root.clone(true);
    }
    return this._views[id].clone(true);
  }

  /** @param {'speed'|'strength'|'range'} id */
  spawn(position, id) {
    const def = GAME_CONFIG.powerUp[id];
    if (!def) return false;

    this.root.remove(this._current);
    const view = this._view(id);
    if (!view) return false;

    this.def = def;
    this.id = id;
    this._current = view;
    this._spin = view.getObjectByName("spin");
    this._glow = view.children.find((c) => c.isMesh) ?? null;
    this.root.add(view);

    this.position.copy(position);
    this.root.position.set(position.x, 0, position.z);
    this.root.visible = true;
    this.root.scale.setScalar(0.01);
    this.active = true;
    this._t = Math.random() * 6;
    this._life = GAME_CONFIG.powerUp.lifetime;
    this._collecting = 0;
    this._pop = 0;
    return true;
  }

  despawn() {
    this.active = false;
    this.root.visible = false;
    this.def = null;
  }

  /** Start the collection animation; `onDone` fires when it finishes. */
  collect(onDone) {
    if (!this.active || this._collecting > 0) return;
    this._collecting = 0.0001;
    this._onDone = onDone;
  }

  get isCollecting() {
    return this._collecting > 0;
  }

  get expired() {
    return this.active && this._collecting <= 0 && this._life <= 0;
  }

  update(dt) {
    if (!this.active) return;
    this._t += dt;
    this._pop = Math.min(1, this._pop + dt / 0.32);

    if (this._collecting > 0) {
      this._collecting += dt;
      const p = clamp(this._collecting / 0.32, 0, 1);
      // Shoot up and shrink away.
      this.root.position.y = p * 1.6;
      this.root.scale.setScalar(Math.max(0.01, (1 - p) * this._popEase()));
      this._spin.rotation.y += dt * 14;
      if (p >= 1) {
        const cb = this._onDone;
        this._onDone = null;
        this.despawn();
        cb?.();
      }
      return;
    }

    this._life -= dt;

    // Idle float + spin.
    const float = Math.sin(this._t * 2.1) * 0.14 + 0.18;
    this.root.position.set(this.position.x, float, this.position.z);
    this.root.scale.setScalar(this._popEase());
    if (this._spin) {
      this._spin.rotation.y = this._t * 1.9;
      this._spin.rotation.x = Math.sin(this._t * 1.4) * 0.22;
    }

    // Expiry blink. Toggling visibility avoids touching the shared material
    // cache (which every other model of the same colour also uses).
    if (this._life < 3) {
      const on = Math.sin(this._t * (10 + (3 - this._life) * 8)) > -0.2;
      this._current.visible = on;
    } else if (!this._current.visible) {
      this._current.visible = true;
    }
  }

  _popEase() {
    // Overshoot pop when the pickup appears.
    const t = this._pop;
    const c1 = 1.7;
    const c3 = c1 + 1;
    const p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  }
}