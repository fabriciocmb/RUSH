import type { PhaseKind } from '../domain/types';

function pulse(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Devices without vibration support must not break the workout.
  }
}

export function vibratePhase(kind: PhaseKind): void {
  if (kind === 'rush') pulse([35, 50, 35]);
  if (kind === 'break') pulse([60]);
  if (kind === 'prepare') pulse([20]);
}

export function vibrateComplete(): void {
  pulse([40, 35, 40, 35, 90]);
}
