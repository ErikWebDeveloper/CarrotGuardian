/**
 * MathUtils.js
 * Small helpers shared across systems. Uses THREE math where convenient but
 * keeps pure functions free of side effects.
 */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent smoothing factor. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Shortest signed angle from a to b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate `current` toward `target` by at most `maxStep` radians. */
export function rotateToward(current, target, maxStep) {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

/** Squared 2D distance between two Vector3-ish objects (ignores Y). */
export function dist2XZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function distXZ(a, b) {
  return Math.sqrt(dist2XZ(a, b));
}

/** Deterministic pseudo random generator (mulberry32) for stable decor. */
export function makeRandom(seed = 1) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export const randRange = (min, max) => min + Math.random() * (max - min);

/** Random integer in [min, max]. */
export const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Fisher-Yates, returns a new array. */
export function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Circle-vs-circle push-apart used for cheap rabbit separation. */
export function separateXZ(a, b, minDist) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dSq = dx * dx + dz * dz;
  if (dSq >= minDist * minDist || dSq === 0) return;
  const d = Math.sqrt(dSq);
  const push = (minDist - d) * 0.5;
  const nx = dx / d;
  const nz = dz / d;
  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;
}