/**
 * Hole.js
 * A rabbit hole and its state machine.
 *
 *   CLOSED  ──open()──▶ OPEN ──beginSpawn()──▶ SPAWNING ──emit──▶ OPEN
 *      ▲                  │                                            │
 *      └────── close() ◀──┴────────────────────────────────────────────┘
 *                       │
 *                       ▼
 *                   COOLDOWN ──(timer)──▶ CLOSED
 *
 * Both states are visible at a glance: an open hole is a dark pit with a
 * raised dirt rim, a closed hole is a covered mound with wooden planks and a
 * mushroom marker (AGENTS.md 14).
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { clamp, damp } from "../utils/MathUtils.js";

export const HoleState = Object.freeze({
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  SPAWNING: "SPAWNING",
  COOLDOWN: "COOLDOWN"
});

export class Hole {
  /**
   * @param {{hole:object, holeSimple:object}} assets
   * @param {{x:number,z:number}} position
   * @param {number} index
   */
  constructor(assets, position, index) {
    // Clone the shared template so all holes share one set of buffers.
    const template = index % 3 === 2 ? assets.holeSimple : assets.hole;
    const root = template.root.clone(true);
    this.parts = {
      openGroup: root.getObjectByName("openGroup"),
      closedGroup: root.getObjectByName("closedGroup")
    };
    root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    this.index = index;
    this.position = new THREE.Vector3(position.x, 0, position.z);
    this.root = root;
    this.root.position.copy(this.position);
    this.root.rotation.y = (index * 0.7) % (Math.PI * 2);

    this.state = HoleState.CLOSED;
    this.radius = GAME_CONFIG.hole.radius;
    /** Set while the close animation is playing, so it cannot be re-triggered. */
    this.isSealing = false;

    this._telegraph = 0;
    this._telegraphDur = GAME_CONFIG.hole.telegraph;
    this._cooldown = 0;
    this._pop = 0;          // 0..1 open animation
    this._wobble = 0;
    this._wobblePhase = index;
    this._onEmit = null;

    this.parts.openGroup.visible = false;
    this.parts.closedGroup.visible = true;
  }

  /** True when the spawn system may pick this hole. */
  canSpawn() {
    return this.state === HoleState.OPEN && !this.isSealing;
  }

  /** True while a rabbit is on its way up. */
  isTelegraphing() {
    return this.state === HoleState.SPAWNING;
  }

  /** True when the player has something to close. */
  isClosable() {
    if (this.isSealing) return false;
    return this.state === HoleState.OPEN || this.state === HoleState.SPAWNING;
  }

  /** Ready to be popped open again once the cooldown elapsed. */
  get isReopenable() {
    return this.state === HoleState.CLOSED;
  }

  /**
   * Reveal the hole. Returns false if it was already open.
   */
  open() {
    if (this.state === HoleState.OPEN || this.state === HoleState.SPAWNING) return false;
    this.state = HoleState.OPEN;
    this.parts.openGroup.visible = true;
    this.parts.closedGroup.visible = false;
    this._pop = 0;
    this._cooldown = 0;
    return true;
  }

  /**
   * Start the "something is coming up" telegraph.
   * @param {() => void} onEmit called when a rabbit should appear
   * @returns {boolean} false if the hole was not ready
   */
  beginSpawn(onEmit) {
    if (!this.canSpawn()) return false;
    this.state = HoleState.SPAWNING;
    this._telegraph = this._telegraphDur;
    this._onEmit = onEmit;
    return true;
  }

  /**
   * Player closes the hole.
   * @returns {boolean} true when this actually closed something
   */
  close() {
    if (!this.isClosable()) return false;
    this.state = HoleState.COOLDOWN;
    this._cooldown = GAME_CONFIG.hole.reopenDelay;
    this._onEmit = null;
    this._telegraph = 0;
    this.parts.openGroup.visible = false;
    this.parts.closedGroup.visible = true;
    this.parts.closedGroup.scale.setScalar(1.35);   // pop in, settles in update()
    return true;
  }

  /** @param {number} dt */
  update(dt, time) {
    // Opening pop with a little overshoot.
    if (this.state === HoleState.OPEN || this.state === HoleState.SPAWNING) {
      if (this._pop < 1) {
        this._pop = Math.min(1, this._pop + dt / 0.28);
        const s = popEase(this._pop);
        this.parts.openGroup.scale.setScalar(s);
      }
    }

    if (this.state === HoleState.SPAWNING) {
      this._telegraph -= dt;
      this._wobble += dt;
      const amp = 0.06 * (1 - clamp(this._telegraph / this._telegraphDur, 0, 1));
      this.root.rotation.z = Math.sin(this._wobble * 22 + this._wobblePhase) * amp;
      const pulse = 1 + Math.sin(this._wobble * 12) * 0.05;
      this.parts.openGroup.scale.set(pulse, 1 / pulse, pulse);
      if (this._telegraph <= 0) {
        this.root.rotation.z = 0;
        const cb = this._onEmit;
        this._onEmit = null;
        this.state = HoleState.OPEN;
        cb?.();
      }
    } else {
      this.root.rotation.z *= 1 - damp(12, dt);
    }

    if (this.state === HoleState.COOLDOWN) {
      this._cooldown -= dt;
      const s = this.parts.closedGroup.scale.x;
      this.parts.closedGroup.scale.setScalar(THREE.MathUtils.lerp(s, 1, damp(14, dt)));
      if (this._cooldown <= 0) {
        this.state = HoleState.CLOSED;
        this._cooldown = 0;
      }
    }

    // Idle breathing on open holes keeps the board alive.
    if (this.state === HoleState.OPEN) {
      const s = 1 + Math.sin(time * 2.2 + this._wobblePhase) * 0.012;
      this.parts.openGroup.scale.set(s, 1, s);
    }
  }

  /** 0..1 progress of the current telegraph, for FX. */
  get telegraphProgress() {
    if (this.state !== HoleState.SPAWNING) return 0;
    return 1 - clamp(this._telegraph / this._telegraphDur, 0, 1);
  }

  reset() {
    this.state = HoleState.CLOSED;
    this.isSealing = false;
    this._telegraph = 0;
    this._cooldown = 0;
    this._pop = 1;
    this._onEmit = null;
    this.root.rotation.z = 0;
    this.parts.openGroup.visible = false;
    this.parts.closedGroup.visible = true;
    this.parts.closedGroup.scale.setScalar(1);
    this.parts.openGroup.scale.setScalar(1);
  }
}

/** Overshoot easing for the opening pop. */
function popEase(t) {
  const c1 = 1.9;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}