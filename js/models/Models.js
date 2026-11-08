/**
 * Models.js
 * Procedural low-poly model factory.
 *
 * All art is built from primitives here, so the project ships with zero binary
 * dependencies and always renders. `AssetManager` transparently substitutes
 * real .glb files when they are dropped into `assets/models`.
 *
 * Style rules that keep everything reading as one art direction:
 *  - flat shaded Lambert materials, no specular highlights
 *  - low segment counts (4-16) on every primitive
 *  - every model faces +Z (rotated with atan2(dirX, dirZ))
 *  - each animated pivot gets its own `merger()` so we never pay more than
 *    one draw call per material
 */

import * as THREE from "three";
import { PALETTE } from "./Palette.js";
import {
  BOX, SPHERE, ICO, CYL, CONE, TORUS, TORUS_ARC, CIRCLE, PLANE,
  mat, merger, basicMat, labelTexture, glowTexture
} from "./GeoCache.js";

/* ============================================================
   PLAYER - a cute gardener. Singleton, so ~20 draw calls is fine.
   ============================================================ */

export function createPlayer() {
  const root = new THREE.Group();
  root.name = "player";

  const skin = mat(PALETTE.skin);
  const skinShade = mat(PALETTE.skinShade);
  const shirt = mat(PALETTE.playerShirt);
  const shirtDark = mat(PALETTE.playerShirtDark);
  const pants = mat(PALETTE.playerPants);
  const boot = mat(PALETTE.playerBoot);
  const dark = mat(PALETTE.rabbitDark);
  const blush = mat(PALETTE.rabbitEar, { transparent: true, opacity: 0.8 });
  const white = mat(PALETTE.white);

  /** Bobs up and down while walking. */
  const bodyPivot = new THREE.Group();
  bodyPivot.name = "bodyPivot";
  root.add(bodyPivot);

  /* ---- legs ---- */
  const mkLeg = (name, sx) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(sx * 0.17, 0.34, 0);
    const b = merger();
    b.add(BOX(0.24, 0.34, 0.26), pants);
    b.add(BOX(0.27, 0.14, 0.32), boot, { y: -0.19, z: 0.03 });
    b.flush(g);
    bodyPivot.add(g);
    return g;
  };
  const leftLeg = mkLeg("leftLeg", -1);
  const rightLeg = mkLeg("rightLeg", 1);

  /* ---- torso ---- */
  const torso = new THREE.Group();
  torso.name = "torso";
  torso.position.y = 0.66;
  bodyPivot.add(torso);
  {
    const b = merger();
    b.add(BOX(0.66, 0.62, 0.46), shirt);
    b.add(BOX(0.6, 0.11, 0.44), shirtDark, { y: 0.28 });                 // collar
    b.add(BOX(0.44, 0.36, 0.07), pants, { y: -0.02, z: 0.24 });           // dungaree bib
    b.add(BOX(0.1, 0.34, 0.07), pants, { x: -0.16, y: 0.16, z: 0.23 });   // straps
    b.add(BOX(0.1, 0.34, 0.07), pants, { x: 0.16, y: 0.16, z: 0.23 });
    b.add(ICO(0.035), mat(PALETTE.flowerYellow), { x: -0.09, y: -0.06, z: 0.29 });
    b.add(ICO(0.035), mat(PALETTE.flowerYellow), { x: 0.09, y: -0.06, z: 0.29 });
    b.flush(torso);
  }

  /* ---- arms ---- */
  const mkArm = (name, sx, withTool) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(sx * 0.41, 0.04, 0);
    const b = merger();
    b.add(BOX(0.17, 0.44, 0.19), shirt);
    b.add(ICO(0.1), skin, { y: -0.26 });
    b.flush(g);
    if (withTool) {
      const tool = new THREE.Group();
      tool.name = "tool";
      tool.position.set(0.02, -0.3, 0.1);
      tool.rotation.x = -0.35;
      const t = merger();
      t.add(CYL(0.035, 0.04, 0.44, 6), mat(PALETTE.wood), { y: 0.12 });
      t.add(BOX(0.17, 0.19, 0.05), mat(PALETTE.metal), { y: -0.16 });
      t.add(BOX(0.19, 0.05, 0.05), mat(PALETTE.metal), { y: -0.07 });
      t.flush(tool);
      g.add(tool);
    }
    torso.add(g);
    return g;
  };
  const leftArm = mkArm("leftArm", -1, false);
  const rightArm = mkArm("rightArm", 1, true);

  /* ---- head ---- */
  const head = new THREE.Group();
  head.name = "head";
  head.position.y = 0.5;
  torso.add(head);
  {
    const b = merger();
    b.add(ICO(0.31, 1), skin, { sy: 0.97, sz: 0.95 });            // skull
    b.add(ICO(0.19, 1), mat(PALETTE.playerHair), { y: 0.11, z: -0.15 }); // hair tuft
    b.add(ICO(0.07), skinShade, { x: -0.28, y: 0.02 });            // ears
    b.add(ICO(0.07), skinShade, { x: 0.28, y: 0.02 });
    b.add(ICO(0.058), dark, { x: -0.125, y: 0.03, z: 0.235 });      // eyes
    b.add(ICO(0.058), dark, { x: 0.125, y: 0.03, z: 0.235 });
    b.add(ICO(0.022), white, { x: -0.11, y: 0.055, z: 0.27 });     // catchlights
    b.add(ICO(0.022), white, { x: 0.14, y: 0.055, z: 0.27 });
    b.add(ICO(0.062), blush, { x: -0.2, y: -0.05, z: 0.2 });       // cheeks
    b.add(ICO(0.062), blush, { x: 0.2, y: -0.05, z: 0.2 });
    b.add(TORUS_ARC(0.075, 0.022, Math.PI, 8, 5), dark, { y: -0.08, z: 0.26, rx: 0.25, rz: Math.PI });
    b.flush(head);
  }

  /* ---- straw hat ---- */
  const hat = new THREE.Group();
  hat.name = "hat";
  hat.position.y = 0.2;
  head.add(hat);
  {
    const b = merger();
    b.add(CYL(0.42, 0.45, 0.05, 16), mat(PALETTE.straw));
    b.add(CYL(0.24, 0.28, 0.22, 16), mat(PALETTE.straw), { y: 0.12 });
    b.add(CYL(0.29, 0.29, 0.06, 16), mat(PALETTE.strawDark), { y: 0.06 });
    b.add(ICO(0.06), mat(PALETTE.leaf), { x: 0.2, y: 0.1, z: 0.12 });
    b.flush(hat);
  }

  return {
    root,
    parts: { bodyPivot, torso, head, hat, leftLeg, rightLeg, leftArm, rightArm }
  };
}

