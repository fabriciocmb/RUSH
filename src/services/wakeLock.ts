export async function acquireWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null;
    return await navigator.wakeLock.request('screen');
  } catch {
    return null;
  }
}

export async function releaseWakeLock(sentinel: WakeLockSentinel | null): Promise<void> {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    // Already released by the browser.
  }
}
