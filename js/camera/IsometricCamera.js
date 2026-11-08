/**
 * IsometricCamera.js
 * Orthographic diorama camera.
 *
 * The whole board must stay visible at every aspect ratio, so the frustum is
 * recomputed from the board size and the viewport aspect on every resize
 * (AGENTS.md 38 + 51). A tiny follow offset adds life without ever letting the
 * player push the board out of frame.
 */

import * as THREE from "three";
import { clamp, damp } from "../utils/MathUtils.js";

export class IsometricCamera {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {{halfSize:number, distance?:number, elevation?:number, azimuth?:number, followStrength?:number, margin?:number}} opts
   */
  constructor(renderer, opts) {
    this.renderer = renderer;
    this.halfSize = opts.halfSize;
    this.distance = opts.distance ?? 40;
    /** Degrees above the horizon - classic iso sits around 35.26 (2:1) to 45. */
    this.elevation = opts.elevation ?? 34;
    /** Diagonal azimuth so the board reads as a diamond. */
    this.azimuth = opts.azimuth ?? 45;
    this.followStrength = opts.followStrength ?? 0.06;
    this.margin = opts.margin ?? 1.06;

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.target = new THREE.Vector3(0, 0, 0);
    this._follow = new THREE.Vector3(0, 0, 0);
    this._shake = 0;

    this._reposition();
    this.update(0.016);
  }

  _reposition() {
    const el = THREE.MathUtils.degToRad(this.elevation);
    const az = THREE.MathUtils.degToRad(this.azimuth);
    const horiz = Math.cos(el) * this.distance;
    this.camera.position.set(
      Math.sin(az) * horiz,
      Math.sin(el) * this.distance,
      Math.cos(az) * horiz
    );
    this.camera.lookAt(this.target);
  }

  /** Fit the board into the viewport for the current aspect ratio. */
  resize(width, height) {
    const aspect = width / height;
    // Radius the board occupies in camera space.
    const needed = this.halfSize * 2 * this.margin;
    let viewH = needed;
    let viewW = needed * aspect;

    // On narrow/portrait screens the board is limited by width instead.
    if (viewW < needed) {
      viewW = needed;
      viewH = needed / aspect;
    }
    // Head-room for the HUD along the top edge.
    viewH *= 1.06;

    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
    this.aspect = aspect;
  }

  /** Nudge the camera, e.g. when the carrot takes a bite. */
  shake(amount = 0.25) {
    this._shake = Math.min(1, this._shake + amount);
  }

  /** @param {number} dt @param {THREE.Vector3|null} focus */
  update(dt, focus = null) {
    if (focus) {
      const t = this.followStrength;
      this._follow.x = THREE.MathUtils.lerp(this._follow.x, focus.x * t, damp(4, dt));
      this._follow.z = THREE.MathUtils.lerp(this._follow.z, focus.z * t, damp(4, dt));
    }

    this._shake = Math.max(0, this._shake - dt * 2.6);
    const s = this._shake * this._shake;
    const t = performance.now() * 0.001;
    const jitterX = Math.sin(t * 47) * s * 0.5;
    const jitterY = Math.cos(t * 39) * s * 0.35;

    this.target.set(this._follow.x, 0, this._follow.z);
    this.camera.position.set(
      Math.sin(THREE.MathUtils.degToRad(this.azimuth)) * Math.cos(THREE.MathUtils.degToRad(this.elevation)) * this.distance + this._follow.x,
      Math.sin(THREE.MathUtils.degToRad(this.elevation)) * this.distance + jitterY,
      Math.cos(THREE.MathUtils.degToRad(this.azimuth)) * Math.cos(THREE.MathUtils.degToRad(this.elevation)) * this.distance + this._follow.z + jitterX
    );
    this.camera.lookAt(this.target);
  }

  /** Convenience passthrough used by the debug renderer. */
  get object() {
    return this.camera;
  }

  /** Screen-space (NDC) position of a world point - used by debug overlays. */
  toNDC(vec3, out = new THREE.Vector3()) {
    return out.copy(vec3).project(this.camera);
  }
}

export { clamp };