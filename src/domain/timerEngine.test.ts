import { describe, expect, it } from 'vitest';
import { buildPhases, summarize } from './phases';
import {
  countdownSecond,
  createTimer,
  nextTimerDelay,
  reduceTimer,
  type TimerSnapshot,
} from './timerEngine';
import { formatClock, formatClockFromMs, formatDuration } from './time';
import { getPhaseView } from './view';

function rushBreak(rounds: Array<[number, number]>, prepareSeconds = 0) {
  return buildPhases({
    prepareSeconds,
    rounds: rounds.map(([rushSeconds, breakSeconds], index) => ({
      id: `r${index}`,
      rushSeconds,
      breakSeconds,
    })),
  });
}

function start(phases: ReturnType<typeof buildPhases>, now = 0) {
  return reduceTimer(createTimer(phases), { type: 'start', now });
}

function at(state: TimerSnapshot, now: number) {
  return reduceTimer(state, { type: 'tick', now });
}

describe('buildPhases and summary', () => {
  it('keeps independent rounds and drops the last break', () => {
    const source = {
      prepareSeconds: 10,
      rounds: [
        { id: '1', rushSeconds: 90, breakSeconds: 30 },
        { id: '2', rushSeconds: 30, breakSeconds: 10 },
        { id: '3', rushSeconds: 60, breakSeconds: 20 },
        { id: '4', rushSeconds: 120, breakSeconds: 45 },
      ],
    };

    expect(buildPhases(source).map((phase) => [phase.kind, phase.durationMs])).toEqual([
      ['prepare', 10_000],
      ['rush', 90_000],
      ['break', 30_000],
      ['rush', 30_000],
      ['break', 10_000],
      ['rush', 60_000],
      ['break', 20_000],
      ['rush', 120_000],
    ]);

    expect(summarize(source)).toEqual({
      rounds: 4,
      prepareSeconds: 10,
      rushSeconds: 300,
      breakSeconds: 60,
      totalSeconds: 370,
    });
  });

  it('skips a break of zero and a prepare of zero', () => {
    const phases = rushBreak([
      [20, 0],
      [15, 5],
      [10, 0],
    ]);
    expect(phases.map((phase) => phase.kind)).toEqual(['rush', 'rush', 'break', 'rush']);
  });

  it('does not run a break after the only round', () => {
    const phases = rushBreak([[30, 99]]);
    expect(phases).toHaveLength(1);
    expect(phases[0]?.kind).toBe('rush');
    expect(summarize({ prepareSeconds: 0, rounds: [{ id: 'a', rushSeconds: 30, breakSeconds: 99 }] }).totalSeconds).toBe(30);
  });
});

