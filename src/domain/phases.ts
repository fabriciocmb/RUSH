import type { Phase, Workout, WorkoutSummary } from './types';
import { clampPhaseSeconds } from './time';

export interface PhaseSource {
  prepareSeconds: number;
  rounds: Array<Pick<Workout['rounds'][number], 'id' | 'rushSeconds' | 'breakSeconds'>>;
}

/**
 * Build the executable sequence.
 * Break of 0 is skipped. The last round never runs its break.
 */
export function buildPhases(workout: PhaseSource): Phase[] {
  const phases: Phase[] = [];
  const prepare = clampPhaseSeconds(workout.prepareSeconds, 0);
  if (prepare > 0) {
    phases.push({
      key: 'prepare',
      kind: 'prepare',
      roundIndex: -1,
      durationMs: prepare * 1000,
    });
  }

  const lastIndex = workout.rounds.length - 1;
  workout.rounds.forEach((round, index) => {
    if (round.rushSeconds <= 0) return;
    const rush = clampPhaseSeconds(round.rushSeconds, 1);
    phases.push({
      key: `rush-${index}-${round.id}`,
      kind: 'rush',
      roundIndex: index,
      durationMs: rush * 1000,
    });
    const rest = clampPhaseSeconds(round.breakSeconds, 0);
    if (index !== lastIndex && rest > 0) {
      phases.push({
        key: `break-${index}-${round.id}`,
        kind: 'break',
        roundIndex: index,
        durationMs: rest * 1000,
      });
    }
  });

  return phases;
}

export function summarize(workout: PhaseSource): WorkoutSummary {
  const phases = buildPhases(workout);
  let prepareSeconds = 0;
  let rushSeconds = 0;
  let breakSeconds = 0;
  let rounds = 0;

  for (const phase of phases) {
    const seconds = phase.durationMs / 1000;
    if (phase.kind === 'prepare') prepareSeconds += seconds;
    if (phase.kind === 'rush') {
      rushSeconds += seconds;
      rounds += 1;
    }
    if (phase.kind === 'break') breakSeconds += seconds;
  }

  return {
    rounds,
    prepareSeconds,
    rushSeconds,
    breakSeconds,
    totalSeconds: prepareSeconds + rushSeconds + breakSeconds,
  };
}
