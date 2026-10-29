import type { PresetKind, Round, Workout } from './types';
import { MAX_NAME_LENGTH, MAX_ROUNDS } from './types';
import { clampPhaseSeconds, createId } from './time';

export function workoutSignature(workout: Pick<Workout, 'name' | 'prepareSeconds' | 'rounds'>): string {
  return JSON.stringify({
    name: workout.name,
    prepareSeconds: workout.prepareSeconds,
    rounds: workout.rounds.map((round) => ({
      rush: round.rushSeconds,
      break: round.breakSeconds,
    })),
  });
}

export function cloneWorkout(workout: Workout): Workout {
  return {
    ...workout,
    rounds: workout.rounds.map((round) => ({ ...round })),
  };
}

export function normalizeWorkout(workout: Workout, now = Date.now()): Workout {
  const name = workout.name.trim().toLocaleUpperCase('pt-BR').slice(0, MAX_NAME_LENGTH) || 'TREINO';
  return {
    ...workout,
    name,
    prepareSeconds: clampPhaseSeconds(workout.prepareSeconds, 0),
    rounds: workout.rounds.slice(0, MAX_ROUNDS).map((round) => ({
      id: round.id || createId(),
      rushSeconds: clampPhaseSeconds(round.rushSeconds, 1),
      breakSeconds: clampPhaseSeconds(round.breakSeconds, 0),
    })),
    updatedAt: now,
  };
}

export function createCustomWorkout(prepareSeconds: number, now = Date.now()): Workout {
  return {
    id: createId(),
    name: 'TREINO',
    prepareSeconds: clampPhaseSeconds(prepareSeconds, 0),
    rounds: [{ id: createId(), rushSeconds: 30, breakSeconds: 15 }],
    createdAt: now,
    updatedAt: now,
  };
}

function repeatRound(rushSeconds: number, breakSeconds: number, count: number): Round[] {
  return Array.from({ length: count }, () => ({
    id: createId(),
    rushSeconds,
    breakSeconds,
  }));
}

export function createPreset(kind: PresetKind, prepareSeconds: number, now = Date.now()): Workout {
  const prepare = clampPhaseSeconds(prepareSeconds, 0);
  if (kind === 'tabata') {
    return {
      id: createId(),
      name: 'TABATA',
      prepareSeconds: prepare,
      rounds: repeatRound(20, 10, 8),
      createdAt: now,
      updatedAt: now,
    };
  }
  if (kind === 'hiit') {
    return {
      id: createId(),
      name: 'HIIT',
      prepareSeconds: prepare,
      rounds: repeatRound(40, 20, 10),
      createdAt: now,
      updatedAt: now,
    };
  }
  if (kind === 'boxing') {
    return {
      id: createId(),
      name: 'BOXE',
      prepareSeconds: prepare,
      rounds: repeatRound(180, 60, 5),
      createdAt: now,
      updatedAt: now,
    };
  }
  return createCustomWorkout(prepare, now);
}

export function duplicateWorkout(workout: Workout, now = Date.now()): Workout {
  const name = `${workout.name} CÓPIA`.slice(0, MAX_NAME_LENGTH);
  return {
    ...cloneWorkout(workout),
    id: createId(),
    name,
    rounds: workout.rounds.map((round) => ({ ...round, id: createId() })),
    createdAt: now,
    updatedAt: now,
  };
}

export function moveRound(rounds: Round[], index: number, direction: -1 | 1): Round[] {
  const target = index + direction;
  if (target < 0 || target >= rounds.length) return rounds;
  const current = rounds[index];
  const swap = rounds[target];
  if (!current || !swap) return rounds;
  const next = rounds.slice();
  next[index] = swap;
  next[target] = current;
  return next;
}

export function duplicateRound(rounds: Round[], index: number): Round[] {
  if (rounds.length >= MAX_ROUNDS) return rounds;
  const source = rounds[index];
  if (!source) return rounds;
  const next = rounds.slice();
  next.splice(index + 1, 0, { ...source, id: createId() });
  return next;
}

export function removeRound(rounds: Round[], index: number): Round[] {
  if (rounds.length <= 1) return rounds;
  return rounds.filter((_, roundIndex) => roundIndex !== index);
}

export function updateRound(
  rounds: Round[],
  index: number,
  patch: Partial<Pick<Round, 'rushSeconds' | 'breakSeconds'>>,
): Round[] {
  return rounds.map((round, roundIndex) => {
    if (roundIndex !== index) return round;
    return {
      ...round,
      rushSeconds:
        patch.rushSeconds == null ? round.rushSeconds : clampPhaseSeconds(patch.rushSeconds, 1),
      breakSeconds:
        patch.breakSeconds == null ? round.breakSeconds : clampPhaseSeconds(patch.breakSeconds, 0),
    };
  });
}
