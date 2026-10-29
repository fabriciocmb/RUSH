import { useCallback, useEffect, useRef } from 'react';
import { screenAwake } from '../services/screenAwake';

/**
 * Holds the screen awake while `active` is true.
 * `enable()` must run inside the start tap, before any await.
 * Release is deferred by a macrotask so a StrictMode remount cannot
 * drop the lock that the tap just acquired.
 */
export function useWakeLock(active: boolean) {
  const releaseTimer = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const cancelRelease = () => {
    if (releaseTimer.current == null || typeof window === 'undefined') return;
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
  };

  const enable = useCallback(() => {
    cancelRelease();
    screenAwake.enable();
  }, []);

  const releaseIfIdle = useCallback(() => {
    if (!activeRef.current) screenAwake.disable();
  }, []);

  useEffect(() => {
    screenAwake.warm();
    cancelRelease();
    if (!active) {
      screenAwake.disable();
      return;
    }
    screenAwake.enable();
    return () => {
      releaseTimer.current = window.setTimeout(() => {
        releaseTimer.current = null;
        screenAwake.disable();
      }, 0);
    };
  }, [active]);

  return { enable, releaseIfIdle };
}
