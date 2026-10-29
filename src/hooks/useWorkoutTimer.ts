import { useCallback, useEffect, useRef, useState } from 'react';
import { buildPhases } from '../domain/phases';
import {
  createTimer,
  idleTimer,
  nextTimerDelay,
  reduceTimer,
  type ReduceResult,
  type TimerEvent,
  type TimerSnapshot,
} from '../domain/timerEngine';
import type { Workout } from '../domain/types';

export function useWorkoutTimer(onEvents: (events: TimerEvent[]) => void) {
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  const sessionRef = useRef(0);
  const snapshotRef = useRef<TimerSnapshot>(idleTimer());
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(snapshotRef.current);
  const [workout, setWorkout] = useState<Workout | null>(null);

  const commit = useCallback((result: ReduceResult, session: number, paint: boolean) => {
    if (session !== sessionRef.current) return;
    snapshotRef.current = result.state;
    if (paint) setSnapshot(result.state);
    if (result.events.length > 0) onEventsRef.current(result.events);
  }, []);

  const start = useCallback(
    (nextWorkout: Workout): boolean => {
      if (snapshotRef.current.status === 'running' || snapshotRef.current.status === 'paused') return false;
      sessionRef.current += 1;
      const session = sessionRef.current;
      const phases = buildPhases(nextWorkout);
      if (phases.length === 0) {
        commit({ state: idleTimer(), events: [] }, session, true);
        return false;
      }
      setWorkout(nextWorkout);
      const result = reduceTimer(createTimer(phases), { type: 'start', now: performance.now() });
      commit(result, session, true);
      return true;
    },
    [commit],
  );

  const pause = useCallback(() => {
    const session = sessionRef.current;
    commit(reduceTimer(snapshotRef.current, { type: 'pause', now: performance.now() }), session, true);
  }, [commit]);

  const resume = useCallback(() => {
    const session = sessionRef.current;
    commit(reduceTimer(snapshotRef.current, { type: 'resume', now: performance.now() }), session, true);
  }, [commit]);

  const next = useCallback(() => {
    const session = sessionRef.current;
    commit(reduceTimer(snapshotRef.current, { type: 'next', now: performance.now() }), session, true);
  }, [commit]);

  const previous = useCallback(() => {
    const session = sessionRef.current;
    commit(reduceTimer(snapshotRef.current, { type: 'previous', now: performance.now() }), session, true);
  }, [commit]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    const idle = idleTimer();
    snapshotRef.current = idle;
    setSnapshot(idle);
  }, []);

  useEffect(() => {
    if (snapshot.status !== 'running') return;
    let frame = 0;
    let lastPaint = 0;

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const session = sessionRef.current;
      const current = snapshotRef.current;
      if (current.status !== 'running') return;
      const now = performance.now();
      const result = reduceTimer(current, { type: 'tick', now });
      const secondChanged =
        Math.ceil(current.remainingMs / 1000) !== Math.ceil(result.state.remainingMs / 1000);
      const structural =
        result.events.length > 0 ||
        result.state.phaseIndex !== current.phaseIndex ||
        result.state.status !== current.status;
      const paint = structural || secondChanged || time - lastPaint >= 100;
      if (paint) lastPaint = time;
      commit(result, session, paint);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [snapshot.status, commit]);

  useEffect(() => {
    if (snapshot.status !== 'running' || snapshot.phaseEndsAt == null) return;
    let timeoutId = 0;
    let cancelled = false;

    const arm = () => {
      if (cancelled) return;
      const session = sessionRef.current;
      const current = snapshotRef.current;
      if (current.status !== 'running' || current.phaseEndsAt == null) return;
      const result = reduceTimer(current, { type: 'tick', now: performance.now() });
      const structural =
        result.events.length > 0 ||
        result.state.status !== current.status ||
        result.state.phaseIndex !== current.phaseIndex;
      commit(result, session, structural);
      if (cancelled || session !== sessionRef.current) return;
      const nextState = snapshotRef.current;
      if (nextState.status !== 'running' || nextState.phaseEndsAt == null) return;
      const remaining = nextState.phaseEndsAt - performance.now();
      timeoutId = window.setTimeout(arm, Math.max(0, nextTimerDelay(remaining)));
    };

    const remaining = snapshot.phaseEndsAt - performance.now();
    timeoutId = window.setTimeout(arm, Math.max(0, nextTimerDelay(remaining)));

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [snapshot.status, snapshot.phaseEndsAt, snapshot.generation, commit]);

  useEffect(() => {
    const catchUp = () => {
      if (document.visibilityState === 'hidden') return;
      const session = sessionRef.current;
      const current = snapshotRef.current;
      if (current.status !== 'running') return;
      commit(reduceTimer(current, { type: 'tick', now: performance.now() }), session, true);
    };

    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('pageshow', catchUp);
    window.addEventListener('focus', catchUp);
    return () => {
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('pageshow', catchUp);
      window.removeEventListener('focus', catchUp);
    };
  }, [commit]);

  return { snapshot, workout, start, pause, resume, next, previous, stop };
}