/* ============================================================
   RABBIT - pooled and repeated, so this one is optimised hard.
   ============================================================ */

function buildRabbit(tint) {
  const root = new THREE.Group();
  root.name = "rabbit";

  const furBase = [PALETTE.rabbitFur, 0xdcc7a8, 0xd2ccbf][tint % 3];
  const furShade = [PALETTE.rabbitFurShade, 0xc2a887, 0xb6b0a3][tint % 3];
  const fur = mat(furBase);
  const furS = mat(furShade);
  const pink = mat(PALETTE.rabbitEar);
  const white = mat(PALETTE.white);
  const noseM = mat(PALETTE.rabbitNose);
  const dark = mat(PALETTE.rabbitDark);

  const hop = new THREE.Group();
  hop.name = "hop";
  root.add(hop);

  /* ---- body: one draw call per material ---- */
  {
    const b = merger();
    b.add(ICO(0.31, 1), fur, { y: 0.36, z: -0.04, sx: 1, sy: 0.84, sz: 1.24 });   // torso
    b.add(ICO(0.17, 1), furS, { x: -0.19, y: 0.26, z: -0.22 });                     // haunches
    b.add(ICO(0.17, 1), furS, { x: 0.19, y: 0.26, z: -0.22 });
    const foot = BOX(0.15, 0.09, 0.26);
    b.add(foot, furS, { x: -0.17, y: 0.05, z: 0.22 });
    b.add(foot, furS, { x: 0.17, y: 0.05, z: 0.22 });
    b.add(foot, furS, { x: -0.17, y: 0.05, z: -0.24 });
    b.add(foot, furS, { x: 0.17, y: 0.05, z: -0.24 });
    b.flush(hop);
  }
  // fluffy tail (kept separate for contrast)
  const tail = merger();
  tail.add(ICO(0.115, 1), white, { y: 0.44, z: -0.4 });
  tail.flush(hop, { castShadow: false });

  /* ---- head ---- */
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 0.58, 0.34);
  hop.add(head);
  {
    const b = merger();
    b.add(ICO(0.24, 1), fur, { sy: 0.95, sz: 1.02 });
    b.add(ICO(0.13, 1), white, { y: -0.07, z: 0.19, sx: 1.1, sy: 0.78 });  // muzzle
    b.add(ICO(0.05), noseM, { y: -0.05, z: 0.3 });
    b.add(ICO(0.055), dark, { x: -0.125, y: 0.06, z: 0.16 });              // eyes
    b.add(ICO(0.055), dark, { x: 0.125, y: 0.06, z: 0.16 });
    b.flush(head);
  }

  /* ---- ears (independent flop) ---- */
  const mkEar = (name, sx) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(sx * 0.115, 0.16, -0.02);
    pivot.rotation.set(-0.12, 0, sx * 0.24);
    const b = merger();
    b.add(BOX(0.105, 0.42, 0.08), fur, { y: 0.21 });
    b.add(BOX(0.055, 0.3, 0.03), pink, { y: 0.2, z: 0.045 });
    b.flush(pivot);
    head.add(pivot);
    return pivot;
  };
  const earL = mkEar("earL", -1);
  const earR = mkEar("earR", 1);

  return { root, parts: { hop, head, earL, earR } };
}

