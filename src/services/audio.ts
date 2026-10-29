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
      master.gain.value = this.muted ? 0 : this.volume;
      master.connect(context.destination);
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

  private tone(
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
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  private bell(frequency: number, when: number, duration: number, peak: number): void {
    this.tone(frequency, when, duration, peak, 'sine');
    this.tone(frequency * 2, when, duration * 0.55, peak * 0.22, 'sine');
    this.tone(frequency * 2.76, when, duration * 0.3, peak * 0.07, 'triangle');
  }

  private scheduleBeep(when: number): void {
    this.tone(1480, when, 0.07, 0.2, 'sine');
    this.tone(1480, when, 0.02, 0.04, 'square');
  }

  private scheduleRush(when: number): void {
    this.bell(740, when, 0.18, 0.34);
    this.bell(988, when + 0.13, 0.26, 0.38);
  }

  private scheduleBreak(when: number): void {
    this.bell(392, when, 0.34, 0.3);
  }

  private scheduleComplete(when: number): void {
    this.bell(523.25, when, 0.18, 0.28);
    this.bell(659.25, when + 0.14, 0.18, 0.28);
    this.bell(783.99, when + 0.28, 0.26, 0.32);
  }
}

export const audio = new SoundEngine();
