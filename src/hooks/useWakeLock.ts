import { useCallback, useEffect, useRef } from 'react';
import { acquireWakeLock, releaseWakeLock } from '../services/wakeLock';

/**
 * Requests a screen wake lock while a workout is on screen.
 * `gain(true)` can be called inside the start click so the browser
 * still treats it as a user gesture. In-flight requests are dropped
 * if the workout ends before they resolve.
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const activeRef = useRef(active);
  const generationRef = useRef(0);
  activeRef.current = active;

  const release = useCallback(() => {
    generationRef.current += 1;
    const current = sentinelRef.current;
    sentinelRef.current = null;
    void releaseWakeLock(current);
  }, []);

  const gain = useCallback((force = false) => {
    const token = generationRef.current;
    void acquireWakeLock().then(async (next) => {
      if (token !== generationRef.current || (!force && !activeRef.current) || !next) {
        await releaseWakeLock(next);
        return;
      }
      const previous = sentinelRef.current;
      sentinelRef.current = next;
      if (previous && previous !== next) await releaseWakeLock(previous);
    });
  }, []);

  useEffect(() => {
    if (!active) {
      release();
      return;
    }

    gain();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!sentinelRef.current || sentinelRef.current.released) gain();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      release();
    };
  }, [active, gain, release]);

  return gain;
}
