// Optional generative ambient drone. A small detuned pad runs through a slowly
// breathing lowpass filter into a feedback-delay "reverb". Field energy nudges
// the filter cutoff and overall gain, so denser, faster fields sound brighter.
//
// Everything here fails silent: if the Web Audio API is unavailable or a node
// throws, the visual piece is unaffected. Muted by default; starting requires a
// user gesture (browser autoplay policy), which the UI provides.

const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic semitone offsets
const ROOT = 110;               // A2, in Hz

function hzFromStep(step) {
  return ROOT * Math.pow(2, step / 12);
}

export class Ambient {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.ready = false;
    this.energy = 0;
    this._chordTimer = 0;
  }

  // Must be called from a user gesture the first time.
  async toggle() {
    if (!this.enabled) {
      const ok = await this._ensure();
      if (!ok) return false;
      this.enabled = true;
      this._ramp(this.master.gain, 0.18, 2.5);
    } else {
      this.enabled = false;
      if (this.master) this._ramp(this.master.gain, 0.0001, 1.5);
    }
    return this.enabled;
  }

  async _ensure() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (_) {} }
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      await ctx.resume();

      const master = ctx.createGain();
      master.gain.value = 0.0001;

      // feedback-delay reverb-ish tail
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.37;
      const fb = ctx.createGain();
      fb.gain.value = 0.45;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(master);

      // lowpass the whole pad
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 0.8;
      filter.connect(master);
      filter.connect(delay);

      // slow LFO breathing the cutoff
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
      lfo.start();

      // three detuned voices
      const voices = [];
      const padGain = ctx.createGain();
      padGain.gain.value = 0.5;
      padGain.connect(filter);
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        osc.type = i === 2 ? 'triangle' : 'sawtooth';
        osc.detune.value = (i - 1) * 7;
        const g = ctx.createGain();
        g.gain.value = i === 2 ? 0.18 : 0.32;
        osc.connect(g); g.connect(padGain);
        osc.start();
        voices.push(osc);
      }

      master.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
      this.filter = filter;
      this.voices = voices;
      this.ready = true;
      this._setChord();
      return true;
    } catch (_) {
      return false;
    }
  }

  setEnergy(e) {
    this.energy = e;
  }

  update(dt) {
    if (!this.ready || !this.enabled) return;
    const now = this.ctx.currentTime;
    // energy -> brightness & loudness
    const cutoff = 320 + this.energy * 1800;
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.4);
    this.master.gain.setTargetAtTime(0.12 + this.energy * 0.12, now, 0.6);

    // occasionally drift to a new chord
    this._chordTimer -= dt;
    if (this._chordTimer <= 0) {
      this._setChord();
      this._chordTimer = 9 + Math.random() * 8;
    }
  }

  _setChord() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const baseOct = Math.random() < 0.5 ? 0 : 12;
    this.voices.forEach((osc, i) => {
      const step = SCALE[(i * 2) % SCALE.length] + baseOct + (i === 2 ? 12 : 0);
      osc.frequency.setTargetAtTime(hzFromStep(step), now, 1.2);
    });
  }

  _ramp(param, to, time) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(to, now, time / 3);
  }
}
