/**
 * World.js
 * Owns the scene graph of the diorama: lights, board, carrot and rabbit holes,
 * plus the spatial queries the gameplay systems rely on.
 */

import * as THREE from "three";
import { GAME_CONFIG, HOLE_POSITIONS } from "../core/Config.js";
import { Board } from "./Board.js";
import { Carrot } from "./Carrot.js";
import { Hole, HoleState } from "./Hole.js";
import { distXZ } from "../utils/MathUtils.js";

export class World {
  /**
   * @param {import("../core/AssetManager.js").AssetManager} assets
   * @param {{shadows:boolean, shadowMapSize:number, decorationDensity:number, grassBlades:number, maxActiveRabbits:number}} quality
   */
  constructor(assets, quality) {
    this.assets = assets;
    this.quality = quality;
    this.scene = new THREE.Scene();
    const sky = this._makeSkyColor();
    this.scene.background = sky;
    // Light aerial haze. The ortho camera sits ~42 units out, so this only
    // softens the far edge of the table and never washes out the board.
    this.scene.fog = new THREE.Fog(sky.getHex(), 48, 92);

    this._makeLights();

    this.board = new Board(assets.models, {
      holes: HOLE_POSITIONS,
      decorationDensity: quality.decorationDensity,
      grassBlades: quality.grassBlades
    });
    this.scene.add(this.board.root);

    this.carrot = new Carrot(assets.models.carrot);
    this.scene.add(this.carrot.root);

    this.holes = HOLE_POSITIONS.map((p, i) => new Hole(assets.models, p, i));
    for (const h of this.holes) this.scene.add(h.root);

    this.time = 0;
    this._tmp = new THREE.Vector3();
  }

  /* ------------------------------------------------------------ */

  _makeSkyColor() {
    return new THREE.Color(0x9fdcf5);
  }

  _makeLights() {
    const cfg = GAME_CONFIG.board;

    // Hemisphere light gives the soft "miniature model on a sunny table" feel
    // and keeps shadowed sides coloured rather than black.
    const hemi = new THREE.HemisphereLight(0xfff6e2, 0x6fae4c, 1.45);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0cc, 2.05);
    sun.position.set(11, 18, 9);
    sun.castShadow = this.quality.shadows;
    const s = this.quality.shadowMapSize;
    sun.shadow.mapSize.set(s, s);
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 60;
    const r = cfg.size * 0.72;
    sun.shadow.camera.left = -r;
    sun.shadow.camera.right = r;
    sun.shadow.camera.top = r;
    sun.shadow.camera.bottom = -r;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // A soft fill from the opposite side so nothing reads as pure silhouette.
    const fill = new THREE.DirectionalLight(0xdcefff, 0.42);
    fill.position.set(-9, 8, -11);
    this.scene.add(fill);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.16));
  }

  /* ------------------------------------------------------------ */
  /* Queries                                                      */
  /* ------------------------------------------------------------ */

  /** Nearest closable hole within `range`, or null. */
  findClosableHole(position, range) {
    let best = null;
    let bestD = range;
    for (const h of this.holes) {
      if (!h.isClosable()) continue;
      const d = distXZ(position, h.position);
      if (d <= bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /** All holes that are currently open and thus able to spawn. */
  get openHoles() {
    return this.holes.filter((h) => h.canSpawn());
  }

  /** All holes the player could interact with (for hints). */
  closableHoles() {
    return this.holes.filter((h) => h.isClosable());
  }

  /** True when a point sits on the playable field. */
  isOnBoard(position) {
    const h = GAME_CONFIG.board.half;
    return Math.abs(position.x) <= h && Math.abs(position.z) <= h;
  }

  /**
   * Pick a spawn spot that is inside the field, away from the carrot and not
   * directly under the player (AGENTS.md 53).
   * @param {THREE.Vector3} playerPos
   */
  safeSpawnPoint(playerPos) {
    const minR = GAME_CONFIG.board.carrotClearRadius + 0.6;
    const maxR = GAME_CONFIG.board.half - 1.2;
    let x = 0;
    let z = 0;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      const dCarrot = Math.hypot(x, z);
      const dPlayer = playerPos ? Math.hypot(x - playerPos.x, z - playerPos.z) : Infinity;
      if (dCarrot >= minR && dPlayer > 2.6) break;
    }
    return this._tmp.set(x, 0, z);
  }

  /** Clamp a position to the playable field. */
  clampToBoard(position) {
    const h = GAME_CONFIG.board.half;
    position.x = Math.max(-h, Math.min(h, position.x));
    position.z = Math.max(-h, Math.min(h, position.z));
    return position;
  }

  /* ------------------------------------------------------------ */

  /** Called when a fresh run begins. */
  reset() {
    this.carrot.reset();
    for (const h of this.holes) h.reset();
  }

  update(dt) {
    this.time += dt;
    this.board.update(dt, this.time);
    this.carrot.update(dt);
    for (const h of this.holes) h.update(dt, this.time);
  }

  dispose() {
    this.board.dispose();
  }
}

export { HoleState };