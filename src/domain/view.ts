import type { PhaseKind } from './types';
import type { TimerSnapshot } from './timerEngine';
import { formatClock } from './time';

export interface PhaseTheme {
  label: string;
  accent: string;
  glow: string;
}

export const PHASE_THEME: Record<PhaseKind, PhaseTheme> = {
  prepare: { label: 'PREPARE', accent: '#38BDF8', glow: 'rgba(56, 189, 248, 0.18)' },
  rush: { label: 'RUSH', accent: '#84FF4A', glow: 'rgba(132, 255, 74, 0.16)' },
  break: { label: 'BREAK', accent: '#FFB347', glow: 'rgba(255, 179, 71, 0.18)' },
};

export interface PhaseView {
  roundNumber: number;
  roundCount: number;
  kind: PhaseKind;
  label: string;
  accent: string;
  glow: string;
  remainingMs: number;
  durationMs: number;
  progress: number;
  countdown: boolean;
  nextLabel: string;
  status: TimerSnapshot['status'];
}

export function getPhaseView(snapshot: TimerSnapshot): PhaseView | null {
  if (snapshot.phases.length === 0 || snapshot.status === 'completed') return null;
  const phase = snapshot.phases[snapshot.phaseIndex];
  if (!phase) return null;

  const roundCount = snapshot.phases.filter((item) => item.kind === 'rush').length;
  const roundNumber = phase.kind === 'prepare' ? 1 : phase.roundIndex + 1;
  const next = snapshot.phases[snapshot.phaseIndex + 1];
  const nextLabel = next
    ? `${PHASE_THEME[next.kind].label} ${formatClock(next.durationMs / 1000)}`
    : 'FIM DO TREINO';
  const theme = PHASE_THEME[phase.kind];
  const progress =
    phase.durationMs <= 0
      ? 1
      : Math.min(1, Math.max(0, 1 - snapshot.remainingMs / phase.durationMs));

  return {
    roundNumber,
    roundCount,
    kind: phase.kind,
    label: theme.label,
    accent: theme.accent,
    glow: theme.glow,
    remainingMs: snapshot.remainingMs,
    durationMs: phase.durationMs,
    progress,
    countdown: snapshot.status === 'running' && snapshot.remainingMs > 0 && snapshot.remainingMs <= 5000,
    nextLabel,
    status: snapshot.status,
  };
}
