/**
 * AssetManager.js
 * Single entry point for every asset in the game.
 *
 * Strategy:
 *  1. Look for `assets/models/manifest.json`. If present, load the referenced
 *     .glb files with GLTFLoader, normalise their scale/orientation/materials
 *     and cache the result.
 *  2. Otherwise (the default - the project ships zero binaries) fall back to
 *     the procedural low-poly factories in `models/Models.js`.
 *
 * Either way `load()` resolves with the same keyed model set, so nothing
 * downstream needs to know where the art came from, and a broken asset can
 * never take the game down (AGENTS.md 42 + 60).
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as Models from "../models/Models.js";
import { GAME_CONFIG } from "./Config.js";

/** Keys the game expects to receive. */
const MODEL_KEYS = ["player", "rabbit", "carrot", "hole", "powerup.speed", "powerup.strength", "powerup.range"];

/** Fallback target heights (world units) used when normalising imported GLBs. */
const TARGET_HEIGHTS = {
  player: 1.75,
  rabbit: 1.05,
  carrot: 2.4,
  hole: 0.4
};

export class AssetManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.models = {};
    /** Errors are reported but never thrown - the game keeps running. */
    this.errors = [];
    this.usedExternalModels = false;
  }

  /**
   * @param {(fraction:number, label:string)=>void} [onProgress]
   */
  async load(onProgress) {
    const steps = [
      ["Reading art manifest", () => this._loadManifest()],
      ["Growing the garden", () => this._buildScenery()],
      ["Waking the rabbits", () => this._buildCharacters()],
      ["Picking the carrot", () => this._buildObjective()]
    ];

    for (let i = 0; i < steps.length; i++) {
      const [label, fn] = steps[i];
      onProgress?.(i / steps.length, `${label}…`);
      // Yield to the browser so the loading bar actually paints.
      await new Promise((r) => setTimeout(r, 0));
      fn();
    }

    // Give any GLTF that did arrive a chance to replace the procedural build.
    onProgress?.(0.95, "Polishing models…");
    await new Promise((r) => setTimeout(r, 0));
    await this._applyExternalModels();

    onProgress?.(1, "Ready!");
    return this.models;
  }

  /* ------------------------------------------------------------ */

  async _loadManifest() {
    this.manifest = null;
    try {
      const res = await fetch("assets/models/manifest.json", { cache: "no-cache" });
      if (!res.ok) return;               // expected: no external art shipped
      const json = await res.json();
      this.manifest = json && typeof json === "object" ? json : null;
    } catch {
      this.manifest = null;              // offline / file:// - stay procedural
    }
  }

  _buildScenery() {
    const M = this.models;
    M.tree = Models.createTree(0);
    M.tree2 = Models.createTree(1);
    M.bush = Models.createBush(0);
    M.bush2 = Models.createBush(1);
    M.bush3 = Models.createBush(2);
    M.flowerPink = Models.createFlower(0xf58fb1);
    M.flowerYellow = Models.createFlower(0xffd166);
    M.flowerWhite = Models.createFlower(0xfdf6e6);
    M.flowerBlue = Models.createFlower(0x8fd3f4);
    M.rock = Models.createRock();
    M.mushroom = Models.createMushroom();
    M.log = Models.createLog();
    M.wateringCan = Models.createWateringCan();
    M.fencePost = Models.createFencePost();
    M.fenceRail = Models.createFenceRail(2.2);
    M.sign = Models.createSign("CARROT PATCH");
    M.grassBlade = Models.createGrassBladeGeometry();
  }

  _buildCharacters() {
    this.models.player = Models.createPlayer();
    this.models.rabbit = Models.createRabbit({ tint: 0 });
    this.models.rabbitTint = Models.createRabbit({ tint: 1 });
    this.models.rabbitGrey = Models.createRabbit({ tint: 2 });
  }

  _buildObjective() {
    this.models.carrot = Models.createCarrot();
    this.models.hole = Models.createHole({ detailed: true });
    this.models.holeSimple = Models.createHole({ detailed: false });

    const P = GAME_CONFIG.powerUp;
    for (const id of ["speed", "strength", "range"]) {
      this.models[`powerup.${id}`] = Models.createPowerUp(P[id]);
    }
  }

  /* ------------------------------------------------------------ */

  /**
   * Load + normalise every model listed in the manifest. Anything that fails
   * is logged and left as the procedural fallback.
   */
  async _applyExternalModels() {
    if (!this.manifest || !this.manifest.models) return;

    // A null/empty value in the manifest means "use the procedural model".
    const entries = Object.entries(this.manifest.models).filter(
      ([, url]) => typeof url === "string" && url.trim() !== ""
    );
    if (entries.length === 0) return;

    const results = await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const gltf = await this._loadGLTF(url);
          return [key, this._normalize(gltf, TARGET_HEIGHTS[key.split(".")[0]])];
        } catch (err) {
          this.errors.push(`Failed to load ${url}: ${err.message}`);
          console.warn(`[AssetManager] failed to load ${url}`, err);
          return null;
        }
      })
    );

    for (const r of results) {
      if (!r) continue;
      const [key, root] = r;
      this.models[key] = { root, parts: {} };
      this.usedExternalModels = true;
    }
    if (this.usedExternalModels) {
      console.info("[AssetManager] using external models for:", MODEL_KEYS.filter((k) => this.models[k]?.isExternal));
    }
  }

  _loadGLTF(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    const p = new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, (err) => reject(new Error(err?.message || "network error")));
    });
    this.cache.set(url, p);
    return p;
  }

  /**
   * Normalise an imported model so it drops straight into the game:
   * correct scale, standing on Y=0, centred on X/Z, +Z facing, materials
   * converted to the stylised Lambert look, shadows enabled.
   */
  _normalize(gltf, targetHeight = 1.5) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    // Uniform scale, then stand the model on Y = 0, then centre it on X/Z.
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0.0001) {
      const k = targetHeight / size.y;
      root.scale.multiplyScalar(k);
      root.position.sub(new THREE.Vector3(0, box.min.y * k, 0));
    }
    root.updateMatrixWorld(true);

    const box2 = new THREE.Box3().setFromObject(root);
    root.position.x -= (box2.min.x + box2.max.x) / 2;
    root.position.z -= (box2.min.z + box2.max.z) / 2;

    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const src = o.material;
      if (!src) return;
      // Convert to the flat Lambert look used by the procedural art.
      const m = new THREE.MeshLambertMaterial({
        color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
        transparent: !!src.transparent,
        opacity: src.opacity ?? 1,
        flatShading: true,
        side: THREE.FrontSide
      });
      o.material = m;
      o.castShadow = true;
    });

    root.userData.isExternal = true;
    return root;
  }

  /* ------------------------------------------------------------ */

  get(key) {
    const m = this.models[key];
    if (!m) throw new Error(`[AssetManager] unknown asset "${key}"`);
    return m.root ?? m;
  }

  report() {
    if (!this.errors.length) return "all assets ok";
    return `${this.errors.length} asset error(s):\n` + this.errors.join("\n");
  }
}