/**
 * GameState.js
 * Single source of truth for the high level game state.
 */

export const GameState = Object.freeze({
  LOADING: "LOADING",
  MENU: "MENU",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  GAME_OVER: "GAME_OVER"
});

/** States in which the simulation should not advance. */
export const FROZEN_STATES = Object.freeze([
  GameState.LOADING,
  GameState.MENU,
  GameState.PAUSED,
  GameState.GAME_OVER
]);

export function isSimulating(state) {
  return state === GameState.PLAYING;
}