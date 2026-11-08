/**
 * TouchControls.js
 * On-screen joystick + action buttons for phones and tablets.
 *
 * The joystick is *dynamic*: it re-centres wherever the player first touches
 * the left half of the screen, which feels far better than a fixed stick. The
 * visual stick element is driven from InputManager, so there is exactly one
 * source of truth for stick position.
 *
 * Buttons fire on pointerdown (not click) so the response feels instant, and
 * never bubble to the canvas so they cannot double-trigger an attack.
 */

import { IS_TOUCH_DEVICE } from "../core/Config.js";

export class TouchControls {
  /**
   * @param {import("../core/InputManager.js").InputManager} input
   */
  constructor(input) {
    this.input = input;
    this.el = {
      root: document.getElementById("touch-controls"),
      joystick: document.getElementById("touch-joystick"),
      attack: document.getElementById("btn-attack"),
      interact: document.getElementById("btn-interact")
    };
    this.forced = null;
    this.visible = false;

    this._bindButtons();
    this.applyPreference(null);
  }

  _bindButtons() {
    const press = (el, fn) => {
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add("is-down");
        el.setPointerCapture?.(e.pointerId);
        fn();
      };
      const up = (e) => {
        e?.preventDefault?.();
        el.classList.remove("is-down");
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
      // Stop the browser from firing a synthetic mouse event afterwards.
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    };

    press(this.el.attack, () => this.input.pressAttack());
    press(this.el.interact, () => this.input.pressInteract());
  }

  /**
   * @param {boolean|null} pref true/false to force, null for auto-detect
   */
  applyPreference(pref) {
    this.forced = pref;
    const want = pref === null || pref === undefined ? IS_TOUCH_DEVICE : pref;
    this.setVisible(want);
  }

  setVisible(on) {
    this.visible = on;
    this.el.root.hidden = false;
    this.el.root.classList.toggle("is-active", on);
    if (on) this.input.attachJoystick(this.el.joystick);
    else this.input.onStickChange = null;
  }

  /** Light up the attack button when something is in reach. */
  setAttackReady(ready) {
    this.el.attack.classList.toggle("is-ready", ready);
  }

  /** Highlight the close button when the player is next to an open hole. */
  setInteractReady(ready) {
    this.el.interact.classList.toggle("is-ready", ready);
  }

  reset() {
    this.el.attack.classList.remove("is-ready", "is-down");
    this.el.interact.classList.remove("is-ready", "is-down");
  }
}