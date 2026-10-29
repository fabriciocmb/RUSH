type SoundKind = 'beep' | 'rush' | 'break' | 'complete';

/**
 * Original tones synthesized with the Web Audio API.
 * The context is created on the start gesture so mobile browsers allow playback.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.8;
  private muted = false;
  private playedAt = new Map<string, number>();

  prime(): void {
    this.ensureContext();
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state !== 'running') {
      try {
        await context.resume();
      } catch {
        return;
      }
    }
    this.blip();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  playBeep(key: string, offset = 0): void {
    this.play('beep', key, offset);
  }

  playRush(key: string): void {
    this.play('rush', key, 0);
  }

  playBreak(key: string): void {
    this.play('break', key, 0);
  }

  playComplete(key: string): void {
    this.play('complete', key, 0);
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      const context = new AudioCtx();
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 4;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.08;
      master.gain.value = this.muted ? 0 : this.volume;
      master.connect(compressor);
      compressor.connect(context.destination);
      this.context = context;
      this.master = master;
      return context;
    } catch {
      return null;
    }
  }

  private applyGain(): void {
    if (!this.context || !this.master) return;
    const value = this.muted ? 0 : this.volume;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(Math.max(0.0001, value), this.context.currentTime, 0.015);
    if (value === 0) {
      this.master.gain.setValueAtTime(0, this.context.currentTime + 0.05);
    }
  }

  private remember(key: string, time: number): boolean {
    const previous = this.playedAt.get(key);
    if (previous != null && time - previous < 0.25) return false;
    this.playedAt.set(key, time);
    if (this.playedAt.size > 240) {
      for (const [storedKey, storedAt] of this.playedAt) {
        if (time - storedAt > 20) this.playedAt.delete(storedKey);
      }
    }
    return true;
  }

  private play(kind: SoundKind, key: string, offset: number, allowRetry = true): void {
    if (!this.context || !this.master || this.muted || this.volume <= 0) return;
    if (this.context.state !== 'running') {
      if (!allowRetry) return;
      void this.context
        .resume()
        .then(() => this.play(kind, key, offset, false))
        .catch(() => undefined);
      return;
    }
    const when = this.context.currentTime + Math.max(0, offset);
    if (!this.remember(key, when)) return;
    if (kind === 'beep') this.scheduleBeep(when);
    if (kind === 'rush') this.scheduleRush(when);
    if (kind === 'break') this.scheduleBreak(when);
    if (kind === 'complete') this.scheduleComplete(when);
  }

  private blip(): void {
    if (!this.context || !this.master) return;
    const buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    source.start();
  }

  /** Instant attack, short decay. Square and saw cut through a noisy room. */
  private pierce(
    frequency: number,
    when: number,
    duration: number,
    peak: number,
    type: OscillatorType,
  ): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    const level = Math.max(0.0001, peak);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  private tick(when: number, duration: number, peak: number): void {
    if (!this.context || !this.master) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const envelope = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * envelope * envelope;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2200, when);
    gain.gain.setValueAtTime(Math.max(0.0001, peak), when);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(when);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private scheduleBeep(when: number): void {
    this.pierce(2480, when, 0.05, 0.82, 'square');
    this.pierce(3720, when, 0.028, 0.34, 'square');
    this.tick(when, 0.012, 0.45);
  }

  private scheduleRush(when: number): void {
    this.pierce(1760, when, 0.06, 0.9, 'square');
    this.pierce(3520, when, 0.03, 0.28, 'square');
    this.tick(when, 0.014, 0.5);
    this.pierce(2340, when + 0.08, 0.08, 0.98, 'sawtooth');
    this.pierce(4680, when + 0.08, 0.04, 0.24, 'square');
  }

  private scheduleBreak(when: number): void {
    this.pierce(494, when, 0.1, 0.88, 'square');
    this.pierce(740, when, 0.055, 0.4, 'square');
  }

  private scheduleComplete(when: number): void {
    this.pierce(988, when, 0.07, 0.8, 'square');
    this.pierce(1480, when + 0.08, 0.07, 0.86, 'square');
    this.pierce(1976, when + 0.16, 0.11, 0.95, 'square');
    this.pierce(2960, when + 0.16, 0.06, 0.3, 'sawtooth');
  }
}

export const audio = new SoundEngine();
