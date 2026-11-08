/**
 * AudioManager.js
 * Every sound in the game is synthesised with the Web Audio API, so the project
 * needs no audio files and still works fully offline.
 *
 * Autoplay policy: the context is created lazily and resumed on the first user
 * gesture (AGENTS.md 41). Music and SFX can be toggled independently.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

/** Pentatonic degrees for the cozy music loop (C major pentatonic). */
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
const BASS = [36, 36, 41, 43];

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.started = false;
    this.available = typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
  }

  /** Create the graph. Safe to call repeatedly. */
  init() {
    if (!this.available || this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.master);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);

      this._noise = this._makeNoiseBuffer();
    } catch (err) {
      console.warn("[AudioManager] disabled:", err.message);
      this.available = false;
    }
  }

  /** Call from a real user gesture. */
  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    if (!this.started) {
      this.started = true;
      if (this.musicEnabled) this.startMusic();
    }
  }

  setSfxEnabled(on) {
    this.sfxEnabled = on;
  }

  setMusicEnabled(on) {
    this.musicEnabled = on;
    if (!on) this.stopMusic();
    else if (this.started) this.startMusic();
  }

  /* ------------------------------------------------------------ */
  /* Primitives                                                   */
  /* ------------------------------------------------------------ */

  _makeNoiseBuffer() {
    const len = this.ctx.sampleRate * 0.6;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }

  /**
   * One enveloped oscillator voice.
   * @param {{type?:string,from:number,to?:number,dur?:number,gain?:number,delay?:number,attack?:number}} o
   */
  _tone({ type = "sine", from, to, dur = 0.16, gain = 0.3, delay = 0, attack = 0.008, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== undefined && to !== from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Filtered noise burst - dust, poofs, whooshes. */
  _noiseBurst({ dur = 0.18, gain = 0.25, delay = 0, freq = 1200, q = 1, type = "bandpass" }) {
    if (!this.ctx || !this._noise) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ------------------------------------------------------------ */
  /* Sound library                                                */
  /* ------------------------------------------------------------ */

  /**
   * @param {string} name
   * @param {{pitch?:number, gain?:number}} [opt]
   */
  play(name, opt = {}) {
    if (!this.available) return;
    this.init();
    if (!this.ctx || !this.sfxEnabled) return;
    if (this.ctx.state === "suspended") return; // wait for the gesture

    const p = opt.pitch ?? 1;
    const v = opt.gain ?? 1;

    switch (name) {
      case "ui":
        this._tone({ type: "triangle", from: NOTE(76) * p, to: NOTE(83) * p, dur: 0.09, gain: 0.16 * v });
        break;

      case "attack":
        this._noiseBurst({ dur: 0.13, gain: 0.2 * v, freq: 2400, q: 0.7 });
        this._tone({ type: "triangle", from: NOTE(72) * p, to: NOTE(60) * p, dur: 0.11, gain: 0.16 * v });
        break;

      case "hit":
        this._tone({ type: "square", from: NOTE(72) * p, to: NOTE(64) * p, dur: 0.1, gain: 0.12 * v });
        this._noiseBurst({ dur: 0.1, gain: 0.16 * v, freq: 1800 });
        break;

      case "rabbitDown":
        this._tone({ type: "triangle", from: NOTE(74) * p, to: NOTE(48) * p, dur: 0.24, gain: 0.2 * v });
        this._noiseBurst({ dur: 0.2, gain: 0.14 * v, freq: 900 });
        break;

      case "spawn":
        this._tone({ type: "sine", from: NOTE(60) * p, to: NOTE(74) * p, dur: 0.2, gain: 0.14 * v });
        this._noiseBurst({ dur: 0.22, gain: 0.1 * v, freq: 500, q: 1.4 });
        break;

      case "holeOpen":
        this._noiseBurst({ dur: 0.3, gain: 0.16 * v, freq: 420, q: 0.8 });
        this._tone({ type: "sine", from: NOTE(45) * p, to: NOTE(52) * p, dur: 0.28, gain: 0.13 * v });
        break;

      case "holeClose":
        this._noiseBurst({ dur: 0.26, gain: 0.24 * v, freq: 700, q: 0.6 });
        this._tone({ type: "sine", from: NOTE(52) * p, to: NOTE(33) * p, dur: 0.2, gain: 0.22 * v });
        this._tone({ type: "triangle", from: NOTE(64) * p, dur: 0.14, gain: 0.1 * v, delay: 0.04 });
        break;

      case "carrotHurt":
        this._tone({ type: "sawtooth", from: NOTE(55) * p, to: NOTE(41) * p, dur: 0.22, gain: 0.13 * v });
        break;

      case "powerup":
        [0, 4, 7, 12].forEach((s, i) =>
          this._tone({ type: "triangle", from: NOTE(72 + s) * p, dur: 0.16, gain: 0.15 * v, delay: i * 0.055 })
        );
        break;

      case "waveStart":
        [0, 2, 4, 7].forEach((s, i) =>
          this._tone({ type: "triangle", from: NOTE(64 + s) * p, dur: 0.26, gain: 0.16 * v, delay: i * 0.09 })
        );
        break;

      case "waveClear":
        [0, 4, 7, 12, 16].forEach((s, i) =>
          this._tone({ type: "triangle", from: NOTE(65 + s) * p, dur: 0.3, gain: 0.15 * v, delay: i * 0.1 })
        );
        break;

      case "gameOver":
        [0, -3, -5, -12].forEach((s, i) =>
          this._tone({ type: "triangle", from: NOTE(69 + s) * p, dur: 0.42, gain: 0.17 * v, delay: i * 0.16 })
        );
        break;

      case "pickup":
        this._tone({ type: "sine", from: NOTE(79) * p, to: NOTE(86) * p, dur: 0.12, gain: 0.13 * v });
        break;

      default:
        console.warn("[AudioManager] unknown sound:", name);
    }
  }

  /* ------------------------------------------------------------ */
  /* Music: a gentle 16-step pentatonic loop                      */
  /* ------------------------------------------------------------ */

  startMusic() {
    if (!this.available || this.musicTimer || !this.musicEnabled) return;
    this.init();
    if (!this.ctx) return;

    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.16, this.ctx.currentTime + 2);

    const stepTime = 0.32; // ~94 BPM sixteenths feel
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      // Look ahead 0.25s and schedule every step that falls in the window.
      while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
        this._scheduleStep(this.musicStep, this.nextNoteTime, stepTime);
        this.musicStep = (this.musicStep + 1) % 16;
        this.nextNoteTime += stepTime;
      }
    }, 60);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx && this.musicGain) {
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value || 0.0001, t);
      this.musicGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    }
  }

  _scheduleStep(step, time, stepTime) {
    const dest = this.musicGain;
    // gentle arpeggio
    const deg = SCALE[[0, 2, 4, 2, 6, 4, 7, 4, 3, 2, 5, 4, 8, 6, 5, 2][step]];
    this._voice(NOTE(deg), time, stepTime * 1.5, 0.05, dest);
    // soft bass on the downbeats
    if (step % 4 === 0) {
      const b = BASS[Math.floor(step / 4) % BASS.length];
      this._voice(NOTE(b), time, stepTime * 3, 0.075, dest, "sine");
    }
    // gentle hat
    if (step % 2 === 1) this._hat(time, dest);
  }

  _voice(freq, time, dur, gain, dest, type = "triangle") {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  _hat(time, dest) {
    if (!this._noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.02, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    src.connect(hp);
    hp.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + 0.08);
  }
}