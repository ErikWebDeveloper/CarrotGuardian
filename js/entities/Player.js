/**
 * Player.js
 * The gardener.
 *
 * Knows nothing about keyboards, mice or touch - it is handed a movement
 * vector in *screen space* plus a camera basis, and converts that into world
 * motion itself. Attacks are range-based and reported through a callback so
 * CombatSystem owns the actual hit test.
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { clamp, damp, rotateToward, angleDelta } from "../utils/MathUtils.js";

export class Player {
  /** @param {{root:THREE.Group, parts:object}} assets */
  constructor(assets) {
    const cfg = GAME_CONFIG.player;
    this.cfg = cfg;

    const built = assets.root.clone(true);
    this.root = built;
    this.parts = {
      bodyPivot: built.getObjectByName("bodyPivot"),
      torso: built.getObjectByName("torso"),
      head: built.getObjectByName("head"),
      hat: built.getObjectByName("hat"),
      leftLeg: built.getObjectByName("leftLeg"),
      rightLeg: built.getObjectByName("rightLeg"),
      leftArm: built.getObjectByName("leftArm"),
      rightArm: built.getObjectByName("rightArm")
    };
    this.root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    });

    /** World-space position, kept on the root for simplicity. */
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.facing = Math.PI;
    this.radius = cfg.radius;

    this.moveAmount = 0;       // 0 idle .. 1 full speed
    this.isMoving = false;
    this.speedMultiplier = 1;

    this.attackRange = cfg.attackRange;
    this.attackDamage = cfg.attackDamage;

    this._walkPhase = 0;
    this._attackT = -1;        // <0 means not attacking
    this._attackFired = false;
    this._hitFlash = 0;
    this._interactT = -1;
    this._interactFired = false;
    this._t = 0;

    /** Screen -> world basis, refreshed by the Game from the camera. */
    this._screenUp = new THREE.Vector3(0, 0, -1);
    this._screenRight = new THREE.Vector3(1, 0, 0);
    this._worldDir = new THREE.Vector3();

    this._onHit = null;
  }

  /** Camera-relative movement basis so "up" always means "away from camera". */
  setCameraBasis(right, up) {
    this._screenRight.copy(right);
    this._screenUp.copy(up);
  }

  get isAttacking() {
    return this._attackT >= 0;
  }

  get attackCooldownReady() {
    return this._attackT < 0;
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,magnitude:number}} move screen-space input
   * @param {{clampTo:(v:THREE.Vector3)=>THREE.Vector3}} world
   */
  update(dt, move, world) {
    this._t += dt;
    this._updateMovement(dt, move, world);
    this._updateAttack(dt);
    this._updateInteract(dt);
    this._animate(dt);
  }

  /* ------------------------------------------------------------ */

  _updateMovement(dt, move, world) {
    const mag = clamp(move.magnitude, 0, 1);
    this.isMoving = mag > 0.02;
    this.moveAmount += (mag - this.moveAmount) * damp(14, dt);

    if (this.isMoving) {
      this._worldDir
        .copy(this._screenRight)
        .multiplyScalar(move.x)
        .addScaledVector(this._screenUp, move.y);
      if (this._worldDir.lengthSq() > 0.0001) this._worldDir.normalize();

      const speed = this.cfg.speed * this.speedMultiplier * clamp(mag * 1.25, 0, 1);
      this.velocity.copy(this._worldDir).multiplyScalar(speed);
      this.position.addScaledVector(this.velocity, dt);

      // Face the direction of travel.
      const target = Math.atan2(this._worldDir.x, this._worldDir.z);
      this.facing = rotateToward(this.facing, target, this.cfg.turnSpeed * dt);
      this._walkPhase += dt * (7.5 + mag * 4.5) * clamp(speed / this.cfg.speed, 0.4, 1.6);
    } else {
      this.velocity.multiplyScalar(1 - damp(12, dt));
      this._walkPhase *= 1 - damp(6, dt);
    }

    world.clampToBoard(this.position);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;
  }

  /* ------------------------------------------------------------ */

  /**
   * Swing the spade. `onHit` fires once, partway through the animation, at
   * the exact moment the spade would connect.
   * @returns {boolean} false if still on cooldown
   */
  attack(onHit) {
    if (!this.attackCooldownReady) return false;
    this._attackT = 0;
    this._attackFired = false;
    this._onHit = onHit ?? null;
    return true;
  }

  /** Play the "stamp a hole shut" animation. */
  interact() {
    if (this._interactT >= 0) return false;
    this._interactT = 0;
    return true;
  }

  _updateAttack(dt) {
    if (this._attackT < 0) return;
    this._attackT += dt;
    const p = this._attackT / this.cfg.attackDuration;
    if (!this._attackFired && p >= 0.34) {
      this._attackFired = true;
      this._onHit?.();
      this._onHit = null;
    }
    if (this._attackT >= this.cfg.attackDuration) this._attackT = -1;
  }

  _updateInteract(dt) {
    if (this._interactT < 0) return;
    this._attackT = -1;               // stomping takes priority over swinging
    this._interactT += dt;
    if (this._interactT >= this.cfg.holeCloseDuration) this._interactT = -1;
  }

  /* ------------------------------------------------------------ */

  _animate(dt) {
    const walk = this.moveAmount;
    const swing = Math.sin(this._walkPhase);
    const swing2 = Math.sin(this._walkPhase * 2);
    const t = this._t;

    /* --- idle motion --- */
    const idleBreath = Math.sin(t * 1.9) * 0.018;
    const bobY = idleBreath + Math.abs(swing2) * 0.055 * walk;

    /* --- legs --- */
    this.parts.leftLeg.rotation.x = swing * 0.72 * walk;
    this.parts.rightLeg.rotation.x = -swing * 0.72 * walk;

    /* --- arms --- */
    const armSwing = -swing * 0.5 * walk;
    let attackSwing = 0;
    let attackLean = 0;

    if (this._attackT >= 0) {
      // Wind up fast, follow through, settle.
      const p = clamp(this._attackT / this.cfg.attackDuration, 0, 1);
      const curve = Math.sin(p * Math.PI);
      attackSwing = -2.0 * curve;
      attackLean = 0.22 * curve;
    } else if (this._interactT >= 0) {
      const p = clamp(this._interactT / this.cfg.holeCloseDuration, 0, 1);
      const curve = Math.sin(p * Math.PI);
      attackSwing = -0.7 * curve;
      attackLean = 0.16 * curve;
      this.parts.bodyPivot.position.y = -0.12 * curve;
    }

    this.parts.leftArm.rotation.x = armSwing + attackSwing * 0.25;
    this.parts.rightArm.rotation.x = armSwing + attackSwing;
    this.parts.leftArm.rotation.z = 0.06 + walk * 0.05;
    this.parts.rightArm.rotation.z = -0.06 - walk * 0.05;

    if (this._interactT < 0) this.parts.bodyPivot.position.y = bobY;
    this.parts.bodyPivot.position.z = attackLean * 0.25;

    /* --- torso lean while running, head steady --- */
    this.parts.torso.rotation.x = walk * 0.11 + attackLean;
    this.parts.head.rotation.x = -walk * 0.06 - attackLean * 0.5;
    // Slight head lag adds follow-through.
    this.parts.head.rotation.y = Math.sin(t * 0.9) * 0.16 * (1 - walk * 0.6);
    this.parts.hat.rotation.z = Math.sin(t * 1.4) * 0.03 + swing2 * 0.04 * walk;

    /* --- hit / pickup squash --- */
    if (this._hitFlash > 0) {
      this._hitFlash = Math.max(0, this._hitFlash - dt * 3);
      const s = this._hitFlash * 0.18;
      this.parts.bodyPivot.scale.set(1 + s * 0.4, 1 - s, 1 + s * 0.4);
    } else {
      this.parts.bodyPivot.scale.set(1, 1, 1);
    }
  }

  /** Small squash used when the carrot is hit, tying the two together. */
  flinch() {
    this._hitFlash = 1;
  }

  reset() {
    this.position.set(0, 0, -4.5);
    this.velocity.set(0, 0, 0);
    this.facing = 0;
    this.moveAmount = 0;
    this.isMoving = false;
    this.speedMultiplier = 1;
    this.attackRange = this.cfg.attackRange;
    this.attackDamage = this.cfg.attackDamage;
    this._attackT = -1;
    this._interactT = -1;
    this._onHit = null;
    this._hitFlash = 0;
    this.parts.bodyPivot.scale.set(1, 1, 1);
    this.root.position.copy(this.position);
  }
}