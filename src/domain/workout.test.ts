import { describe, expect, it } from 'vitest';
import {
  createPreset,
  duplicateRound,
  moveRound,
  normalizeWorkout,
  removeRound,
  workoutSignature,
} from './workout';
import { summarize } from './phases';

describe('workout editing', () => {
  it('builds the quick presets and lets every round stay editable', () => {
    const tabata = createPreset('tabata', 10, 1);
    expect(tabata.rounds).toHaveLength(8);
    expect(tabata.rounds[0]).toMatchObject({ rushSeconds: 20, breakSeconds: 10 });
    expect(summarize(tabata).breakSeconds).toBe(70);

    const hiit = createPreset('hiit', 5, 1);
    expect(hiit.rounds).toHaveLength(10);
    expect(hiit.prepareSeconds).toBe(5);

    const boxing = createPreset('boxing', 10, 1);
    expect(boxing.rounds).toHaveLength(5);
    expect(boxing.rounds[0]).toMatchObject({ rushSeconds: 180, breakSeconds: 60 });
    expect(summarize(boxing).totalSeconds).toBe(10 + 5 * 180 + 4 * 60);
  });

  it('reorders, duplicates and refuses to delete the final round', () => {
    const workout = createPreset('custom', 10, 1);
    const second = { ...workout.rounds[0]!, id: 'b', rushSeconds: 45, breakSeconds: 5 };
    const rounds = [...workout.rounds, second];
    const moved = moveRound(rounds, 1, -1);
    expect(moved[0]?.id).toBe('b');
    expect(moveRound(moved, 0, -1)).toBe(moved);

    const duplicated = duplicateRound(moved, 0);
    expect(duplicated).toHaveLength(3);
    expect(duplicated[1]?.rushSeconds).toBe(45);
    expect(duplicated[1]?.id).not.toBe(duplicated[0]?.id);

    expect(removeRound(duplicated, 1)).toHaveLength(2);
    const only = removeRound([duplicated[0]!], 0);
    expect(only).toHaveLength(1);
  });

  it('normalizes names and rejects empty rush values', () => {
    const workout = createPreset('custom', 10, 5);
    const normalized = normalizeWorkout(
      {
        ...workout,
        name: '  funcional intenso  ',
        prepareSeconds: -4,
        rounds: [{ id: 'a', rushSeconds: 0, breakSeconds: -8 }],
      },
      9,
    );
    expect(normalized.name).toBe('FUNCIONAL INTENSO');
    expect(normalized.prepareSeconds).toBe(0);
    expect(normalized.rounds[0]).toMatchObject({ rushSeconds: 1, breakSeconds: 0 });
    expect(normalized.updatedAt).toBe(9);
    expect(workoutSignature(normalized)).toContain('FUNCIONAL INTENSO');
  });
});