describe('timer engine', () => {
  it('chains phase deadlines without drift', () => {
    const phases = rushBreak([
      [10, 5],
      [8, 4],
    ]);
    let result = start(phases, 1_000);
    expect(result.state.phaseEndsAt).toBe(11_000);

    for (let now = 1_100; now < 11_000; now += 100) {
      result = at(result.state, now);
      expect(result.state.phaseIndex).toBe(0);
      expect(result.state.phaseEndsAt).toBe(11_000);
      expect(result.state.remainingMs).toBe(11_000 - now);
    }

    result = at(result.state, 11_000);
    expect(result.state.phaseIndex).toBe(1);
    expect(result.state.phases[result.state.phaseIndex]?.kind).toBe('break');
    expect(result.state.phaseEndsAt).toBe(16_000);

    result = at(result.state, 16_000);
    expect(result.state.phaseIndex).toBe(2);
    expect(result.state.phaseEndsAt).toBe(24_000);
    expect(result.events.map((event) => event.type)).toContain('enter-phase');
  });

  it('moves rush to break to rush and finishes the last rush', () => {
    const phases = rushBreak([
      [2, 1],
      [2, 9],
    ]);
    let result = start(phases, 0);
    expect(result.events.some((event) => event.type === 'enter-phase' && event.kind === 'rush')).toBe(true);

    result = at(result.state, 2_000);
    expect(result.state.phases[result.state.phaseIndex]?.kind).toBe('break');
    expect(result.events).toEqual([
      expect.objectContaining({ type: 'enter-phase', kind: 'break' }),
      expect.objectContaining({ type: 'countdown', second: 1 }),
    ]);

    result = at(result.state, 3_000);
    expect(result.state.phases[result.state.phaseIndex]?.kind).toBe('rush');
    expect(result.events.some((event) => event.type === 'enter-phase' && event.kind === 'break')).toBe(false);

    result = at(result.state, 5_000);
    expect(result.state.status).toBe('completed');
    expect(result.events.map((event) => event.type)).toEqual(['complete']);
  });

  it('beeps each of the last five seconds once', () => {
    const phases = rushBreak([[10, 0]]);
    let result = start(phases, 0);
    const seconds: number[] = [];
    for (let now = 0; now < 10_000; now += 100) {
      result = at(result.state, now);
      for (const event of result.events) {
        if (event.type === 'countdown') seconds.push(event.second);
      }
    }
    expect(seconds).toEqual([5, 4, 3, 2, 1]);
  });

  it('does not beep seconds outside a short phase', () => {
    const phases = rushBreak([[3, 0]]);
    let result = start(phases, 0);
    const seconds = result.events.flatMap((event) => (event.type === 'countdown' ? [event.second] : []));
    result = at(result.state, 1_000);
    seconds.push(...result.events.flatMap((event) => (event.type === 'countdown' ? [event.second] : [])));
    result = at(result.state, 2_000);
    seconds.push(...result.events.flatMap((event) => (event.type === 'countdown' ? [event.second] : [])));
    result = at(result.state, 2_500);
    seconds.push(...result.events.flatMap((event) => (event.type === 'countdown' ? [event.second] : [])));
    expect(seconds).toEqual([3, 2, 1]);
    expect(result.state.status).toBe('running');
  });

  it('does not repeat a beep when ticked twice or resumed in the same second', () => {
    const phases = rushBreak([[10, 0]]);
    let result = start(phases, 0);
    result = at(result.state, 5_000);
    expect(result.events).toEqual([expect.objectContaining({ type: 'countdown', second: 5 })]);
    const again = at(result.state, 5_000);
    expect(again.events).toEqual([]);

    const paused = reduceTimer(result.state, { type: 'pause', now: 5_200 });
    const resumed = reduceTimer(paused.state, { type: 'resume', now: 8_000 });
    expect(resumed.state.phaseEndsAt).toBe(8_000 + 4_800);
    expect(resumed.events.filter((event) => event.type === 'countdown')).toEqual([]);
    const nextSecond = at(resumed.state, 8_800);
    expect(nextSecond.events).toEqual([expect.objectContaining({ type: 'countdown', second: 4 })]);
  });

  it('keeps the remaining time across pause and resume', () => {
    const phases = rushBreak([[10, 0]]);
    let result = start(phases, 0);
    result = at(result.state, 2_500);
    const paused = reduceTimer(result.state, { type: 'pause', now: 2_500 });
    expect(paused.state.status).toBe('paused');
    expect(paused.state.remainingMs).toBe(7_500);
    expect(paused.state.phaseEndsAt).toBeNull();
    const resumed = reduceTimer(paused.state, { type: 'resume', now: 9_000 });
    expect(resumed.state.status).toBe('running');
    expect(resumed.state.phaseEndsAt).toBe(16_500);
    expect(resumed.events.some((event) => event.type === 'enter-phase')).toBe(false);
  });

  it('catches up after the tab was suspended and skips missed cues', () => {
    const phases = rushBreak([
      [10, 5],
      [10, 0],
    ]);
    const running = start(phases, 0);
    const jumped = at(running.state, 17_000);
    expect(jumped.state.phaseIndex).toBe(2);
    expect(jumped.state.remainingMs).toBe(8_000);
    expect(jumped.state.phaseEndsAt).toBe(25_000);
    expect(jumped.events).toEqual([expect.objectContaining({ type: 'enter-phase', kind: 'rush', phaseIndex: 2 })]);

    const finished = at(running.state, 40_000);
    expect(finished.state.status).toBe('completed');
    expect(finished.events.map((event) => event.type)).toEqual(['complete']);
  });

  it('completes when pause happens after the workout already ended', () => {
    const phases = rushBreak([[5, 20]]);
    const running = start(phases, 0);
    const pausedLate = reduceTimer(running.state, { type: 'pause', now: 6_000 });
    expect(pausedLate.state.status).toBe('completed');
    expect(pausedLate.events.map((event) => event.type)).toEqual(['complete']);
  });

  it('ignores a second start', () => {
    const phases = rushBreak([[10, 0]]);
    const running = start(phases, 0);
    const again = reduceTimer(running.state, { type: 'start', now: 100 });
    expect(again.state).toBe(running.state);
    expect(again.events).toEqual([]);
  });

  it('skips forward and back without losing the phase duration', () => {
    const phases = rushBreak([
      [10, 5],
      [8, 0],
    ]);
    const running = start(phases, 0);
    const next = reduceTimer(running.state, { type: 'next', now: 1_200 });
    expect(next.state.phaseIndex).toBe(1);
    expect(next.state.remainingMs).toBe(5_000);
    expect(next.state.phaseEndsAt).toBe(6_200);
    expect(next.events[0]).toEqual(expect.objectContaining({ type: 'enter-phase', kind: 'break' }));

    const previous = reduceTimer(next.state, { type: 'previous', now: 2_000 });
    expect(previous.state.phaseIndex).toBe(0);
    expect(previous.state.remainingMs).toBe(10_000);
    expect(previous.state.phaseEndsAt).toBe(12_000);

    const restarted = reduceTimer(running.state, { type: 'previous', now: 4_000 });
    expect(restarted.state.phaseIndex).toBe(0);
    expect(restarted.state.remainingMs).toBe(10_000);

    const last = reduceTimer(next.state, { type: 'next', now: 3_000 });
    const done = reduceTimer(last.state, { type: 'next', now: 3_100 });
    expect(done.state.status).toBe('completed');
    expect(done.events.map((event) => event.type)).toEqual(['complete']);
  });

  it('keeps a manual skip paused and does not beep until resume', () => {
    const phases = rushBreak([
      [10, 4],
      [6, 0],
    ]);
    const running = start(phases, 0);
    const paused = reduceTimer(running.state, { type: 'pause', now: 1_000 });
    const next = reduceTimer(paused.state, { type: 'next', now: 5_000 });
    expect(next.state.status).toBe('paused');
    expect(next.state.phaseEndsAt).toBeNull();
    expect(next.state.remainingMs).toBe(4_000);
    expect(next.events.map((event) => event.type)).toEqual(['enter-phase']);
  });

  it('labels the upcoming phase and the end of the workout', () => {
    const phases = rushBreak([[30, 10], [20, 10]], 10);
    const running = start(phases, 0);
    const prepare = getPhaseView(running.state);
    expect(prepare?.label).toBe('PREPARE');
    expect(prepare?.roundNumber).toBe(1);
    expect(prepare?.nextLabel).toBe('RUSH 00:30');

    const rush = at(running.state, 10_000);
    const rushView = getPhaseView(rush.state);
    expect(rushView?.label).toBe('RUSH');
    expect(rushView?.nextLabel).toBe('BREAK 00:10');

    const last = reduceTimer(rush.state, { type: 'next', now: 10_000 });
    const afterBreak = reduceTimer(last.state, { type: 'next', now: 10_000 });
    expect(getPhaseView(afterBreak.state)?.nextLabel).toBe('FIM DO TREINO');
  });
});

