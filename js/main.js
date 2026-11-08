/**
 * main.js
 * Entry point: boot the Game, load assets, start the loop.
 *
 * Everything that can fail is reported on the loading screen instead of
 * leaving a black canvas (AGENTS.md 60).
 */

import { Game } from "./core/Game.js";

const canvas = document.getElementById("game-canvas");

function fatal(err) {
  console.error("[CarrotGuardian] fatal:", err);
  // Print the stack as a plain string too - some browsers hide it in the
  // console's object inspector, and this is the main debugging entry point.
  console.error("[CarrotGuardian] stack:\n" + String(err?.stack ?? "(no stack)"));
  const status = document.getElementById("loading-status");
  const screen = document.getElementById("loading-screen");
  if (screen) {
    screen.removeAttribute("hidden");
    screen.classList.add("is-active", "is-error");
  }
  if (status) {
    status.innerHTML =
      `Something went wrong.<br><span class="loading__hint">${String(err?.message ?? err)}</span>`;
  }
}

function supportsWebGL() {
  // Probe on a throwaway canvas so we never create the real context here.
  try {
    const probe = document.createElement("canvas");
    return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

async function boot() {
  if (!canvas) return fatal(new Error("game canvas is missing"));
  if (!supportsWebGL()) return fatal(new Error("WebGL is not available in this browser"));

  const game = new Game(canvas);
  // Handy for debugging and for automated smoke tests.
  window.game = game;

  await game.load();
  window.dispatchEvent(new CustomEvent("game-ready"));
}

boot().catch(fatal);
