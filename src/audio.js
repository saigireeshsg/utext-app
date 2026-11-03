// Procedural sound design — everything is synthesized with the Web Audio API,
// so there are no audio files to load. Must be started from a user gesture.

function makeNoiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Slightly "brown" noise: smoother and more like friction than pure white.
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.035 * white) / 1.035;
    data[i] = last * 3.2 + white * 0.25;
  }
  return buffer;
}

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    // Mobile Safari starts contexts suspended even inside a tap handler.
    if (ctx.state === "suspended") ctx.resume();
    this.noise = makeNoiseBuffer(ctx);

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this._buildSlide();
    this._buildPour();
    this._buildSand();
    this._buildAmbience();
  }

  /* ---- Continuous glass-sliding-on-a-surface layer ---- */
  _buildSlide() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;

    // Friction body
    this.slideBand = ctx.createBiquadFilter();
    this.slideBand.type = "bandpass";
    this.slideBand.Q.value = 0.9;
    this.slideBand.frequency.value = 500;

    // Glassy "squeak" partial riding on top
    this.slideRing = ctx.createBiquadFilter();
    this.slideRing.type = "bandpass";
    this.slideRing.Q.value = 18;
    this.slideRing.frequency.value = 2400;
    this.slideRingGain = ctx.createGain();
    this.slideRingGain.gain.value = 0.0;

    this.slideGain = ctx.createGain();
    this.slideGain.gain.value = 0;

    // Stereo position follows the glass
    this.slidePan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();

    src.connect(this.slideBand).connect(this.slideGain);
    src.connect(this.slideRing).connect(this.slideRingGain).connect(this.slideGain);
    this.slideGain.connect(this.slidePan).connect(this.master);
    src.start();
  }

  /**
   * Drive the slide layer every frame.
   * @param {number} speed     0..1 normalized velocity
   * @param {number} proximity 0..1 (1 = right in front of the listener)
   * @param {number} pan      -1..1
   */
  updateSlide(speed, proximity, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const loud = Math.pow(speed, 0.8) * (0.15 + 0.85 * proximity);
    // Tiny random jitter makes the friction feel textured, not like a hiss.
    const grain = 0.85 + Math.random() * 0.3;
    this.slideGain.gain.setTargetAtTime(loud * 0.55 * grain, t, 0.03);
    this.slideBand.frequency.setTargetAtTime(180 + speed * 700 + proximity * 350, t, 0.05);
    this.slideRing.frequency.setTargetAtTime(1900 + speed * 900, t, 0.08);
    this.slideRingGain.gain.setTargetAtTime(speed * 0.22, t, 0.05);
    if (this.slidePan.pan) this.slidePan.pan.setTargetAtTime(pan, t, 0.05);
  }

  /* ---- One-shots for the moment the glass stops ---- */
  arrive() {
    if (!this.ctx) return;
    this._clink();
    this._slosh();
  }

  _clink(level = 0.22) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(this.master);
    // Inharmonic partials of a struck glass.
    const base = 1320;
    [1, 2.32, 4.25, 6.63].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = base * ratio * (1 + (Math.random() - 0.5) * 0.004);
      const g = ctx.createGain();
      const peak = 0.5 / (i + 1);
      const decay = 1.6 / (i * 0.7 + 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    });
  }

  _slosh() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(this.master);

    // Three damped "waves" of water hitting the glass wall.
    const waves = [0, 0.32, 0.6];
    waves.forEach((dt, i) => {
      const amp = 0.5 / (i + 1);
      const s = t + 0.05 + dt;
      g.gain.setTargetAtTime(amp, s, 0.03);
      g.gain.setTargetAtTime(0.0, s + 0.12, 0.08);
      lp.frequency.setValueAtTime(380, s);
      lp.frequency.exponentialRampToValueAtTime(1500 - i * 300, s + 0.08);
      lp.frequency.exponentialRampToValueAtTime(300, s + 0.28);
    });
    src.start(t);
    src.stop(t + 1.6);

    // A couple of tiny droplet "blips".
    [0.18, 0.47].forEach((dt) => {
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      const s = t + dt;
      osc.frequency.setValueAtTime(900 + Math.random() * 300, s);
      osc.frequency.exponentialRampToValueAtTime(2200, s + 0.06);
      og.gain.setValueAtTime(0.0001, s);
      og.gain.exponentialRampToValueAtTime(0.08, s + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      osc.connect(og).connect(this.master);
      osc.start(s);
      osc.stop(s + 0.1);
    });
  }

  /* ---- Low "system" hum underneath everything ---- */
  _buildAmbience() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.03, ctx.currentTime + 0.5, 2.5);
    g.connect(this.master);
    [55, 82.6, 110.4].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.6;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(g);
      osc.start();
      lfo.start();
    });
  }

  /* ---- Pouring water (the drinking stream) ---- */
  _buildPour() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.pourFilter = ctx.createBiquadFilter();
    this.pourFilter.type = "bandpass";
    this.pourFilter.Q.value = 2.5;
    this.pourFilter.frequency.value = 900;
    this.pourGain = ctx.createGain();
    this.pourGain.gain.value = 0;
    src.connect(this.pourFilter).connect(this.pourGain).connect(this.master);
    src.start();
  }

  /* ---- Fine sand running out of a funnel: a soft, grainy hiss ---- */
  _buildSand() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const peak = ctx.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = 5200;
    peak.gain.value = 6;
    this.sandGain = ctx.createGain();
    this.sandGain.gain.value = 0;
    src.connect(hp).connect(peak).connect(this.sandGain).connect(this.master);
    src.start();
  }

  /** rate 0..1 */
  setSand(rate) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // random flutter = individual grains ticking
    const grain = 0.7 + Math.random() * 0.6;
    this.sandGain.gain.setTargetAtTime(rate * 0.16 * grain, t, 0.02);
  }

  /** rate 0..1; pitch 0..1 rises as a vessel fills (that's how you hear a glass filling) */
  setPour(rate, pitch = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const gurgle = 0.75 + Math.random() * 0.5;
    this.pourGain.gain.setTargetAtTime(rate * 0.32 * gurgle, t, 0.03);
    this.pourFilter.frequency.setTargetAtTime(500 + pitch * 1400 + Math.random() * 250, t, 0.02);
  }

  /** One swallow: a soft low "glk". */
  gulp() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const f = 190 + Math.random() * 40;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  /** Glass set back down on the table. */
  setDown() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    thud.connect(tg).connect(this.master);
    thud.start(t);
    thud.stop(t + 0.16);
    this._clink(0.1);
  }

  /* Heavy stage-light switch: a low thunk plus a click. */
  spotOn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.45);

    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t);
    cg.gain.exponentialRampToValueAtTime(0.35, t + 0.002);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    click.connect(hp).connect(cg).connect(this.master);
    click.start(t);
    click.stop(t + 0.06);
  }

  /* Soft air whoosh as the message slides in. */
  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.35);
    bp.frequency.exponentialRampToValueAtTime(600, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) {
      pan.pan.setValueAtTime(-0.8, t);
      pan.pan.linearRampToValueAtTime(0.1, t + 0.9);
    }
    src.connect(bp).connect(g).connect(pan).connect(this.master);
    src.start(t);
    src.stop(t + 1.05);
  }

  toggleMute() {
    if (!this.ctx) return this.muted;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.08);
    return this.muted;
  }
}