/**
 * Clone-based rabbit factory. A template is built once per tint and every
 * instance deep-clones it, so all 40 rabbits share one set of buffers.
 */
const rabbitTemplates = new Map();

export function createRabbit(opts = {}) {
  const tint = opts.tint ?? 0;
  let tpl = rabbitTemplates.get(tint);
  if (!tpl) {
    tpl = buildRabbit(tint);
    rabbitTemplates.set(tint, tpl);
  }
  const root = tpl.root.clone(true);
  return {
    root,
    parts: {
      hop: root.getObjectByName("hop"),
      head: root.getObjectByName("head"),
      earL: root.getObjectByName("earL"),
      earR: root.getObjectByName("earR")
    }
  };
}

/* ============================================================
   CARROT - the objective. Faces +Z, World turns it toward camera.
   ============================================================ */

export function createCarrot() {
  const root = new THREE.Group();
  root.name = "carrot";

  const bob = new THREE.Group();
  bob.name = "carrotBob";
  root.add(bob);

  const dark = mat(PALETTE.rabbitDark);
  const white = mat(PALETTE.white);
  const blush = mat(PALETTE.rabbitEar, { transparent: true, opacity: 0.8 });

  /* ---- soil mound + tapered grooved body + face, all one merge ---- */
  {
    const b = merger();
    b.add(ICO(1.15, 1), mat(PALETTE.soilDark), { y: 0.04, sy: 0.16 });   // mound
    // three stacked inverted cones = tapered body with visible grooves
    b.add(CONE(0.6, 1.0, 14), mat(PALETTE.carrotLight), { y: 0.5, rx: Math.PI });
    b.add(CONE(0.5, 0.42, 14), mat(PALETTE.carrot), { y: 1.2, rx: Math.PI });
    b.add(CONE(0.34, 0.32, 14), mat(PALETTE.carrotDeep), { y: 1.55, rx: Math.PI });
    // face
    b.add(ICO(0.07), dark, { x: -0.17, y: 1.0, z: 0.4 });
    b.add(ICO(0.07), dark, { x: 0.17, y: 1.0, z: 0.4 });
    b.add(ICO(0.026), white, { x: -0.15, y: 1.025, z: 0.44 });
    b.add(ICO(0.026), white, { x: 0.19, y: 1.025, z: 0.44 });
    b.add(ICO(0.075), blush, { x: -0.28, y: 0.9, z: 0.33 });
    b.add(ICO(0.075), blush, { x: 0.28, y: 0.9, z: 0.33 });
    b.add(TORUS_ARC(0.1, 0.028, Math.PI, 10, 5), dark, { y: 0.84, z: 0.4, rx: 0.2, rz: Math.PI });
    b.flush(bob);
  }

  /* ---- leaves ---- */
  const leaves = new THREE.Group();
  leaves.name = "leaves";
  leaves.position.y = 1.66;
  bob.add(leaves);
  {
    const b = merger();
    const blade = CONE(0.1, 0.8, 5);
    const blade2 = CONE(0.07, 0.44, 5);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const tilt = 0.42 + (i % 3) * 0.12;
      b.add(blade, i % 2 ? mat(PALETTE.leaf) : mat(PALETTE.leafDark), {
        x: Math.sin(a) * 0.16,
        y: Math.cos(a) * 0.12,
        z: Math.cos(a) * 0.16,
        rx: Math.cos(a) * tilt,
        rz: -Math.sin(a) * tilt,
        sz: 0.42
      });
    }
    b.add(blade2, mat(PALETTE.leaf), { x: -0.2, y: 0.06, z: -0.06, rx: -0.6, rz: 0.7 });
    b.add(blade2, mat(PALETTE.leaf), { x: 0.2, y: 0.06, z: -0.06, rx: -0.6, rz: -0.7 });
    b.flush(leaves);
  }

  // health ring sits on the soil, separate so it can pulse independently
  const ring = new THREE.Group();
  ring.name = "healthRing";
  ring.position.y = 0.06;
  root.add(ring);

  return { root, parts: { bob, leaves, ring } };
}