describe('countdown schedule', () => {
  it('only returns seconds that exist inside the phase', () => {
    expect(countdownSecond(10_000, 10_000)).toBeNull();
    expect(countdownSecond(5_000, 10_000)).toBe(5);
    expect(countdownSecond(3_000, 3_000)).toBe(3);
    expect(countdownSecond(5_000, 3_000)).toBeNull();
    expect(countdownSecond(1_000, 2_000)).toBe(1);
    expect(countdownSecond(0, 3_000)).toBeNull();
  });

  it('wakes at the next cue boundary', () => {
    expect(nextTimerDelay(10_000)).toBe(5_000);
    expect(nextTimerDelay(5_000)).toBe(1_000);
    expect(nextTimerDelay(4_200)).toBe(200);
    expect(nextTimerDelay(1_000)).toBe(1_000);
    expect(nextTimerDelay(200)).toBe(200);
    expect(nextTimerDelay(0)).toBe(0);
    expect(nextTimerDelay(-5)).toBe(0);
  });

  it('formats clocks without dropping the visible second early', () => {
    expect(formatClockFromMs(90_000)).toBe('01:30');
    expect(formatClockFromMs(89_001)).toBe('01:30');
    expect(formatClockFromMs(89_000)).toBe('01:29');
    expect(formatClockFromMs(1)).toBe('00:01');
    expect(formatClockFromMs(0)).toBe('00:00');
    expect(formatClock(370)).toBe('06:10');
    expect(formatDuration(3700)).toBe('1:01:40');
  });
});
