import wakeVideoUrl from '../assets/keep-awake.mp4';

/**
 * Keeps the phone screen on for the whole workout session.
 * The Screen Wake Lock request has to start inside the start tap.
 * A silent looping video covers phones that ignore or drop that lock
 * (common on iOS and on some Android skins).
 */
class ScreenAwake {
  private wanted = false;
  private generation = 0;
  private requesting = false;
  private blocked = false;
  private sentinel: WakeLockSentinel | null = null;
  private video: HTMLVideoElement | null = null;
  private watch = 0;
  private listening = false;

  warm(): void {
    this.ensureVideo();
  }

  /** Call synchronously from the start tap, before any await. */
  enable(): void {
    this.wanted = true;
    this.blocked = false;
    this.listen();
    this.armWatch();
    if (this.shouldKeepVideo()) this.startVideo();
    else this.stopVideo();
    this.requestLock();
  }

  disable(): void {
    this.wanted = false;
    this.generation += 1;
    this.requesting = false;
    this.clearWatch();
    this.stopVideo();
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (!sentinel) return;
    void sentinel.release().catch(() => undefined);
  }

  private listen(): void {
    if (this.listening || typeof document === 'undefined') return;
    this.listening = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.wanted || document.visibilityState !== 'visible') return;
      this.enable();
    });
    window.addEventListener('pageshow', () => {
      if (this.wanted) this.enable();
    });
    window.addEventListener('focus', () => {
      if (!this.wanted || document.visibilityState !== 'visible') return;
      this.enable();
    });
  }

  private armWatch(): void {
    if (this.watch || typeof window === 'undefined') return;
    this.watch = window.setInterval(() => this.maintain(), 4000);
  }

  private clearWatch(): void {
    if (!this.watch || typeof window === 'undefined') return;
    window.clearInterval(this.watch);
    this.watch = 0;
  }

  private maintain(): void {
    if (!this.wanted || document.visibilityState !== 'visible') return;
    const video = this.video;
    if (this.shouldKeepVideo() && video && (video.paused || video.ended)) this.startVideo();
    if (!this.hasLock()) this.requestLock();
  }

  private hasLock(): boolean {
    return this.sentinel != null && !this.sentinel.released;
  }

  private shouldKeepVideo(): boolean {
    if (!this.hasLock()) return true;
    return isPhone();
  }

  private requestLock(): void {
    if (!this.wanted || this.hasLock() || this.requesting || this.blocked) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    const generation = this.generation;
    let pending: Promise<WakeLockSentinel>;
    try {
      pending = navigator.wakeLock.request('screen');
    } catch {
      return;
    }
    this.requesting = true;
    void pending
      .then((sentinel) => {
        if (!this.wanted || generation !== this.generation) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        this.sentinel = sentinel;
        if (!this.shouldKeepVideo()) this.stopVideo();
        sentinel.addEventListener('release', () => {
          if (this.sentinel === sentinel) this.sentinel = null;
          if (!this.wanted || document.visibilityState !== 'visible') return;
          this.startVideo();
          this.requestLock();
        });
      })
      .catch((error: unknown) => {
        if (!this.wanted || generation !== this.generation) return;
        const name =
          typeof error === 'object' && error && 'name' in error
            ? String((error as { name: unknown }).name)
            : '';
        if (name === 'NotAllowedError') this.blocked = true;
        this.startVideo();
      })
      .finally(() => {
        if (generation === this.generation) this.requesting = false;
      });
  }

  private ensureVideo(): HTMLVideoElement | null {
    if (this.video) return this.video;
    if (typeof document === 'undefined') return null;
    const video = document.createElement('video');
    video.src = wakeVideoUrl;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.preload = 'auto';
    video.controls = false;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('muted', '');
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    try {
      video.disableRemotePlayback = true;
      video.disablePictureInPicture = true;
    } catch {
      // Older browsers omit picture-in-picture.
    }
    video.addEventListener('ended', () => {
      if (!this.wanted || !this.shouldKeepVideo()) return;
      void video.play().catch(() => undefined);
    });
    video.style.cssText =
      'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.02;pointer-events:none;z-index:-1;';
    document.body.append(video);
    video.load();
    this.video = video;
    return video;
  }

  private startVideo(): void {
    if (!this.wanted) return;
    const video = this.ensureVideo();
    if (!video) return;
    if (!video.getAttribute('src')) {
      video.src = wakeVideoUrl;
      video.load();
    }
    video.muted = true;
    video.volume = 0;
    const playing = video.play();
    if (playing) {
      void playing
        .then(() => this.quietMediaSession())
        .catch(() => undefined);
    }
  }

  private stopVideo(): void {
    const video = this.video;
    if (!video) return;
    video.pause();
    this.quietMediaSession();
  }

  private quietMediaSession(): void {
    try {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch {
      // Some browsers reject media-session writes without a real session.
    }
  }
}

function isPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod|Android/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

export const screenAwake = new ScreenAwake();
