/**
 * GeoCache.js
 * Shared geometry + material cache.
 *
 * Every rabbit reuses the same handful of buffers, so a 40-rabbit wave costs
 * the same memory as a single rabbit. Materials are cached per
 * (colour, flags) pair, which keeps draw-call state changes low.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PALETTE } from "./Palette.js";

const geometries = new Map();
const materials = new Map();

/** Memoised geometry factory. */
export function geo(key, build) {
  let g = geometries.get(key);
  if (!g) {
    g = build();
    geometries.set(key, g);
  }
  return g;
}

export const BOX = (w, h, d) => geo(`box:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));

export const SPHERE = (r, w = 10, h = 7) =>
  geo(`sph:${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));

/** Low-poly "cut gem" ball - the workhorse for soft organic blobs. */
export const ICO = (r, d = 0) =>
  geo(`ico:${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));

export const CYL = (rt, rb, h, seg = 10, open = false) =>
  geo(`cyl:${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));

export const CONE = (r, h, seg = 10) => geo(`cone:${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));

export const TORUS = (r, t, seg = 12, tub = 8) =>
  geo(`tor:${r},${t},${seg},${tub}`, () => new THREE.TorusGeometry(r, t, tub, seg));

/** Partial torus - used for smiles and arcs. */
export const TORUS_ARC = (r, t, arc = Math.PI, seg = 10, tub = 6) =>
  geo(`tar:${r},${t},${arc},${seg},${tub}`, () => new THREE.TorusGeometry(r, t, tub, seg, arc));

export const BASIC_MATS = new Map();

/** Unlit material (labels, glows, decals). */
export function basicMat(key, build) {
  let m = BASIC_MATS.get(key);
  if (!m) {
    m = build();
    BASIC_MATS.set(key, m);
  }
  return m;
}

export const CIRCLE = (r, seg = 20) => geo(`cir:${r},${seg}`, () => new THREE.CircleGeometry(r, seg));

export const CAPSULE = (r, len, cs = 4, rs = 10) =>
  geo(`cap:${r},${len},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs));

export const PLANE = (w, h) => geo(`pln:${w},${h}`, () => new THREE.PlaneGeometry(w, h));

/**
 * Flat-shaded Lambert material. Lambert is the right pick for the Kenney-ish
 * stylised look *and* is markedly cheaper than Standard on mobile GPUs.
 */
export function mat(color, { emissive = 0, emissiveIntensity = 1, flat = true, transparent = false, opacity = 1, depthWrite = true } = {}) {
  const key = `${color}|${emissive}|${emissiveIntensity}|${flat}|${transparent}|${opacity}|${depthWrite}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      flatShading: flat,
      transparent,
      opacity,
      depthWrite
    });
    materials.set(key, m);
  }
  return m;
}

/** Shortcuts for the palette. */
export const m = {
  grass: (c = PALETTE.grass) => mat(c),
  soil: () => mat(PALETTE.soil),
  wood: (c = PALETTE.wood) => mat(c),
  leaf: (c = PALETTE.leaf) => mat(c)
};

/** Convenience: mesh + shadow flags in one call. */
export function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, shadow = true } = {}) {
  const o = new THREE.Mesh(geometry, material);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  if (s !== 1) o.scale.setScalar(s);
  o.castShadow = shadow;
  o.receiveShadow = shadow;
  return o;
}

/**
 * Merge-free clone helper: makes a fresh Object3D hierarchy shell.
 */
export function group(name, children = []) {
  const g = new THREE.Group();
  g.name = name;
  for (const c of children) g.add(c);
  return g;
}

/**
 * Bake a canvas texture (used for sign + power-up labels).
 * Returns a cached texture for the given text.
 */
const textureCache = new Map();

export function labelTexture(text, {
  font = "bold 92px Nunito, system-ui, sans-serif",
  fill = "#3d2c1e",
  bg = null,
  pad = 26
} = {}) {
  const key = `${text}|${font}|${fill}|${bg}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 150;
  canvas.width = Math.max(8, w);
  canvas.height = h;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 28);
    ctx.fill();
  }
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(255,253,246,0.95)";
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = fill;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Circle texture used for soft ground decals / glows. */
export function glowTexture(inner = "rgba(255,255,255,0.85)", outer = "rgba(255,255,255,0)") {
  const key = `glow:${inner}|${outer}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * mergeBuilder()
 *
 * Authors a model imperatively (one call per primitive) and then collapses
 * everything into one mesh per material on flush(). A rabbit built this way
 * costs ~4 draw calls instead of ~20, which is what keeps a 40-rabbit wave
 * comfortably at 60 FPS on a phone.
 *
 * Parts that need independent animation go in their own builder that is
 * flushed into its own pivot Object3D.
 *
 *   const b = merger();
 *   b.add(BOX(1,1,1), mat(0xff0000), { y: 1 });
 *   b.add(ICO(0.5), mat(0xff0000));
 *   b.flush(someGroup);
 */
export function merger() {
  /** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
  const buckets = new Map();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  return {
    /**
     * @param {THREE.BufferGeometry} geometry
     * @param {THREE.Material} material
     * @param {{x?:number,y?:number,z?:number,rx?:number,ry?:number,rz?:number,s?:number,sx?:number,sy?:number,sz?:number}} [t]
     */
    add(geometry, material, t = {}) {
      const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = t;
      eul.set(rx, ry, rz);
      q.setFromEuler(eul);
      pos.set(x, y, z);
      scl.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
      m4.compose(pos, q, scl);
      // mergeGeometries requires a uniform attribute layout; everything here is
      // non-indexed position/normal/uv, so normalise to that.
      const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(m4);
      let arr = buckets.get(material);
      if (!arr) {
        arr = [];
        buckets.set(material, arr);
      }
      arr.push(g);
      return this;
    },

    /** @param {THREE.Object3D} target */
    flush(target, { castShadow = true, receiveShadow = false } = {}) {
      for (const [material, geos] of buckets) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        if (!merged) {
          console.warn("[GeoCache] merge failed for material", material.name || material.type);
          continue;
        }
        if (geos.length > 1) for (const g of geos) g.dispose();
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        target.add(mesh);
      }
      buckets.clear();
      return target;
    },

    /** Merge without a parent - returns the list of meshes. */
    build(opts) {
      const holder = new THREE.Group();
      this.flush(holder, opts);
      return holder.children;
    }
  };
}

/** Dispose every cached resource (used on hard teardown). */
export function disposeCaches() {
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  BASIC_MATS.forEach((m) => m.dispose());
  geometries.clear();
  materials.clear();
  BASIC_MATS.clear();
}