/* ============================================================
   RABBIT HOLE
   ============================================================ */

/**
 * Holds both visual states so transitions can cross-fade.
 * @param {{detailed?: boolean}} [opts]
 */
export function createHole(opts = {}) {
  const detailed = opts.detailed ?? true;
  const root = new THREE.Group();
  root.name = "hole";

  const openGroup = new THREE.Group();
  openGroup.name = "openGroup";
  root.add(openGroup);
  {
    const b = merger();
    b.add(CIRCLE(0.72, 16), mat(PALETTE.soil, { flat: false }), { y: 0.005, rx: -Math.PI / 2 });
    b.flush(openGroup, { castShadow: false });
    const rimB = merger();
    rimB.add(TORUS(0.56, 0.17, 14, 6), mat(PALETTE.soilDark), { y: 0.05, rx: Math.PI / 2, sz: 0.55 });
    if (detailed) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.7;
        rimB.add(ICO(0.075, 0), mat(PALETTE.soilLight), {
          x: Math.cos(a) * 0.8, y: 0.05, z: Math.sin(a) * 0.8, sy: 0.7
        });
      }
    }
    rimB.flush(openGroup);
    const pitB = merger();
    pitB.add(CIRCLE(0.5, 16), mat(PALETTE.holeInner, { flat: false }), { y: 0.02, rx: -Math.PI / 2 });
    pitB.flush(openGroup, { castShadow: false });
  }

  const closedGroup = new THREE.Group();
  closedGroup.name = "closedGroup";
  closedGroup.visible = false;
  root.add(closedGroup);
  {
    const dirt = merger();
    dirt.add(ICO(0.62, 1), mat(PALETTE.soilLight), { y: 0.1, sy: 0.45 });
    dirt.add(ICO(0.3, 1), mat(PALETTE.soil), { y: 0.16, x: 0.18, z: -0.1 });
    dirt.add(CYL(0.055, 0.06, 0.14, 6), mat(PALETTE.mushroomStem), { x: 0.5, y: 0.3, z: 0.24 });
    dirt.flush(closedGroup);
    const planks = merger();
    planks.add(BOX(0.95, 0.07, 0.17), mat(PALETTE.wood), { y: 0.24, ry: 0.42 });
    planks.flush(closedGroup);
    const plank2 = merger();
    plank2.add(BOX(0.95, 0.07, 0.17), mat(PALETTE.woodDark), { y: 0.3, ry: -0.42 });
    plank2.flush(closedGroup);
    if (detailed) {
      const cap = merger();
      cap.add(SPHERE(0.11, 8, 5), mat(PALETTE.mushroomCap), { x: 0.5, y: 0.36, z: 0.24, sy: 0.55 });
      cap.flush(closedGroup);
    }
  }

  return { root, parts: { openGroup, closedGroup } };
}

