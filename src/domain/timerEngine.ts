import type { Phase, PhaseKind } from './types';

export type TimerStatus = 'ready' | 'running' | 'paused' | 'completed';

export interface TimerSnapshot {
  status: TimerStatus;
  phases: Phase[];
  phaseIndex: number;
  /** Monotonic deadline (`performance.now`) for the current phase. */
  phaseEndsAt: number | null;
  remainingMs: number;
  announcedSeconds: number[];
  generation: number;
}

export type TimerEvent =
  | { type: 'countdown'; second: number; phaseIndex: number; generation: number }
  | {
      type: 'enter-phase';
      kind: PhaseKind;
      roundIndex: number;
      phaseIndex: number;
      generation: number;
    }
  | { type: 'complete'; generation: number };

export type TimerAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'next'; now: number }
  | { type: 'previous'; now: number };

export interface ReduceResult {
  state: TimerSnapshot;
  events: TimerEvent[];
}

const COUNTDOWN_THRESHOLDS_MS = [5000, 4000, 3000, 2000, 1000, 0];

export function createTimer(phases: Phase[]): TimerSnapshot {
  const first = phases[0];
  return {
    status: 'ready',
    phases,
    phaseIndex: 0,
    phaseEndsAt: null,
    remainingMs: first?.durationMs ?? 0,
    announcedSeconds: [],
    generation: 0,
  };
}

export function idleTimer(): TimerSnapshot {
  return createTimer([]);
}

/**
 * Second that should beep, or null.
 * Only 5..1, and only when that second exists inside the phase.
 */
export function countdownSecond(remainingMs: number, durationMs: number): number | null {
  if (remainingMs <= 0 || durationMs <= 0) return null;
  const second = Math.ceil(remainingMs / 1000);
  const phaseSeconds = Math.ceil(durationMs / 1000);
  if (second < 1 || second > 5 || second > phaseSeconds) return null;
  return second;
}

/** Delay until the next countdown boundary or the phase end. */
export function nextTimerDelay(remainingMs: number): number {
  if (remainingMs <= 0) return 0;
  for (const threshold of COUNTDOWN_THRESHOLDS_MS) {
    if (remainingMs > threshold) return remainingMs - threshold;
  }
  return 0;
}

function unchanged(state: TimerSnapshot): ReduceResult {
  return { state, events: [] };
}

function withCountdown(state: TimerSnapshot, now: number): ReduceResult {
  if (state.status !== 'running' || state.phaseEndsAt == null) return unchanged(state);
  const phase = state.phases[state.phaseIndex];
  if (!phase) return unchanged(state);

  const remainingMs = Math.max(0, state.phaseEndsAt - now);
  const second = countdownSecond(remainingMs, phase.durationMs);
  if (second == null || state.announcedSeconds.includes(second)) {
    if (remainingMs === state.remainingMs) return unchanged(state);
    return { state: { ...state, remainingMs }, events: [] };
  }

  return {
    state: {
      ...state,
      remainingMs,
      announcedSeconds: [...state.announcedSeconds, second],
    },
    events: [
      {
        type: 'countdown',
        second,
        phaseIndex: state.phaseIndex,
        generation: state.generation,
      },
    ],
  };
}

/**
 * Advance every phase whose deadline has passed.
 * Deadlines are chained from the original end timestamp, so late ticks do not drift.
 * Sounds are emitted only for the phase we land on.
 */
function settle(state: TimerSnapshot, now: number): ReduceResult {
  if (state.status !== 'running' || state.phaseEndsAt == null) return unchanged(state);

  let current = state;
  const events: TimerEvent[] = [];
  let guard = 0;

  while (
    current.status === 'running' &&
    current.phaseEndsAt != null &&
    now >= current.phaseEndsAt &&
    guard < 10000
  ) {
    guard += 1;
    const nextIndex = current.phaseIndex + 1;
    if (nextIndex >= current.phases.length) {
      const generation = current.generation + 1;
      return {
        state: {
          ...current,
          status: 'completed',
          phaseEndsAt: null,
          remainingMs: 0,
          announcedSeconds: [],
          generation,
        },
        events: [...events, { type: 'complete', generation }],
      };
    }

    const nextPhase = current.phases[nextIndex];
    if (!nextPhase || current.phaseEndsAt == null) break;
    const nextEndsAt = current.phaseEndsAt + nextPhase.durationMs;
    const landed = now < nextEndsAt;
    const generation = current.generation + 1;
    current = {
      ...current,
      phaseIndex: nextIndex,
      phaseEndsAt: nextEndsAt,
      remainingMs: Math.max(0, nextEndsAt - now),
      announcedSeconds: [],
      generation,
    };
    if (landed) {
      events.push({
        type: 'enter-phase',
        kind: nextPhase.kind,
        roundIndex: nextPhase.roundIndex,
        phaseIndex: nextIndex,
        generation,
      });
    }
  }

  const countdown = withCountdown(current, now);
  return { state: countdown.state, events: [...events, ...countdown.events] };
}

