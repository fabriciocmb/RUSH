import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, STORAGE_VERSION } from '../domain/types';
import { createPreset } from '../domain/workout';
import { loadAppData, saveAppData, type StorageLike } from './storage';

function memory(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe('local storage', () => {
  it('round-trips workouts and preferences', () => {
    const store = memory();
    const workout = createPreset('hiit', 12, 20);
    saveAppData(
      {
        version: STORAGE_VERSION,
        workouts: [workout],
        preferences: { volume: 0.4, muted: true, vibration: true, defaultPrepareSeconds: 12 },
      },
      store,
    );

    const loaded = loadAppData(store);
    expect(loaded.version).toBe(1);
    expect(loaded.workouts).toHaveLength(1);
    expect(loaded.workouts[0]?.name).toBe('HIIT');
    expect(loaded.workouts[0]?.rounds).toHaveLength(10);
    expect(loaded.preferences).toEqual({
      volume: 0.4,
      muted: true,
      vibration: true,
      defaultPrepareSeconds: 12,
    });
  });

  it('keeps a prepare time of zero and a break of zero', () => {
    const store = memory();
    const workout = createPreset('custom', 0, 1);
    workout.rounds[0] = { id: 'round-1', rushSeconds: 15, breakSeconds: 0 };
    saveAppData(
      {
        version: 1,
        workouts: [workout],
        preferences: { volume: 1, muted: false, vibration: false, defaultPrepareSeconds: 0 },
      },
      store,
    );
    const loaded = loadAppData(store);
    expect(loaded.preferences.defaultPrepareSeconds).toBe(0);
    expect(loaded.workouts[0]?.prepareSeconds).toBe(0);
    expect(loaded.workouts[0]?.rounds[0]?.breakSeconds).toBe(0);
  });

  it('drops invalid rounds and survives corrupt or unversioned payloads', () => {
    const store = memory();
    store.setItem(STORAGE_KEY, '{');
    expect(loadAppData(store).workouts).toEqual([]);

    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workouts: [{ id: 'x', name: 'SEM VERSAO', rounds: [{ id: 'a', rushSeconds: 10, breakSeconds: 5 }] }],
      }),
    );
    expect(loadAppData(store).workouts).toEqual([]);

    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        workouts: [
          {
            id: 'workout-1',
            name: 'misto',
            prepareSeconds: 8,
            createdAt: 1,
            updatedAt: 2,
            rounds: [
              { id: 'ok', rushSeconds: 12, breakSeconds: 0 },
              { id: 'bad', rushSeconds: 0, breakSeconds: 10 },
              { id: 'neg', rushSeconds: -5, breakSeconds: 4 },
              { id: 'ok', rushSeconds: 20, breakSeconds: 5 },
            ],
          },
        ],
        preferences: { volume: 4, muted: 'yes', vibration: 1, defaultPrepareSeconds: -3 },
      }),
    );

    const loaded = loadAppData(store);
    expect(loaded.workouts[0]?.name).toBe('MISTO');
    expect(loaded.workouts[0]?.rounds.map((round) => round.rushSeconds)).toEqual([12, 20]);
    expect(new Set(loaded.workouts[0]?.rounds.map((round) => round.id)).size).toBe(2);
    expect(loaded.preferences.volume).toBe(1);
    expect(loaded.preferences.muted).toBe(false);
    expect(loaded.preferences.vibration).toBe(false);
    expect(loaded.preferences.defaultPrepareSeconds).toBe(0);
  });

  it('still reads a future version when the shape is compatible', () => {
    const store = memory();
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        workouts: [
          {
            id: 'future',
            name: 'FUTURO',
            prepareSeconds: 3,
            rounds: [{ id: 'a', rushSeconds: 5, breakSeconds: 1 }],
            createdAt: 1,
            updatedAt: 4,
          },
        ],
        preferences: { volume: 0.2, muted: false, vibration: true, defaultPrepareSeconds: 3 },
      }),
    );
    const loaded = loadAppData(store);
    expect(loaded.version).toBe(1);
    expect(loaded.workouts[0]?.name).toBe('FUTURO');
    expect(loaded.preferences.vibration).toBe(true);
  });
});
