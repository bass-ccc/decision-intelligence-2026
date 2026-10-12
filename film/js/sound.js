// All sound is made live with WebAudio — no audio files.
// A low drone that changes key with each chapter, a whoosh for every shatter,
// a soft tick when a glyph lights up, and a bell when an article opens.

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
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // drone: three detuned voices through a slowly breathing low-pass
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 420;
    this.lp.Q.value = 3;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.09;
    this.lp.connect(droneGain).connect(this.master);
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(this.lp.frequency);
    lfo.start();
    this.voices = [1, 1.5, 2.01].map((m, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = 110 * m;
      o.detune.value = (i - 1) * 7;
      const g = ctx.createGain();
      g.gain.value = [0.8, 0.35, 0.22][i];
      o.connect(g).connect(this.lp);
      o.start();
      return { o, m };
    });
    this.setOn(this.on);
  }

  setOn(on) {
    this.on = on;
    if (!this.ctx) return;
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.4);
  }

  key(root) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.voices.forEach(({ o, m }) => o.frequency.setTargetAtTime(root * m, t, 1.2));
  }

  whoosh() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 2);
  }

  tick(pitch = 1) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 1760 * pitch;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.08);
  }

  bell(root = 440) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [1, 2.76, 5.4].forEach((m, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = root * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime([0.09, 0.04, 0.02][i], t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 2.4 - i * 0.6);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 2.5);
    });
  }
}
