/**
 * ParticleSystem.js
 * All the little bits of feedback: dust puffs, hit stars, poofs, floating
 * score text, ripples.
 *
 * Sprites are pooled and each pooled sprite owns one material, because every
 * particle fades on its own private opacity curve. Sprites cost one draw call
 * each either way, so nothing is lost by not sharing materials (AGENTS.md 34 +
 * 37). Text and ripple materials are created per use and disposed on release.
 */

import * as THREE from "three";
import { randRange } from "../utils/MathUtils.js";

const KINDS = {
  dust: { color: 0xd7b58a, size: 0.42, life: 0.55, gravity: -2.4, spin: 1.4, star: false },
  puff: { color: 0xfff6e2, size: 0.55, life: 0.34, gravity: 0.6, spin: 2.2, star: false },
  star: { color: 0xffe07a, size: 0.34, life: 0.6, gravity: -1.2, spin: 5, star: true },
  leaf: { color: 0x63bd46, size: 0.3, life: 0.9, gravity: -3.2, spin: 6, star: false },
  dirt: { color: 0x8a6242, size: 0.3, life: 0.7, gravity: -7, spin: 3, star: false },
  sparkle: { color: 0xfff2b0, size: 0.26, life: 0.5, gravity: 1.4, spin: 4, star: true },
  love: { color: 0xf58fb1, size: 0.32, life: 0.9, gravity: 1.8, spin: 3, star: true }
};

export class ParticleSystem {
  /**
   * @param {THREE.Object3D} parent
   * @param {number} budget max simultaneous sprites
   */
  constructor(parent, budget = 200) {
    this.parent = parent;
    this.budget = budget;
    this.items = [];
    this.free = [];
    this.time = 0;

    this.texture = makeSoftDisc();
    this.starTexture = makeStar();
  }

  /**
   * @param {string} kind key of KINDS
   * @param {THREE.Vector3} position
   * @param {{count?:number, speed?:number, spread?:number, size?:number, life?:number, up?:number}} [opt]
   */
  burst(kind, position, opt = {}) {
    const def = KINDS[kind] ?? KINDS.puff;
    const count = Math.max(1, Math.round(opt.count ?? 6));
    const speed = opt.speed ?? 2.2;
    const spread = opt.spread ?? Math.PI * 2;
    const size = opt.size ?? def.size;
    const life = opt.life ?? def.life;
    const up = opt.up ?? 0.6;

    for (let i = 0; i < count; i++) {
      const p = this._acquire(kind);
      if (!p) return;
      const a = Math.random() * spread;
      const s = speed * (0.55 + Math.random() * 0.7);
      p.sprite.position.copy(position);
      p.sprite.position.y += randRange(0, 0.25);
      p.material.map = def.star ? this.starTexture : this.texture;
      p.material.color.setHex(def.color);
      p.material.opacity = 1;
      p.sprite.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      p.sprite.visible = true;
      p.vel.set(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s);
      p.life = life * (0.75 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = size;
      p.gravity = def.gravity;
      p.spin = (Math.random() - 0.5) * def.spin;
    }
  }

  /** A flat expanding ring on the ground - used for hole closes and swings. */
  ripple(position, color = 0xffffff, size = 1.2) {
    const mesh = new THREE.Mesh(
      getRingGeo(),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, opacity: 0.9 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.05, position.z);
    mesh.scale.setScalar(0.2);
    this.parent.add(mesh);
    const item = this._wrapMesh(mesh, size, 0.55);
    item.ownMaterial = true;
    item.material = mesh.material;
    this.items.push(item);
  }

  /**
   * Floating text in world space, e.g. "+10".
   * @param {string} text
   */
  popText(text, position, color = "#fffaf0", scale = 1) {
    const tex = textTexture(text, color);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.position.y += 0.9;
    sprite.scale.set(0.9 * scale, 0.45 * scale, 1);
    this.parent.add(sprite);
    const item = this._wrapMesh(sprite, 1, 1.1, 1.9);
    item.riseOnly = true;
    item.ownMaterial = true;
    item.material = mat;
    item.spriteBase = sprite.scale.clone();
    this.items.push(item);
  }

  /* ------------------------------------------------------------ */

  _wrapMesh(obj, size, life, rise = 0) {
    return {
      sprite: obj,
      vel: new THREE.Vector3(0, rise, 0),
      life,
      maxLife: life,
      size,
      gravity: 0,
      spin: 0,
      kind: null,
      riseOnly: false,
      ownMaterial: false,
      isMesh: obj.isMesh
    };
  }

  _acquire(kind) {
    if (this.items.length >= this.budget) return null;
    let sprite = this.free.pop();
    if (!sprite) {
      // One private material per pooled sprite so fades are independent.
      sprite = new THREE.Sprite();
      sprite.material = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
        depthTest: true
      });
      this.parent.add(sprite);
    }
    const p = this._wrapMesh(sprite, 1, 1);
    p.kind = kind;
    p.material = sprite.material;
    this.items.push(p);
    return p;
  }

  _release(i) {
    const p = this.items[i];
    const last = this.items.length - 1;
    if (i !== last) this.items[i] = this.items[last];
    this.items.pop();
    p.sprite.visible = false;
    if (p.isMesh && p.sprite.parent) p.sprite.parent.remove(p.sprite);
    if (p.ownMaterial) p.material?.dispose();
    else if (!p.isMesh) this.free.push(p.sprite);
    p.kind = null;
    p.ownMaterial = false;
  }

  update(dt) {
    this.time += dt;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this._release(i);
        continue;
      }

      const k = 1 - p.life / p.maxLife; // 0..1

      if (p.riseOnly) {
        p.sprite.position.y += dt * 1.5;
        const s = 1 + Math.sin(k * Math.PI) * 0.2;
        p.sprite.scale.set(p.spriteBase.x * s, p.spriteBase.y * s, 1);
        if (p.material) p.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        continue;
      }

      if (p.isMesh) {
        const s = p.size * (0.4 + k * 1.5);
        p.sprite.scale.setScalar(s);
        if (p.material) p.material.opacity = 1 - k;
        continue;
      }

      // Physics sprite.
      p.vel.y += p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.sprite.position.y < 0.04) {
        p.sprite.position.y = 0.04;
        p.vel.y = Math.abs(p.vel.y) * 0.28;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      const grow = 1 + k * 0.6;
      p.sprite.scale.setScalar(p.size * grow * (1 - k * 0.25));
      if (p.material) p.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
  }

  clear() {
    for (let i = this.items.length - 1; i >= 0; i--) this._release(i);
  }

  get count() {
    return this.items.length;
  }
}

/* ------------------------------------------------------------ */
/* Shared resources                                               */
/* ------------------------------------------------------------ */

let softDisc = null;
function makeSoftDisc() {
  if (softDisc) return softDisc;
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  softDisc = new THREE.CanvasTexture(c);
  softDisc.colorSpace = THREE.SRGBColorSpace;
  return softDisc;
}

let starTex = null;
function makeStar() {
  if (starTex) return starTex;
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  ctx.translate(s / 2, s / 2);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? s * 0.46 : s * 0.17;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

const textCache = new Map();
function textTexture(text, color) {
  const key = `${text}|${color}`;
  if (textCache.has(key)) return textCache.get(key);
  const font = "bold 88px Nunito, system-ui, sans-serif";
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + 40;
  const h = 120;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(61,44,30,0.85)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textCache.set(key, tex);
  return tex;
}

let RING_GEO = null;
function getRingGeo() {
  if (!RING_GEO) RING_GEO = new THREE.RingGeometry(0.72, 0.9, 20);
  return RING_GEO;
}