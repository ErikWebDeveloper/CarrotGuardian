/**
 * CombatSystem.js
 * Player attacks and hole closing.
 *
 * Deliberately simple (AGENTS.md 18 + 19): an area test in a radius, no
 * raycasting, no physics engine, no precise aiming. Every action produces
 * sound, particles and a floating number so the player always knows it landed.
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { distXZ } from "../utils/MathUtils.js";

export class CombatSystem {
  /**
   * @param {object} deps
   * @param {import("../entities/Player.js").Player} deps.player
   * @param {import("../world/World.js").World} deps.world
   * @param {import("../systems/SpawnSystem.js").SpawnSystem} deps.spawns
   * @param {import("../systems/ParticleSystem.js").ParticleSystem} deps.particles
   */
  constructor({ player, world, spawns, particles }) {
    this.player = player;
    this.world = world;
    this.spawns = spawns;
    this.particles = particles;
    this.audio = null;
    this.onScore = null;
    this.onRabbitDefeated = null;
    this.onHoleClosed = null;

    this._interactCooldown = 0;
    /** Hole closing animation waiting on a simulation timer (pause-safe). */
    this._pendingClose = null;
    this._tmp = new THREE.Vector3();
    /** Filled each frame for the touch-attack button state. */
    this.targetsInRange = 0;
  }

  reset() {
    this._interactCooldown = 0;
    this._pendingClose = null;
    this.targetsInRange = 0;
  }

  /**
   * @param {number} dt
   * @param {{attackPressed:boolean, interactPressed:boolean}} input
   */
  update(dt, input) {
    this._interactCooldown = Math.max(0, this._interactCooldown - dt);

    // Finish any hole close that is mid-animation. Driven by dt, so pausing
    // the game pauses this too - unlike setTimeout.
    if (this._pendingClose) {
      this._pendingClose.timer -= dt;
      if (this._pendingClose.timer <= 0) {
        const hole = this._pendingClose.hole;
        this._pendingClose = null;
        this._sealHole(hole);
      }
    }

    if (input.attackPressed) {
      // Only play the swing whoosh when the swing actually happens.
      if (this.player.attack(() => this._resolveSwing())) {
        this.audio?.play("attack", { gain: 0.8 });
      }
    }

    if (input.interactPressed && this._interactCooldown <= 0) {
      this._tryCloseHole();
    }
  }

  /* ------------------------------------------------------------ */

  /** The hit lands at the peak of the spade swing. */
  _resolveSwing() {
    const cfg = GAME_CONFIG.player;
    const pos = this.player.position;
    const range = this.player.attackRange;
    let hits = 0;

    for (const rabbit of this.spawns.rabbits) {
      if (!rabbit.active || !rabbit.isEngaged) continue;
      if (distXZ(pos, rabbit.position) > range) continue;
      hits += 1;
      const killed = rabbit.takeDamage(this.player.attackDamage, {
        from: pos,
        knockback: cfg.attackKnockback
      });
      this.particles.burst("puff", rabbit.position, { count: 3, speed: 1.8, up: 1.1 });
      if (killed) {
        this.particles.burst("star", rabbit.position, { count: 5, speed: 2.6, up: 2.2 });
        this.audio?.play("rabbitDown", { gain: 0.9 });
        this.onRabbitDefeated?.(rabbit);
      } else {
        this.particles.burst("star", rabbit.position, { count: 3, speed: 2.2, up: 1.8 });
        this.audio?.play("hit", { gain: 0.8 });
      }
    }

    if (hits > 0) {
      this.particles.ripple(
        this._tmp.set(pos.x, 0.05, pos.z).clone(),
        0xfff2b0,
        0.9
      );
    } else {
      // Still give a whiff some feedback so the input never feels dropped.
      this.particles.burst("dust", this._tmp.set(pos.x, 0.1, pos.z), {
        count: 3, speed: 1.4, up: 0.7
      });
    }
  }

  _tryCloseHole() {
    const hole = this.world.findClosableHole(this.player.position, this.player.cfg.interactRange);
    if (!hole) {
      this.audio?.play("ui", { gain: 0.4, pitch: 0.7 });
      return;
    }
    if (!this.player.interact()) return;

    this._interactCooldown = GAME_CONFIG.player.interactCooldown + GAME_CONFIG.player.holeCloseDuration;

    // Close slightly after the stomp lands, so the visual matches the action.
    const delay = GAME_CONFIG.player.holeCloseDuration * 0.55;
    this._pendingClose = { hole, timer: delay };
    hole.isSealing = true;
  }

  _sealHole(hole) {
    // Clear the guard first: it is what made the hole un-closable.
    hole.isSealing = false;
    if (!hole.isClosable()) return;
    hole.close();
    this.particles.burst("dust", hole.position, { count: 9, speed: 2.4, up: 1.4 });
    this.particles.burst("dirt", hole.position, { count: 5, speed: 2, up: 2.2 });
    this.particles.ripple(hole.position.clone(), 0x8ad46b, 1.3);
    this.audio?.play("holeClose", { gain: 1 });
    this.onHoleClosed?.(hole);
  }

  /**
   * How many rabbits are inside the spade's reach right now. Used to light up
   * the touch attack button so the player knows when hitting will do something.
   */
  probeTargets() {
    let n = 0;
    const range = this.player.attackRange;
    for (const rabbit of this.spawns.rabbits) {
      if (rabbit.active && rabbit.isEngaged && distXZ(this.player.position, rabbit.position) <= range) n++;
    }
    this.targetsInRange = n;
    return n;
  }
}