/* ============================================================
   POWER-UP
   ============================================================ */

export function createPowerUp(def) {
  const root = new THREE.Group();
  root.name = `powerup-${def.id}`;

  const spin = new THREE.Group();
  spin.name = "spin";
  root.add(spin);

  const color = typeof def.color === "number" ? def.color : 0xffffff;
  {
    const b = merger();
    b.add(ICO(0.28, 1), mat(color, { emissive: color, emissiveIntensity: 0.45 }), { y: 0.85, sy: 1.15 });
    b.add(TORUS(0.36, 0.045, 14, 6), mat(PALETTE.white, { emissive: 0xffffff, emissiveIntensity: 0.3 }), { y: 0.85, rx: Math.PI / 2.6 });
    b.add(TORUS(0.3, 0.035, 12, 6), mat(PALETTE.white, { emissive: 0xffffff, emissiveIntensity: 0.25 }), { y: 0.85, rx: -0.7, ry: 0.4 });
    b.flush(spin, { castShadow: false });
  }

  // icon sprite keeps the buff readable at a glance
  const iconTex = labelTexture(def.icon, { font: "bold 104px system-ui, sans-serif", fill: "#fffaf0" });
  const spriteMat = basicMat(`pow:${def.id}`, () =>
    new THREE.SpriteMaterial({ map: iconTex, transparent: true })
  );
  const icon = new THREE.Sprite(spriteMat);
  icon.scale.set(0.6, 0.6, 1);
  icon.position.set(0, 0.88, 0);
  spin.add(icon);

  const glowMat = basicMat(`powglow:${def.id}`, () =>
    new THREE.MeshBasicMaterial({
      map: glowTexture("rgba(255,255,255,0.5)", "rgba(255,255,255,0)"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  const glow = new THREE.Mesh(CIRCLE(0.75, 20), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  root.add(glow);

  return { root, parts: { spin, icon, glow } };
}

/* ============================================================
   SCENERY
   ============================================================ */

export function createTree(seed = 0) {
  const g = new THREE.Group();
  const b = merger();
  b.add(CYL(0.14, 0.2, 0.95, 7), mat(PALETTE.treeTrunk), { y: 0.47 });
  b.add(ICO(0.62, 1), mat(PALETTE.foliage), { y: 1.28 });
  b.add(ICO(0.4, 1), mat(PALETTE.foliageDark), { x: 0.33, y: 1.6, z: -0.12 });
  b.add(ICO(0.32, 1), mat(PALETTE.foliageLight), { x: -0.3, y: 1.52, z: 0.14 });
  if (seed % 2 === 0) b.add(ICO(0.13), mat(PALETTE.flowerPink), { x: 0.24, y: 1.62, z: 0.22 });
  b.flush(g);
  return g;
}

export function createBush(seed = 0) {
  const g = new THREE.Group();
  const b = merger();
  b.add(ICO(0.33, 1), mat(PALETTE.bush), { y: 0.22 });
  b.add(ICO(0.24, 1), mat(PALETTE.foliageDark), { x: 0.26, y: 0.17, z: 0.1 });
  b.add(ICO(0.2, 1), mat(PALETTE.foliageLight), { x: -0.24, y: 0.15, z: -0.08 });
  if (seed % 3 === 0) {
    b.add(ICO(0.06), mat(PALETTE.flowerYellow), { x: 0.1, y: 0.42, z: 0.14 });
    b.add(ICO(0.06), mat(PALETTE.flowerPink), { x: -0.16, y: 0.36, z: -0.1 });
  }
  b.flush(g);
  return g;
}

export function createFlower(color = PALETTE.flowerPink) {
  const g = new THREE.Group();
  const b = merger();
  b.add(CYL(0.022, 0.028, 0.26, 5), mat(PALETTE.leafDark), { y: 0.13 });
  const petal = BOX(0.11, 0.028, 0.12);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.add(petal, mat(color), {
      x: Math.cos(a) * 0.085, y: 0.28, z: Math.sin(a) * 0.085, ry: -a, rz: 0.25
    });
  }
  b.add(ICO(0.055, 1), mat(PALETTE.flowerCenter), { y: 0.3 });
  b.flush(g, { castShadow: false });
  return g;
}

export function createRock() {
  const g = new THREE.Group();
  const b = merger();
  b.add(ICO(0.22, 0), mat(PALETTE.rock), { y: 0.11, sx: 1, sy: 0.66, sz: 1.15 });
  b.add(ICO(0.13, 0), mat(PALETTE.rockDark), { x: 0.2, y: 0.07, z: 0.14, sy: 0.7 });
  b.flush(g);
  return g;
}

export function createMushroom() {
  const g = new THREE.Group();
  const b = merger();
  b.add(CYL(0.055, 0.065, 0.16, 7), mat(PALETTE.mushroomStem), { y: 0.08 });
  b.add(SPHERE(0.115, 9, 5), mat(PALETTE.mushroomCap), { y: 0.15, sy: 0.6 });
  b.add(ICO(0.028), mat(PALETTE.white), { x: 0.05, y: 0.2, z: 0.04 });
  b.flush(g);
  return g;
}

export function createLog() {
  const g = new THREE.Group();
  const b = merger();
  b.add(CYL(0.19, 0.2, 0.95, 9), mat(PALETTE.treeTrunk), { y: 0.2, rz: Math.PI / 2 });
  b.flush(g);
  const ends = merger();
  ends.add(CIRCLE(0.19, 10), mat(PALETTE.wood), { x: 0.48, y: 0.2, ry: Math.PI / 2 });
  ends.add(CIRCLE(0.19, 10), mat(PALETTE.wood), { x: -0.48, y: 0.2, ry: -Math.PI / 2 });
  ends.add(ICO(0.16, 1), mat(PALETTE.foliage), { x: -0.1, y: 0.3, z: 0.05 });
  ends.flush(g);
  return g;
}

export function createWateringCan() {
  const g = new THREE.Group();
  const b = merger();
  b.add(CYL(0.19, 0.21, 0.3, 10), mat(PALETTE.metal), { y: 0.15 });
  b.add(CYL(0.05, 0.07, 0.38, 7), mat(PALETTE.metal), { x: 0.24, y: 0.24, rz: -0.9 });
  b.add(ICO(0.09, 1), mat(PALETTE.leaf), { x: -0.02, y: 0.33 });
  b.flush(g);
  return g;
}

export function createFencePost() {
  const g = new THREE.Group();
  const b = merger();
  b.add(CYL(0.08, 0.1, 0.62, 6), mat(PALETTE.fence), { y: 0.31 });
  b.add(CONE(0.13, 0.14, 6), mat(PALETTE.fence), { y: 0.68 });
  b.flush(g);
  return g;
}

export function createFenceRail(length = 2.2) {
  const g = new THREE.Group();
  const b = merger();
  const rail = BOX(length, 0.08, 0.06);
  b.add(rail, mat(PALETTE.fence), { y: 0.26 });
  b.add(rail, mat(PALETTE.fence), { y: 0.5 });
  b.flush(g);
  return g;
}

export function createSign(text = "CARROT PATCH") {
  const g = new THREE.Group();
  const b = merger();
  b.add(CYL(0.06, 0.075, 0.92, 6), mat(PALETTE.woodDark), { y: 0.46 });
  b.add(BOX(1.05, 0.44, 0.07), mat(PALETTE.wood), { y: 0.98 });
  b.flush(g);

  const tex = labelTexture(text, { font: "bold 62px Nunito, system-ui, sans-serif", fill: "#fffaf0" });
  const labelMat = basicMat(`sign:${text}`, () =>
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  const label = new THREE.Mesh(PLANE(0.94, 0.36), labelMat);
  label.position.set(0, 0.98, 0.04);
  g.add(label);
  return g;
}

/** Instanced grass blade geometry (origin at the base). Cached separately
 *  because CONE() hands back a shared geometry that must not be mutated. */
let bladeGeo = null;
export function createGrassBladeGeometry() {
  if (!bladeGeo) bladeGeo = CONE(0.045, 0.42, 4).clone().translate(0, 0.21, 0);
  return bladeGeo;
}