function beginRunning(state: TimerSnapshot, now: number, fromReady: boolean): ReduceResult {
  const phase = state.phases[state.phaseIndex];
  if (!phase || state.remainingMs <= 0) return unchanged(state);

  const generation = state.generation + 1;
  const running: TimerSnapshot = {
    ...state,
    status: 'running',
    phaseEndsAt: now + state.remainingMs,
    generation,
  };
  const events: TimerEvent[] = [];
  if (fromReady && phase.kind !== 'prepare') {
    events.push({
      type: 'enter-phase',
      kind: phase.kind,
      roundIndex: phase.roundIndex,
      phaseIndex: state.phaseIndex,
      generation,
    });
  }
  const settled = settle(running, now);
  return { state: settled.state, events: [...events, ...settled.events] };
}

function jumpTo(state: TimerSnapshot, index: number, now: number): ReduceResult {
  const phase = state.phases[index];
  if (!phase) return unchanged(state);
  const status: TimerStatus = state.status === 'paused' ? 'paused' : 'running';
  const generation = state.generation + 1;
  const next: TimerSnapshot = {
    ...state,
    status,
    phaseIndex: index,
    remainingMs: phase.durationMs,
    phaseEndsAt: status === 'running' ? now + phase.durationMs : null,
    announcedSeconds: [],
    generation,
  };
  const events: TimerEvent[] = [
    {
      type: 'enter-phase',
      kind: phase.kind,
      roundIndex: phase.roundIndex,
      phaseIndex: index,
      generation,
    },
  ];
  if (status !== 'running') return { state: next, events };
  const settled = withCountdown(next, now);
  return { state: settled.state, events: [...events, ...settled.events] };
}

export function reduceTimer(state: TimerSnapshot, action: TimerAction): ReduceResult {
  switch (action.type) {
    case 'start': {
      if (state.status !== 'ready') return unchanged(state);
      return beginRunning(state, action.now, true);
    }
    case 'resume': {
      if (state.status !== 'paused') return unchanged(state);
      return beginRunning(state, action.now, false);
    }
    case 'pause': {
      if (state.status !== 'running') return unchanged(state);
      const settled = settle(state, action.now);
      if (settled.state.status !== 'running' || settled.state.phaseEndsAt == null) return settled;
      const remainingMs = Math.max(0, settled.state.phaseEndsAt - action.now);
      return {
        state: {
          ...settled.state,
          status: 'paused',
          phaseEndsAt: null,
          remainingMs,
        },
        events: settled.events,
      };
    }
    case 'tick':
      return settle(state, action.now);
    case 'next': {
      if (state.status !== 'running' && state.status !== 'paused') return unchanged(state);
      const nextIndex = state.phaseIndex + 1;
      if (nextIndex >= state.phases.length) {
        const generation = state.generation + 1;
        return {
          state: {
            ...state,
            status: 'completed',
            phaseEndsAt: null,
            remainingMs: 0,
            announcedSeconds: [],
            generation,
          },
          events: [{ type: 'complete', generation }],
        };
      }
      return jumpTo(state, nextIndex, action.now);
    }
    case 'previous': {
      if (state.status !== 'running' && state.status !== 'paused') return unchanged(state);
      const index = state.phaseIndex > 0 ? state.phaseIndex - 1 : 0;
      return jumpTo(state, index, action.now);
    }
    default: {
      const neverAction: never = action;
      return neverAction;
    }
  }
}
