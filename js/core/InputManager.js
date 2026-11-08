/**
 * InputManager.js
 * Single input abstraction for keyboard, mouse and touch.
 *
 * Gameplay code never asks "is a key down?" - it asks the input manager for a
 * movement vector and edge-triggered actions, so the Player stays ignorant of
 * where the input came from (AGENTS.md 13).
 */

import { clamp } from "../utils/MathUtils.js";
import { IS_TOUCH_DEVICE } from "./Config.js";

const MOVE_KEYS = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right"
};

export class InputManager {
  constructor(canvas, { onPause } = {}) {
    this.canvas = canvas;
    this.onPause = onPause || (() => {});

    /** Continuous movement axes in screen space, each in [-1, 1]. */
    this.moveX = 0;
    this.moveY = 0;

    /** Keyboard held state. */
    this.keys = new Set();

    /** Edge-triggered action flags, consumed once per frame by the systems. */
    this._pressed = { attack: false, interact: false };

    /** Virtual joystick state. */
    this.stick = { active: false, id: null, x: 0, y: 0, ox: 0, oy: 0, radius: 62 };

    this.enabled = false;
    /** Set by Game so the HUD can dim the attack button when nothing is in range. */
    this.attackReady = false;

    this.touchEnabled = IS_TOUCH_DEVICE;

    this._bind();
  }

  /* ---------------------------------------------------------- */

  _bind() {
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        this.onPause();
        return;
      }
      if (MOVE_KEYS[e.code]) {
        this.keys.add(MOVE_KEYS[e.code]);
        e.preventDefault();
        return;
      }
      if (e.code === "Space" || e.code === "KeyJ" || e.code === "Enter") {
        this._pressed.attack = true;
        e.preventDefault();
        return;
      }
      if (e.code === "KeyE" || e.code === "KeyK" || e.code === "KeyF") {
        this._pressed.interact = true;
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) this.keys.delete(dir);
    };

    // Releasing focus must not leave the player sprinting into a wall.
    this._onBlur = () => this.keys.clear();

    this._onPointerDown = (e) => {
      if (!this.enabled) return;
      if (e.pointerType === "touch" && !this.stick.active) {
        // Left half of the screen drives the joystick wherever you press.
        if (e.clientX < window.innerWidth * 0.5) {
          this._stickStart(e);
        }
        return;
      }
      if (e.button === 2) this._pressed.interact = true;
      else this._pressed.attack = true;
    };

    this._onPointerMove = (e) => {
      if (this.stick.active && e.pointerId === this.stick.id) this._stickMove(e);
    };

    this._onPointerUp = (e) => {
      if (this.stick.active && e.pointerId === this.stick.id) this._stickEnd();
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    this.canvas.addEventListener("contextmenu", (e) => {
      if (this.enabled) e.preventDefault();
    });
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
  }

  /* ---------------------------------------------------------- */
  /* Virtual joystick                                           */
  /* ---------------------------------------------------------- */

  _stickStart(e) {
    this.stick.active = true;
    this.stick.id = e.pointerId;
    this.stick.ox = e.clientX;
    this.stick.oy = e.clientY;
    this.stick.x = e.clientX;
    this.stick.y = e.clientY;
    this._notifyStick();
  }

  _stickMove(e) {
    const dx = e.clientX - this.stick.ox;
    const dy = e.clientY - this.stick.oy;
    const len = Math.hypot(dx, dy);
    const r = this.stick.radius;
    const k = len > r ? r / len : 1;
    this.stick.x = this.stick.ox + dx * k;
    this.stick.y = this.stick.oy + dy * k;
    this._notifyStick();
  }

  _stickEnd() {
    this.stick.active = false;
    this.stick.id = null;
    this.stick.x = this.stick.ox;
    this.stick.y = this.stick.oy;
    this._notifyStick();
  }

  /** Let the visual joystick follow a dynamically-anchored touch. */
  _notifyStick() {
    this.onStickChange?.(this.stick);
  }

  /** Wire up the on-screen joystick element (mobile only). */
  attachJoystick(element) {
    this.onStickChange = (s) => {
      const base = element;
      const knob = base.firstElementChild?.nextElementSibling;
      if (!knob) return;
      if (s.active) {
        base.style.left = `${s.ox - base.offsetWidth / 2}px`;
        base.style.top = `${s.oy - base.offsetHeight / 2}px`;
        base.style.bottom = "auto";
      } else {
        base.style.left = "";
        base.style.top = "";
        base.style.bottom = "";
      }
      const dx = s.x - s.ox;
      const dy = s.y - s.oy;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      base.classList.toggle("is-active", s.active);
    };
  }

  /* ---------------------------------------------------------- */
  /* Public API                                                 */
  /* ---------------------------------------------------------- */

  /**
   * Normalised movement vector where +y is "up the screen" (away from camera).
   * @returns {{x:number,y:number,magnitude:number}}
   */
  getMovement() {
    let x = 0;
    let y = 0;
    if (this.keys.has("left")) x -= 1;
    if (this.keys.has("right")) x += 1;
    if (this.keys.has("up")) y += 1;
    if (this.keys.has("down")) y -= 1;

    if (this.stick.active) {
      const dx = this.stick.x - this.stick.ox;
      const dy = this.stick.y - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        // Small stick deflection = slow walk, full deflection = full speed.
        const k = Math.min(1, len / this.stick.radius);
        x += (dx / len) * k;
        y += (-dy / len) * k;
      }
    }

    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    return { x, y, magnitude: clamp(magnitude, 0, 1) };
  }

  /** True once per press. */
  isAttackPressed() {
    return this._take("attack");
  }

  /** True once per press. */
  isInteractPressed() {
    return this._take("interact");
  }

  _take(key) {
    if (!this._pressed[key]) return false;
    this._pressed[key] = false;
    return true;
  }

  /** Buttons call this; held state also works for the attack auto-repeat. */
  pressAttack() {
    this._pressed.attack = true;
  }

  pressInteract() {
    this._pressed.interact = true;
  }

  /** Drop anything in flight when pausing. */
  reset() {
    this.keys.clear();
    this._pressed.attack = false;
    this._pressed.interact = false;
    this.stick.active = false;
    this.onStickChange?.(this.stick);
  }
}