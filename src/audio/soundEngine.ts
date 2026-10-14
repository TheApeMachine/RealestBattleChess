class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playChessSelect() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playChessMove() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Marble thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playArenaTransition() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep tectonic brass/synth swell
    const freqs = [110, 164.81, 220, 329.63];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.5, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.55);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.5);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85);
    });
  }

  public playSwing(heavy: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = heavy ? 0.22 : 0.12;

    // White noise burst filtered for whoosh
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(heavy ? 420 : 880, now);
    filter.frequency.exponentialRampToValueAtTime(heavy ? 180 : 340, now + dur);
    filter.Q.value = 2.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(heavy ? 0.22 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playHit(type: 'light' | 'heavy' | 'special' | 'finisher') {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'light') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.11);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'heavy') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      // Finisher or Special impact: dual harmonic crunch
      [150, 225, 450].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = idx === 0 ? 'sawtooth' : 'square';
        o.frequency.setValueAtTime(freq, now);
        o.frequency.exponentialRampToValueAtTime(freq * 0.28, now + 0.28);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.3);
      });
    }
  }

  public playBlock(isParry: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (isParry) {
      // High metallic resonant ring!
      [880, 1320, 1760].forEach((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 1.15, now + 0.32);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      });
    } else {
      // Metallic clank
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  }

  public playSpecialActivate() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + i * 0.04;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, start + 0.25);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  }

  public playKO() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Dramatic gong + low sub drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.8);
    subGain.gain.setValueAtTime(0.45, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.85);

    [220, 277.18, 329.63, 440].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    });
  }
}

export const soundEngine = new SoundEngine();
