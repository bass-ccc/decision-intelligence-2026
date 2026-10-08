// All sound is synthesised live with WebAudio — no files.
// Rain on the city, a choir-like pad made of formant-filtered voices, a muffled
// sea, a digital hum in the Net; a bell at each article, a splash when you dive,
// a drum at each chapter.

const PAD = [110, 164.81, 196, 261.63]; // A minor-ish, open
const VOWEL_A = [800, 1150, 2900];
const VOWEL_O = [450, 800, 2830];
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];

export class Sound {
  constructor() {
    this.on = true;
    this.ctx = null;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const now = ctx.currentTime;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 18000;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(this.lp).connect(comp).connect(ctx.destination);

    // noise buffer (brown-ish)
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.04 * w) / 1.04;
        d[i] = last * 2.5 + w * 0.12;
      }
    }
    this.noise = buf;

    // rain: two bands of noise
    const rain = ctx.createBufferSource();
    rain.buffer = buf;
    rain.loop = true;
    const rh = ctx.createBiquadFilter();
    rh.type = 'highpass';
    rh.frequency.value = 900;
    const rl = ctx.createBiquadFilter();
    rl.type = 'lowpass';
    rl.frequency.value = 7000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.0;
    rain.connect(rh).connect(rl).connect(this.rainGain).connect(this.master);
    rain.start(now);

    // pad: sawtooth voices through vowel formants
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.05;
    this.formants = VOWEL_A.map((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 9;
      const g = ctx.createGain();
      g.gain.value = [1, 0.5, 0.18][i];
      bp.connect(g).connect(this.padGain);
      return bp;
    });
    this.padGain.connect(this.master);
    this.voices = PAD.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 6;
      const vib = ctx.createOscillator();
      vib.frequency.value = 4.6 + i * 0.3;
      const vg = ctx.createGain();
      vg.gain.value = 3;
      vib.connect(vg).connect(o.detune);
      vib.start(now);
      const g = ctx.createGain();
      g.gain.value = [0.5, 0.32, 0.26, 0.18][i];
      o.connect(g);
      this.formants.forEach((bp) => g.connect(bp));
      o.start(now);
      return o;
    });
    // slow breathing of the pad
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.025;
    lfo.connect(lg).connect(this.padGain.gain);
    lfo.start(now);

    // deep drone (sea and Net)
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.drone = [55, 82.4].map((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(this.droneGain);
      o.start(now);
      return o;
    });
    this.droneGain.connect(this.master);

    // digital hum (Net)
    this.digGain = ctx.createGain();
    this.digGain.gain.value = 0;
    const dig = ctx.createOscillator();
    dig.type = 'square';
    dig.frequency.value = 110;
    const df = ctx.createBiquadFilter();
    df.type = 'lowpass';
    df.frequency.value = 420;
    df.Q.value = 6;
    const dl = ctx.createOscillator();
    dl.frequency.value = 0.2;
    const dlg = ctx.createGain();
    dlg.gain.value = 200;
    dl.connect(dlg).connect(df.frequency);
    dl.start(now);
    dig.connect(df).connect(this.digGain).connect(this.master);
    dig.start(now);

    this.env = { rain: 1, under: 0, net: 0 };
    this.set(this.on);
  }

  set(on) {
    this.on = on;
    if (!this.ctx) return;
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.4);
  }

  // continuous mix from the world
  mix({ rain, under, net, dawn }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const e = this.env;
    if (Math.abs(e.rain - rain) > 0.02 || Math.abs(e.under - under) > 0.02 || Math.abs(e.net - net) > 0.02 || Math.abs((e.dawn || 0) - dawn) > 0.02) {
      this.rainGain.gain.setTargetAtTime(rain * 0.16, t, 0.5);
      this.lp.frequency.setTargetAtTime(under > 0.5 && net < 0.5 ? 700 : 18000, t, 0.25);
      this.droneGain.gain.setTargetAtTime(Math.max(under, net) * 0.06, t, 1.2);
      this.digGain.gain.setTargetAtTime(net * 0.018, t, 1);
      const vowel = net > 0.5 ? VOWEL_O : VOWEL_A;
      this.formants.forEach((bp, i) => bp.frequency.setTargetAtTime(vowel[i] * (1 + dawn * 0.1), t, 2));
      this.padGain.gain.setTargetAtTime(0.05 + dawn * 0.03, t, 2);
      Object.assign(e, { rain, under, net, dawn });
    }
  }

  bell(n = 0) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const f = 440 * Math.pow(2, SCALE[n % SCALE.length] / 12);
    [1, 2.76, 5.4].forEach((m, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime([0.06, 0.02, 0.008][i], t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3 - i * 0.7);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 3.2);
    });
  }

  noiseHit(dur, f0, f1, gain, type = 'bandpass') {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.1);
  }

  splash() {
    this.noiseHit(1.6, 3000, 200, 0.32, 'lowpass');
    this.drum(0.5);
  }

  whoosh() {
    this.noiseHit(1.6, 300, 2600, 0.14);
  }

  glitch() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 200 + Math.random() * 1800;
      const g = ctx.createGain();
      const s = t + i * 0.06 + Math.random() * 0.03;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.03, s + 0.005);
      g.gain.linearRampToValueAtTime(0, s + 0.05);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.06);
    }
  }

  drum(v = 1) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.2);
    this.noiseHit(0.3, 900, 200, 0.08 * v, 'lowpass');
  }

  ghost(on) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(on ? 330 : 660, t);
    o.frequency.exponentialRampToValueAtTime(on ? 990 : 220, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.6);
  }
}
