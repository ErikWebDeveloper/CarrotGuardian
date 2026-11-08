/**
 * Board.js
 * The garden itself: grass slab, soil plinth, picket fence, scattered scenery
 * and a field of wind-swayed grass blades.
 *
 * Decoration rules (AGENTS.md 8): nothing tall ever stands inside the playable
 * area, and nothing is placed on top of a hole or the carrot, so gameplay
 * elements are always the most readable things on screen.
 */

import * as THREE from "three";
import { GAME_CONFIG } from "../core/Config.js";
import { makeRandom, randRange } from "../utils/MathUtils.js";
import { BOX, mat, merger } from "../models/GeoCache.js";

export class Board {
  /**
   * @param {object} assets  AssetManager.models
   * @param {{holes:Array<{position:{x:number,z:number}}>, decorationDensity:number, grassBlades:number}} opts
   */
  constructor(assets, opts) {
    const cfg = GAME_CONFIG.board;
    this.half = cfg.size / 2;
    this.root = new THREE.Group();
    this.root.name = "board";
    this.decorRoot = new THREE.Group();
    this.decorRoot.name = "decor";
    this.root.add(this.decorRoot);
    this.decorEntries = [];

    /** @type {Array<{x:number,z:number,r:number}>} reserved spots we must not decorate */
    this.reserved = [{ x: 0, z: 0, r: cfg.carrotClearRadius }];
    for (const h of opts.holes ?? []) {
      const p = h.position ?? h;          // accepts {x,z} or {position:{x,z}}
      this.reserved.push({ x: p.x, z: p.z, r: 1.5 });
    }

    this._buildTerrain(cfg);
    this._buildFence(cfg, assets);
    this._buildGrass(opts.grassBlades ?? 1200);
    this._buildDecor(assets, opts.decorationDensity ?? 1);
  }

  /* ------------------------------------------------------------ */

  _buildTerrain(cfg) {
    const size = cfg.size;
    const b = merger();

    // Vertical stack, top down: turf at Y = 0 (AGENTS.md 44), soil plinth
    // tucked *under* the turf, table below that. The plinth must never poke
    // above the grass or its top face hides the whole field.
    const turfBottom = -0.34;
    const tableY = -(cfg.baseHeight + 0.32);
    const plinthHeight = Math.max(0.5, tableY - turfBottom);

    // Soil plinth - gives the board its "miniature diorama" edge.
    b.add(BOX(size + 1.4, plinthHeight, size + 1.4), mat(0x5f4028), { y: turfBottom - plinthHeight / 2 });
    // Grass slab, top surface exactly at Y = 0 (AGENTS.md 44).
    b.add(BOX(size, 0.34, size), mat(0x6ec155), { y: -0.17 });
    b.flush(this.root, { castShadow: false, receiveShadow: true });

    // Second, thinner slab in a lighter green reads as sun-bleached turf.
    const patch = merger();
    patch.add(BOX(size - 1.2, 0.06, size - 1.2), mat(0x7fce61), { y: -0.02 });
    patch.flush(this.root, { castShadow: false, receiveShadow: true });

    // A round wooden table top under the diorama. It is only a little bigger
    // than the board so the sky stays visible around it - the whole point is
    // that this reads as a miniature model on a table, not an endless lawn.
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(size * 0.78, 44),
      mat(0xc99a63, { flat: false })
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = tableY;
    table.receiveShadow = true;
    this.root.add(table);

    // Slim darker rim so the table edge reads against the sky.
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(size * 0.75, size * 0.78, 44),
      mat(0x9c6f43, { flat: false })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = tableY + 0.01;
    this.root.add(rim);
  }

