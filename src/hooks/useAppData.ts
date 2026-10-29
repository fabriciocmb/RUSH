import { useCallback, useRef, useState } from 'react';
import type { AppData, Preferences, Workout } from '../domain/types';
import { STORAGE_VERSION } from '../domain/types';
import { duplicateWorkout as copyWorkout } from '../domain/workout';
import { loadAppData, preferencePatch, sanitizeAppData, saveAppData } from '../services/storage';

export function useAppData() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const dataRef = useRef(data);
  dataRef.current = data;

  const commit = useCallback((recipe: (current: AppData) => AppData) => {
    setData((current) => {
      const next = sanitizeAppData({ ...recipe(current), version: STORAGE_VERSION });
      saveAppData(next);
      return next;
    });
  }, []);

  const setPreferences = useCallback(
    (patch: Partial<Preferences>) => {
      commit((current) => ({
        ...current,
        preferences: preferencePatch(current.preferences, patch),
      }));
    },
    [commit],
  );

  const saveWorkout = useCallback(
    (workout: Workout) => {
      commit((current) => {
        const exists = current.workouts.some((item) => item.id === workout.id);
        const workouts = exists
          ? current.workouts.map((item) => (item.id === workout.id ? workout : item))
          : [workout, ...current.workouts];
        return { ...current, workouts };
      });
    },
    [commit],
  );

  const deleteWorkout = useCallback(
    (id: string) => {
      commit((current) => ({
        ...current,
        workouts: current.workouts.filter((workout) => workout.id !== id),
      }));
    },
    [commit],
  );

  const duplicateSavedWorkout = useCallback(
    (id: string) => {
      const source = dataRef.current.workouts.find((workout) => workout.id === id);
      if (!source) return;
      const created = copyWorkout(source);
      commit((current) => ({ ...current, workouts: [created, ...current.workouts] }));
    },
    [commit],
  );

  return { data, setPreferences, saveWorkout, deleteWorkout, duplicateSavedWorkout };
}
