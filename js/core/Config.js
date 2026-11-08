/**
 * Config.js
 * Centralised gameplay + presentation values.
 * Rule of thumb: no magic numbers in gameplay code.
 */

const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(
  typeof navigator !== "undefined" ? navigator.userAgent : ""
);

export const IS_TOUCH_DEVICE =
  (typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)) ||
  isMobileUA;

/** Debug overlay. Never enable in production. */
export const DEBUG = false;

export const GAME_CONFIG = Object.freeze({
  board: {
    /** Full visual width/depth of the grass slab. */
    size: 28,
    /** Half extent the player is clamped to (inside the decor ring). */
    half: 11.5,
    /** Visual thickness of the soil slab under the grass. */
    baseHeight: 1.1,
    /** Where the picket fence sits. */
    fenceHalf: 13.2,
    /** Keep-out radius around the carrot (no decor, no spawns). */
    carrotClearRadius: 3.4
  },

  camera: {
    halfSize: 14.6,
    distance: 42,
    elevation: 34,
    azimuth: 45,
    followStrength: 0.055,
    margin: 1.04
  },

  carrot: {
    maxHealth: 100,
    radius: 0.95,
    /** Bite damage ticks every `biteInterval` seconds. */
    damagePerBite: 5,
    biteInterval: 1.1
  },

  player: {
    speed: 4.6,
    /** Speed change applied while a boost is active, as a multiplier delta. */
    radius: 0.42,
    attackRange: 1.85,
    attackDamage: 1,
    attackCooldown: 0.34,
    attackDuration: 0.26,
    attackKnockback: 1.5,
    interactRange: 2.1,
    holeCloseDuration: 0.42,
    /** Cooldown before the player may close another hole. */
    interactCooldown: 0.18,
    turnSpeed: 14
  },

  rabbit: {
    speed: 1.55,
    health: 1,
    radius: 0.34,
    /** Where a rabbit stops to nibble the carrot. */
    eatRange: 1.45,
    /** Hit stun after taking a hit, seconds. */
    hitStun: 0.26,
    separation: 0.62,
    maxActive: 40
  },

  hole: {
    radius: 0.62,
    /** How long a closed hole needs before it can pop open again. */
    reopenDelay: 6.5,
    /** Wobble animation length before a spawn. */
    telegraph: 0.85
  },

  spawn: {
    /** Absolute floor on the spawn interval. */
    minInterval: 0.5,
    maxInterval: 2.6,
    intervalDecay: 0.11,
    /** Extra delay added when a chosen hole is not yet open. */
    retryInterval: 0.35
  },

  wave: {
    /** Seconds of breathing room before the first spawn of a wave. */
    leadIn: 2.1,
    /** Seconds between waves. */
    intermission: 4.2,
    baseCount: 3,
    countPerWave: 2,
    maxCount: 34,
    speedPerWave: 0.11,
    maxSpeedMultiplier: 2.1,
    /** Small carrot top-up when a wave is cleared, as a "well defended" reward. */
    clearHeal: 5
  },

  powerUp: {
    speed: {
      id: "speed",
      label: "SPEED",
      icon: "⚡",
      color: "#ffd469",
      duration: 10,
      multiplier: 1.3
    },
    strength: {
      id: "strength",
      label: "POWER",
      icon: "⚔",
      color: "#ff9d76",
      duration: 10,
      bonusDamage: 1
    },
    range: {
      id: "range",
      label: "RANGE",
      icon: "🎯",
      color: "#8fd3f4",
      duration: 12,
      bonusRange: 0.9
    },
    /** One in `chance` rabbits drops a power-up. */
    dropChance: 0.22,
    /** Seconds before a dropped power-up despawns. */
    lifetime: 11,
    pickupRadius: 1.1,
    /** Pickups drift toward the player inside this radius, then get collected. */
    magnetRadius: 2.6,
    magnetSpeed: 3.4,
    /** Maximum simultaneous power-ups on the board. */
    maxActive: 4
  },

  score: {
    rabbit: 10,
    hole: 5,
    powerUp: 2,
    waveClear: 100,
    carrotHealthTick: 1
  },

  debug: {
    showRanges: true
  }
});

/** Hole layout, spread around the carrot but away from the centre. */
/**
 * Hole layout (AGENTS.md 54): predefined points spread around the carrot but
 * kept well outside its immediate area, so rabbits always have to cross open
 * grass. Inner ring first - the spawn system picks the ones the player is not
 * standing next to.
 */
export const HOLE_POSITIONS = Object.freeze([
  { x: -8.4, z: -8.4 },
  { x: 0, z: -9.6 },
  { x: 8.4, z: -8.4 },
  { x: -9.6, z: 0 },
  { x: 9.6, z: 0 },
  { x: -8.4, z: 8.4 },
  { x: 0, z: 9.6 },
  { x: 8.4, z: 8.4 },
  { x: -5.6, z: -5.6 },
  { x: 5.6, z: -5.6 },
  { x: -5.6, z: 5.6 },
  { x: 5.6, z: 5.6 }
].map((p) => Object.freeze(p)));

export const STORAGE_KEY = "carrot-guardian-save-v1";

export const QUALITY = Object.freeze({
  HIGH: "high",
  LOW: "low",
  AUTO: "auto"
});

/** Renderer / shadow presets. */
export const RENDER_PRESETS = Object.freeze({
  high: {
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    decorationDensity: 1,
    particleBudget: 220,
    grassBlades: 1400
  },
  low: {
    pixelRatioCap: 1.25,
    shadows: false,
    shadowMapSize: 512,
    decorationDensity: 0.45,
    particleBudget: 70,
    grassBlades: 420
  }
});

export function pickQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (IS_TOUCH_DEVICE && (cores <= 4 || mem <= 3)) return QUALITY.LOW;
  return QUALITY.HIGH;
}