  _buildFence(cfg, assets) {
    const half = cfg.fenceHalf;
    const postGeo = assets.fencePost;
    const railProto = assets.fenceRail;

    const posts = new THREE.Group();
    const step = half / 3;
    for (let side = 0; side < 4; side++) {
      for (let i = -3; i <= 3; i++) {
        const p = postGeo.clone(true);
        const t = i * step;
        if (side === 0) p.position.set(t, 0, -half);
        else if (side === 1) p.position.set(half, 0, t);
        else if (side === 2) p.position.set(t, 0, half);
        else p.position.set(-half, 0, t);
        posts.add(p);
      }
    }
    this.root.add(posts);

    // Rails sit between posts on each side.
    const rails = new THREE.Group();
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 3; i++) {
        const r = railProto.clone(true);
        const mid = -half + step * (i + 0.5);
        if (side === 0) r.position.set(mid, 0, -half);
        else if (side === 1) { r.position.set(half, 0, mid); r.rotation.y = Math.PI / 2; }
        else if (side === 2) { r.position.set(mid, 0, half); r.rotation.y = 0; }
        else { r.position.set(-half, 0, mid); r.rotation.y = Math.PI / 2; }
        rails.add(r);
      }
    }
    this.root.add(rails);
  }

  /**
   * Instanced grass with a vertex-shader breeze. One draw call for the field.
   */
  _buildGrass(count) {
    if (count <= 0) return;
    const rnd = makeRandom(20240617);
    const geo = new THREE.ConeGeometry(0.05, 0.44, 4).translate(0, 0.22, 0);

    const material = mat(0x8ad46b, { flat: false });
    this.windUniform = { value: 0 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.windUniform;
      shader.vertexShader =
        "uniform float uTime;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `
          vec3 transformed = vec3( position );
          #ifdef USE_INSTANCING
            vec3 iOrigin = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
          #else
            vec3 iOrigin = vec3( 0.0 );
          #endif
          float bladeH = clamp( transformed.y / 0.44, 0.0, 1.0 );
          float phase = iOrigin.x * 0.55 + iOrigin.z * 0.83;
          float sway = sin( uTime * 1.5 + phase ) * 0.6 + sin( uTime * 2.9 + phase * 1.9 ) * 0.25;
          transformed.x += sway * 0.055 * bladeH * bladeH;
          transformed.z += sway * 0.035 * bladeH * bladeH;
          `
        );
    };
    // Force a distinct program so the injected shader is not shared with
    // unmodified materials.
    material.customProgramCacheKey = () => "wind-grass";

    const inst = new THREE.InstancedMesh(geo, material, count);
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.name = "grass";

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let placed = 0;
    let guard = 0;

    while (placed < count && guard < count * 6) {
      guard++;
      const x = (rnd() - 0.5) * (this.half - 0.4) * 2;
      const z = (rnd() - 0.5) * (this.half - 0.4) * 2;
      if (this._isReserved(x, z, 0.9)) continue;
      pos.set(x, 0, z);
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      const s = 0.75 + rnd() * 0.75;
      scl.set(s, s * (0.8 + rnd() * 0.7), s);
      m4.compose(pos, q, scl);
      inst.setMatrixAt(placed, m4);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    this.grass = inst;
    this.root.add(inst);
  }

  /* ------------------------------------------------------------ */

  _isReserved(x, z, extra = 0) {
    for (const r of this.reserved) {
      const dx = x - r.x;
      const dz = z - r.z;
      const rr = r.r + extra;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  _buildDecor(assets, density) {
    const rnd = makeRandom(97531);
    const cfg = GAME_CONFIG.board;
    const inner = cfg.half + 0.4;   // outside the playable area
    const outer = cfg.fenceHalf - 0.3;

    const place = (proto, x, z, { s = 1, ry = null, y = 0, sway = null } = {}) => {
      const o = proto.clone(true);
      o.position.set(x, y, z);
      o.rotation.y = ry ?? rnd() * Math.PI * 2;
      if (s !== 1) o.scale.setScalar(s);
      this.decorRoot.add(o);
      this.decorEntries.push({ obj: o, baseY: y, phase: rnd() * Math.PI * 2, sway });
      return o;
    };

    /* --- big scenery lives in the outer ring, corners included --- */
    const corners = [
      [-outer + 0.7, -outer + 0.7], [outer - 0.7, -outer + 0.7],
      [-outer + 0.7, outer - 0.7], [outer - 0.7, outer - 0.7]
    ];
    corners.forEach(([x, z], i) => {
      place(i % 2 ? assets.tree2 : assets.tree, x, z, { s: 0.9 + rnd() * 0.35 });
      this.reserved.push({ x, z, r: 2 });
    });

    const treeCount = Math.round(6 * density);
    for (let i = 0; i < treeCount; i++) {
      const p = this._ringSpot(rnd, inner + 1.1, outer - 0.6);
      if (!p) continue;
      place(Math.random() < 0.5 ? assets.tree : assets.tree2, p.x, p.z, { s: 0.75 + rnd() * 0.4 });
    }

    const bushCount = Math.round(12 * density);
    for (let i = 0; i < bushCount; i++) {
      const p = this._ringSpot(rnd, inner + 0.3, outer - 0.3);
      if (!p) continue;
      place([assets.bush, assets.bush2, assets.bush3][i % 3], p.x, p.z, { s: 0.8 + rnd() * 0.6, sway: 0.02 });
    }

    const rockCount = Math.round(7 * density);
    for (let i = 0; i < rockCount; i++) {
      const p = this._ringSpot(rnd, inner + 0.2, outer - 0.2);
      if (!p) continue;
      place(assets.rock, p.x, p.z, { s: 0.7 + rnd() * 0.7 });
    }

    const mushroomCount = Math.round(8 * density);
    for (let i = 0; i < mushroomCount; i++) {
      const p = this._ringSpot(rnd, inner + 0.1, outer - 0.3);
      if (!p) continue;
      place(assets.mushroom, p.x, p.z, { s: 0.75 + rnd() * 0.5 });
    }

    /* --- short, safe scenery may appear inside the field --- */
    const flowerColors = [assets.flowerPink, assets.flowerYellow, assets.flowerWhite, assets.flowerBlue];
    const innerFlowerCount = Math.round(26 * density);
    for (let i = 0; i < innerFlowerCount; i++) {
      const x = (rnd() - 0.5) * cfg.half * 1.9;
      const z = (rnd() - 0.5) * cfg.half * 1.9;
      if (this._isReserved(x, z, 1.4)) continue;
      place(flowerColors[i % flowerColors.length], x, z, { s: 0.8 + rnd() * 0.5, sway: 0.03 });
    }

    const logCount = Math.round(3 * density);
    for (let i = 0; i < logCount; i++) {
      const p = this._ringSpot(rnd, inner + 1.4, outer - 0.4);
      if (!p) continue;
      place(assets.log, p.x, p.z, { s: 0.9 + rnd() * 0.3 });
    }

    /* --- a few story props --- */
    const can = assets.wateringCan.clone(true);
    can.position.set(-cfg.half - 0.7, 0, 2.6);
    can.rotation.y = 0.7;
    this.decorRoot.add(can);

    const sign = assets.sign.clone(true);
    sign.position.set(-4.2, 0, cfg.fenceHalf - 0.9);
    sign.rotation.y = Math.PI;
    this.decorRoot.add(sign);

    const sign2 = assets.sign.clone(true);
    sign2.scale.setScalar(0.85);
    sign2.position.set(cfg.fenceHalf - 0.9, 0, -3.4);
    sign2.rotation.y = -Math.PI / 2;
    this.decorRoot.add(sign2);
  }

  /** Random point in the outer ring, avoiding already-reserved spots. */
  _ringSpot(rnd, minR, maxR) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = rnd() * Math.PI * 2;
      const r = minR + rnd() * (maxR - minR);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) > maxR || Math.abs(z) > maxR) continue;
      if (this._isReserved(x, z, 1.1)) continue;
      return { x, z };
    }
    return null;
  }

  /* ------------------------------------------------------------ */

  update(dt, time) {
    if (this.windUniform) this.windUniform.value = time;
    for (const e of this.decorEntries) {
      if (!e.sway) continue;
      e.obj.rotation.z = Math.sin(time * 1.6 + e.phase) * e.sway;
      e.obj.rotation.x = Math.cos(time * 1.2 + e.phase * 1.4) * e.sway * 0.7;
    }
  }

  dispose() {
    this.grass?.dispose();
    this.grass?.geometry.dispose();
  }
}