import type { AppData, Preferences, Round, Workout } from '../domain/types';
import {
  DEFAULT_PREFERENCES,
  MAX_NAME_LENGTH,
  MAX_STORED_WORKOUTS,
  STORAGE_KEY,
  STORAGE_VERSION,
} from '../domain/types';
import { clampInt, clampPhaseSeconds, createId } from '../domain/time';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const memoryStore = new Map<string, string>();

const memoryStorage: StorageLike = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

export function browserStorage(): StorageLike {
  try {
    if (typeof localStorage === 'undefined') return memoryStorage;
    const probe = '__rush_timer_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeRound(value: unknown, seen: Set<string>): Round | null {
  if (!isRecord(value)) return null;
  const rushSeconds = clampPhaseSeconds(Number(value.rushSeconds), 1);
  const breakSeconds = clampPhaseSeconds(Number(value.breakSeconds), 0);
  if (!Number.isFinite(Number(value.rushSeconds)) || Number(value.rushSeconds) <= 0) return null;
  if (!Number.isFinite(Number(value.breakSeconds)) || Number(value.breakSeconds) < 0) return null;

  let id = typeof value.id === 'string' && value.id.trim() ? value.id : createId();
  if (seen.has(id)) id = createId();
  seen.add(id);
  return { id, rushSeconds, breakSeconds };
}

function sanitizeWorkout(value: unknown, seenIds: Set<string>): Workout | null {
  if (!isRecord(value) || !Array.isArray(value.rounds)) return null;
  const seenRounds = new Set<string>();
  const rounds = value.rounds
    .map((round) => sanitizeRound(round, seenRounds))
    .filter((round): round is Round => round !== null);
  if (rounds.length === 0) return null;

  let id = typeof value.id === 'string' && value.id.trim() ? value.id : createId();
  if (seenIds.has(id)) id = createId();
  seenIds.add(id);

  const rawName = typeof value.name === 'string' ? value.name : 'TREINO';
  const name = rawName.trim().toLocaleUpperCase('pt-BR').slice(0, MAX_NAME_LENGTH) || 'TREINO';
  const createdAt = Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now();
  const updatedAt = Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : createdAt;

  return {
    id,
    name,
    prepareSeconds: clampPhaseSeconds(Number(value.prepareSeconds), 0),
    rounds,
    createdAt,
    updatedAt,
  };
}

export function sanitizePreferences(value: unknown): Preferences {
  const source = isRecord(value) ? value : {};
  const volume = Number(source.volume);
  const prepare = Number(source.defaultPrepareSeconds);
  return {
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_PREFERENCES.volume,
    muted: source.muted === true,
    vibration: source.vibration === true,
    defaultPrepareSeconds: Number.isFinite(prepare)
      ? clampPhaseSeconds(prepare, 0)
      : DEFAULT_PREFERENCES.defaultPrepareSeconds,
  };
}

export function sanitizeAppData(value: unknown): AppData {
  if (!isRecord(value)) return freshAppData();
  const version = Number(value.version);
  if (!Number.isFinite(version) || version < 1) return freshAppData();

  const seen = new Set<string>();
  const workouts = Array.isArray(value.workouts)
    ? value.workouts
        .map((workout) => sanitizeWorkout(workout, seen))
        .filter((workout): workout is Workout => workout !== null)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_STORED_WORKOUTS)
    : [];

  return {
    version: STORAGE_VERSION,
    workouts,
    preferences: sanitizePreferences(value.preferences),
  };
}

export function freshAppData(): AppData {
  return {
    version: STORAGE_VERSION,
    workouts: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

export function loadAppData(storage: StorageLike = browserStorage()): AppData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return freshAppData();
    return sanitizeAppData(JSON.parse(raw) as unknown);
  } catch {
    return freshAppData();
  }
}

export function saveAppData(data: AppData, storage: StorageLike = browserStorage()): void {
  const safe = sanitizeAppData(data);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Quota or private mode: keep the in-memory session.
  }
}

export function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function preferencePatch(current: Preferences, patch: Partial<Preferences>): Preferences {
  return sanitizePreferences({
    ...current,
    ...patch,
    volume: patch.volume == null ? current.volume : clampVolume(patch.volume),
    defaultPrepareSeconds:
      patch.defaultPrepareSeconds == null
        ? current.defaultPrepareSeconds
        : clampInt(patch.defaultPrepareSeconds, 0, 99 * 60 + 59),
  });
}
