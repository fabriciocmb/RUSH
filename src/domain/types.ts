export const STORAGE_VERSION = 1;
export const STORAGE_KEY = 'rush-timer.v1';
export const INSTALL_DISMISS_KEY = 'rush-timer.install.dismissed';

export const MAX_PHASE_SECONDS = 99 * 60 + 59;
export const MAX_ROUNDS = 99;
export const MAX_NAME_LENGTH = 40;
export const MAX_STORED_WORKOUTS = 200;

export const QUICK_RUSH_SECONDS = [10, 15, 30, 45, 60, 90] as const;
export const QUICK_BREAK_SECONDS = [0, 10, 15, 30, 45, 60, 90] as const;
export const QUICK_PREPARE_SECONDS = [0, 5, 10, 15, 30] as const;

export interface Round {
  id: string;
  rushSeconds: number;
  breakSeconds: number;
}

export interface Workout {
  id: string;
  name: string;
  prepareSeconds: number;
  rounds: Round[];
  createdAt: number;
  updatedAt: number;
}

export interface Preferences {
  volume: number;
  muted: boolean;
  vibration: boolean;
  defaultPrepareSeconds: number;
}

export interface AppData {
  version: number;
  workouts: Workout[];
  preferences: Preferences;
}

export type PhaseKind = 'prepare' | 'rush' | 'break';

export interface Phase {
  key: string;
  kind: PhaseKind;
  roundIndex: number;
  durationMs: number;
}

export interface WorkoutSummary {
  rounds: number;
  prepareSeconds: number;
  rushSeconds: number;
  breakSeconds: number;
  totalSeconds: number;
}

export type PresetKind = 'tabata' | 'hiit' | 'boxing' | 'custom';

export const DEFAULT_PREFERENCES: Preferences = {
  volume: 0.8,
  muted: false,
  vibration: false,
  defaultPrepareSeconds: 10,
};
