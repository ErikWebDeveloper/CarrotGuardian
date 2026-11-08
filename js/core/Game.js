/**
 * Game.js
 * The conductor: renderer, loop, state machine and the wiring between input,
 * world, entities and systems.
 *
 * One update loop, delta-time everywhere, and explicit states (AGENTS.md 27 +
 * 46 + 47). Systems never reach into each other; the Game hands them what they
 * need and reacts to their callbacks.
 */

import * as THREE from "three";
import {
  GAME_CONFIG, RENDER_PRESETS, QUALITY, IS_TOUCH_DEVICE, pickQuality, DEBUG
} from "./Config.js";
import { GameState, isSimulating } from "./GameState.js";
import { AssetManager } from "./AssetManager.js";
import { AudioManager } from "./AudioManager.js";
import { InputManager } from "./InputManager.js";
import { SaveStore } from "./SaveStore.js";
import { World } from "../world/World.js";
import { Player } from "../entities/Player.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { WaveSystem } from "../systems/WaveSystem.js";
import { SpawnSystem } from "../systems/SpawnSystem.js";
import { CombatSystem } from "../systems/CombatSystem.js";
import { PowerUpSystem } from "../systems/PowerUpSystem.js";
import { IsometricCamera } from "../camera/IsometricCamera.js";
import { HUD, controlHints } from "../ui/HUD.js";
import { MainMenu } from "../ui/MainMenu.js";
import { GameOverScreen, PauseScreen } from "../ui/GameOverScreen.js";
import { TouchControls } from "../ui/TouchControls.js";
import { clamp } from "../utils/MathUtils.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = GameState.LOADING;
    this.clock = new THREE.Clock();
    this.store = new SaveStore();

    this.score = 0;
    this.stats = { kills: 0, holesClosed: 0, powerUps: 0 };
    this.time = 0;

    this._fpsSamples = [];
    this._fps = 60;
    this._hintsShown = new Set();
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
    this._camUp = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    this._setupRenderer();
    this._setupCamera();
    this._setupUi();
    this._setupInput();
    this._bindWindow();
  }

  /* ============================================================ */
  /* Setup                                                        */
  /* ============================================================ */

  _setupRenderer() {
    const pref = this.store.get("quality") ?? QUALITY.AUTO;
    this.qualityKey = pref === QUALITY.AUTO ? pickQuality() : pref;
    this.quality = { ...RENDER_PRESETS[this.qualityKey] };
    if (this.store.get("shadows") === false) this.quality.shadows = false;

    const antialias = this.qualityKey === QUALITY.HIGH;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias,
      powerPreference: "high-performance",
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap));
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x9fdcf5, 1);

    // Rabbits are capped lower on phones to protect the frame rate.
    this.quality.maxActiveRabbits = IS_TOUCH_DEVICE ? 18 : GAME_CONFIG.rabbit.maxActive;
  }

  _setupCamera() {
    const cfg = GAME_CONFIG.camera;
    this.isoCamera = new IsometricCamera(this.renderer, cfg);
    this.camera = this.isoCamera.camera;
    this._resize();
    this._updateCameraBasis();
  }

  _setupUi() {
    this.hud = new HUD(document);
    this.menu = new MainMenu(this.store, {
      onPlay: () => this.startGame(),
      onOptionChange: (key, value) => this._applyOption(key, value)
    });
    this.over = new GameOverScreen(this.store, {
      onRetry: () => this.startGame(),
      onMenu: () => this.toMenu()
    });
    this.pauseScreen = new PauseScreen({
      onResume: () => this.resume(),
      onRestart: () => this.startGame(),
      onMenu: () => this.toMenu()
    });

    this.audio = new AudioManager();
    this.audio.setSfxEnabled(this.store.get("sfx") !== false);
    this.audio.setMusicEnabled(this.store.get("music") !== false);
    // TouchControls needs the InputManager, so it is created in _setupInput.
    this.touch = null;
  }

  _setupInput() {
    this.input = new InputManager(this.canvas, {
      onPause: () => this.togglePause()
    });
    // Touch controls need the real input manager, so build them now.
    this.touch = new TouchControls(this.input);
    const touchPref = this.store.get("touch");
    this.touch.applyPreference(touchPref === null || touchPref === undefined ? IS_TOUCH_DEVICE : touchPref);
    this.menu.syncFromStore(IS_TOUCH_DEVICE);
  }

  _bindWindow() {
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
    window.addEventListener("orientationchange", () => setTimeout(this._onResize, 120));

    // Auto-pause when the tab is hidden so rabbits stop eating (AGENTS.md 63).
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === GameState.PLAYING) this.pause();
    });

    // Any first gesture unlocks audio.
    const unlock = () => this.audio.resume();
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });

    // If the player has not chosen a touch setting, a real touch reveals a
    // hybrid device we mis-detected at load time.
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      if (this.store.get("touch") !== null && this.store.get("touch") !== undefined) return;
      this.touch?.applyPreference(true);
    }, { passive: true });

    document.getElementById("btn-pause")?.addEventListener("click", () => this.togglePause());
  }

  /** Map stored settings onto the live systems. */
  _applyOption(key, value) {
    switch (key) {
      case "music":
        this.audio.setMusicEnabled(value);
        break;
      case "sfx":
        this.audio.setSfxEnabled(value);
        break;
      case "shadows":
        this.renderer.shadowMap.enabled = value && this.qualityKey !== QUALITY.LOW;
        if (this.world) this.world.sun.castShadow = this.renderer.shadowMap.enabled;
        this._forceMaterialUpdate();
        break;
      case "touch":
        this.touch.applyPreference(value);
        break;
      case "quality":
        this.hud.showHint("Quality applies on the next run.", 2.6);
        break;
      default:
        break;
    }
  }

  _forceMaterialUpdate() {
    this.renderer.shadowMap.needsUpdate = true;
    this.world?.scene.traverse((o) => {
      if (o.isMesh && o.material) o.material.needsUpdate = true;
    });
  }

  /* ============================================================ */
  /* Loading                                                      */
  /* ============================================================ */

  async load() {
    this.state = GameState.LOADING;
    this.menu.setLoading(0.02, "Loading garden…");

    this.assets = new AssetManager(this.renderer);
    await this.assets.load((f, label) => this.menu.setLoading(0.05 + f * 0.9, label));

    if (this.assets.errors.length) {
      console.warn("[Game] " + this.assets.report());
    }

    this.menu.setLoading(0.97, "Planting the carrot…");
    this._buildWorld();

    this.menu.setLoading(1, "Ready!");
    await new Promise((r) => setTimeout(r, 180));
    this.menu.hideLoading();
    this.toMenu();

    this._loop();
    return this;
  }

  _buildWorld() {
    const models = this.assets.models;

    this.world = new World(this.assets, this.quality);
    this.scene = this.world.scene;

    this.particles = new ParticleSystem(this.scene, this.quality.particleBudget);

    this.player = new Player(models.player);
    this.player.reset();
    this.scene.add(this.player.root);
    // The basis is computed in _setupCamera, which runs before the player
    // exists - hand it over now so screen-relative movement works.
    this._updateCameraBasis();

    this.waves = new WaveSystem({
      onWaveStart: (wave, info) => this._onWaveStart(wave, info),
      onWaveClear: (wave) => this._onWaveClear(wave)
    });

    this.spawns = new SpawnSystem({
      models,
      world: this.world,
      waves: this.waves,
      particles: this.particles,
      maxActive: this.quality.maxActiveRabbits
    });

    this.combat = new CombatSystem({
      player: this.player,
      world: this.world,
      spawns: this.spawns,
      particles: this.particles
    });
    this.combat.audio = this.audio;
    this.combat.onRabbitDefeated = (rabbit) => this._onRabbitDefeated(rabbit);
    this.combat.onHoleClosed = () => this._onHoleClosed();

    this.powerUps = new PowerUpSystem({
      models,
      world: this.world,
      player: this.player,
      particles: this.particles
    });
    this.powerUps.audio = this.audio;
    this.powerUps.onChange = (buffs) => this.hud.setBuffs(buffs);
    this.powerUps.onCollected = (id, def, position) => this._onPowerUpCollected(id, def, position);

    // Carrot feedback. The death callback is the single source of truth for
    // "the run is over", so it fires no matter what drained the last health.
    this.world.carrot.onDamaged = (dealt) => this._onCarrotDamaged(dealt);
    this.world.carrot.onDeath = () => this.gameOver();

    // Idle "look at the carrot" so the world feels alive before the first wave.
    this.player.position.set(0, 0, -4.2);
    this.player.facing = Math.atan2(0, 1);
    this.player.root.position.copy(this.player.position);
  }

  /* ============================================================ */
  /* State transitions                                            */
  /* ============================================================ */

  toMenu() {
    this.state = GameState.MENU;
    this.over.hide();
    this.pauseScreen.hide();
    this.hud.show(false);
    this.hud.reset();
    this.touch.reset();
    this.touch.setVisible(false);
    this.input.enabled = false;
    this.input.reset();
    this.canvas.classList.remove("is-playing");
    this.menu.showMenu();
    this.resetRun();
  }

  startGame() {
    this.audio.resume();
    this.menu.hideMenu();
    this.over.hide();
    this.pauseScreen.hide();
    this.resetRun();

    this.state = GameState.PLAYING;
    this.input.enabled = true;
    this.input.reset();
    this.canvas.classList.add("is-playing");
    this.hud.show(true);
    this.touch.reset();
    this.touch.setVisible(this.touch.forced ?? IS_TOUCH_DEVICE);

    this.waves.start();
    this.hud.showBanner(`WAVE ${this.waves.wave}`, 2);
    this.hud.bumpWave();

    // Contextual tutorial, wave 1 only.
    this._hintOnce("intro", "Protect the carrot!", 3);
    setTimeout(() => {
      if (this.state === GameState.PLAYING) {
        this._hintOnce("controls", controlHints(this.touch.visible), 5);
      }
    }, 3200);
  }

  /** Wipe the run without rebuilding anything. */
  resetRun() {
    this.score = 0;
    this.stats = { kills: 0, holesClosed: 0, powerUps: 0 };
    this._hintsShown.clear();

    this.world.reset();
    this.player.reset();
    this.particles.clear();
    this.spawns.reset();
    this.combat.reset();
    this.powerUps.reset();
    this.waves.reset();
    this.hud.reset();
  }

  pause() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.PAUSED;
    this.input.enabled = false;
    this.input.reset();
    this.pauseScreen.show();
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;
    this.pauseScreen.hide();
    this.state = GameState.PLAYING;
    this.input.enabled = true;
    this.input.reset();
    this.clock.getDelta();   // discard the paused time
  }

  togglePause() {
    if (this.state === GameState.PLAYING) this.pause();
    else if (this.state === GameState.PAUSED) this.resume();
  }

  gameOver() {
    if (this.state === GameState.GAME_OVER) return;
    this.state = GameState.GAME_OVER;
    this.input.enabled = false;
    this.input.reset();
    this.touch.reset();
    this.canvas.classList.remove("is-playing");
    this.audio.play("gameOver", { gain: 1 });
    this.hud.show(false);
    this.over.show({
      wave: Math.max(1, this.waves.wave),
      kills: this.stats.kills,
      holesClosed: this.stats.holesClosed,
      score: this.score
    });
  }

  /* ============================================================ */
  /* Gameplay callbacks                                           */
  /* ============================================================ */

  _onWaveStart(wave, info) {
    this.hud.setStatus(this.world.carrot, wave, this.score);
    this.hud.showBanner(`WAVE ${wave}`, 1.8);
    this.hud.bumpWave();
    this.audio.play("waveStart", { gain: 0.9 });

    const opened = this.spawns.openHoles(info.openHoles, this.player.position);
    if (opened > 0) {
      for (const hole of this.world.holes) {
        if (hole.canSpawn()) {
          this.particles.burst("dirt", hole.position, { count: 7, speed: 2.2, up: 2 });
        }
      }
    }
    this._hintOnce(
      "holes",
      this.touch.visible
        ? "Rabbits are coming! Tap <span class=\"hint-toast__key\">CLOSE</span> beside a hole."
        : "Rabbits are coming! Stand by a hole and press <span class=\"hint-toast__key\">E</span> to close it.",
      5
    );
  }

  _onWaveClear(wave) {
    this.score += GAME_CONFIG.score.waveClear;
    const healed = this.world.carrot.heal(GAME_CONFIG.wave.clearHeal);
    this.world.carrot.celebrate();
    this.audio.play("waveClear", { gain: 1 });
    this.particles.burst("sparkle", this.world.carrot.root.position, {
      count: 12, speed: 3, up: 3
    });
    this.particles.popText(
      `+${GAME_CONFIG.score.waveClear}`,
      this.world.carrot.root.position,
      "#ffd469",
      1.1
    );
    if (healed > 0) {
      this.particles.popText(
        `+${healed} 🥕`,
        this.world.carrot.root.position,
        "#b6e88a",
        0.9
      );
    }
    this.hud.showBanner("WAVE CLEAR!", 1.6);
    if (wave === 1) {
      this._hintOnce("attack", "Nice! Swing at rabbits to send them hopping away.", 4);
    }
  }

  _onRabbitDefeated(rabbit) {
    this.stats.kills += 1;
    this.score += GAME_CONFIG.score.rabbit;
    this.particles.popText(`+${GAME_CONFIG.score.rabbit}`, rabbit.position, "#fffaf0", 0.85);
    this.powerUps.maybeDrop(rabbit.position);
    this._hintOnce("attack", "Tap <span class=\"hint-toast__key\">HIT!</span> or press <span class=\"hint-toast__key\">Space</span> to attack.", 4);
  }

  _onHoleClosed() {
    this.stats.holesClosed += 1;
    this.score += GAME_CONFIG.score.hole;
    this.particles.popText(`+${GAME_CONFIG.score.hole}`, this.player.position, "#b6e88a", 0.8);
  }

  _onPowerUpCollected(id, def, position) {
    this.stats.powerUps += 1;
    this.score += GAME_CONFIG.score.powerUp;
    this.particles.popText(`+ ${def.label}!`, position, "#fffaf0", 1);
    this.player.flinch();
    this._hintOnce("powerup", "Buffs last a little while - use them to hold the line!", 3.4);
  }

  _onCarrotDamaged(dealt) {
    this.audio.play("carrotHurt", { gain: 0.85 });
    this.hud.flashDamage();
    this.isoCamera.shake(0.35);
    this.player.flinch();
    this.particles.burst("love", this.world.carrot.root.position, {
      count: 3, speed: 1.4, up: 2
    });
    this.particles.popText(`-${dealt}`, this.world.carrot.root.position, "#ff9d76", 0.8);
  }

  _hintOnce(key, html, seconds) {
    if (this._hintsShown.has(key)) return;
    this._hintsShown.add(key);
    this.hud.showHint(html, seconds);
  }

  /* ============================================================ */
  /* Loop                                                         */
  /* ============================================================ */

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    // Clamp delta so a tab switch or a stall cannot teleport the simulation.
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.render();
  };

  update(dt) {
    if (this.state === GameState.PAUSED) {
      // Frozen: nothing advances, not even the cosmetic clock, so a pause can
      // never let a rabbit sneak in a bite.
      return;
    }

    this.time += dt;
    this._fpsSamples.push(dt);
    if (this._fpsSamples.length > 30) this._fpsSamples.shift();

    this.hud.update(dt);

    // The garden stays alive in every state - it is the menu backdrop too.
    this.world.update(dt);
    this.isoCamera.update(dt, this.player?.position ?? null);
    this.particles.update(dt);

    if (!isSimulating(this.state)) return;

    /* ---------------- gameplay ---------------- */
    const move = this.input.getMovement();
    this.player.update(dt, move, this.world);

    this.waves.update(dt, { rabbitsAlive: this.spawns.activeCount });

    this.spawns.update(dt, {
      playerPos: this.player.position,
      audio: this.audio,
      onSpawn: (rabbit) => this._onRabbitSpawned(rabbit)
    });

    this.combat.update(dt, {
      attackPressed: this.input.isAttackPressed(),
      interactPressed: this.input.isInteractPressed()
    });

    // Rabbits
    const ctx = {
      carrot: this.world.carrot,
      others: this.spawns.rabbits,
      onBite: (rabbit) => this._onRabbitBite(rabbit)
    };
    for (let i = this.spawns.rabbits.length - 1; i >= 0; i--) {
      const rabbit = this.spawns.rabbits[i];
      rabbit.update(dt, ctx);
      if (!rabbit.active) this.spawns.pool.releaseAt(i);
    }

    this.powerUps.update(dt);

    /* ---------------- feedback polish ---------------- */
    const targets = this.combat.probeTargets();
    if (this.touch.visible) {
      this.touch.setAttackReady(targets > 0);
      const nearHole = !!this.world.findClosableHole(
        this.player.position,
        this.player.cfg.interactRange
      );
      this.touch.setInteractReady(nearHole);
    }

    this.hud.setStatus(this.world.carrot, this.waves.wave, this.score);
    if (DEBUG) this._updateDebug(dt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /* ============================================================ */
  /* Small events                                                 */
  /* ============================================================ */

  _onRabbitSpawned() {
    this._hintOnce("firstRabbit", "Stop the rabbits before they reach the carrot!", 3.5);
  }

  _onRabbitBite(rabbit) {
    // Carrot.onDeath ends the run, so nothing to do here beyond the bite.
    this.world.carrot.takeDamage(rabbit.biteDamage);
  }

  /* ============================================================ */
  /* Resize / camera / debug                                     */
  /* ============================================================ */

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.isoCamera.resize(w, h);
    this._updateCameraBasis();
  }

  /** Work out which world direction is "screen up" so WASD feels natural. */
  _updateCameraBasis() {
    this.camera.getWorldDirection(this._camDir);
    this._camUp.set(this._camDir.x, 0, this._camDir.z).normalize();
    this._camRight.crossVectors(this._camDir, this._worldUp).normalize();
    if (this._camRight.lengthSq() < 0.0001) this._camRight.set(1, 0, 0);
    this.player?.setCameraBasis(this._camRight, this._camUp);
  }

  _updateDebug(dt) {
    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    this._fps = 1 / Math.max(avg, 0.0001);
    const info = this.renderer.info.render;
    this.hud.setDebug(
      [
        `fps      ${this._fps.toFixed(0)}`,
        `state    ${this.state}`,
        `wave     ${this.waves.wave} (${this.waves.phase})`,
        `rabbits  ${this.spawns.activeCount} / ${this.quality.maxActiveRabbits}`,
        `holes    ${this.world.openHoles.length} open`,
        `powerups ${this.powerUps.activeCount}`,
        `calls    ${info.calls}`,
        `tris     ${info.triangles}`,
        `quality  ${this.qualityKey}`,
        `player   ${this.player.position.x.toFixed(1)}, ${this.player.position.z.toFixed(1)}`
      ].join("\n")
    );
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    this.input.dispose();
    this.audio.stopMusic();
    this.world?.dispose();
    this.renderer.dispose();
  }
}