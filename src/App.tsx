import { useCallback, useEffect, useRef, useState } from 'react';
import { summarize } from './domain/phases';
import type { TimerEvent } from './domain/timerEngine';
import { formatClockFromMs } from './domain/time';
import type { Preferences, PresetKind, Workout } from './domain/types';
import { getPhaseView } from './domain/view';
import {
  cloneWorkout,
  createPreset,
  normalizeWorkout,
  workoutSignature,
} from './domain/workout';
import { useAppData } from './hooks/useAppData';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useWakeLock } from './hooks/useWakeLock';
import { useWorkoutTimer } from './hooks/useWorkoutTimer';
import { audio } from './services/audio';
import { vibrateComplete, vibratePhase } from './services/vibration';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CompleteScreen } from './screens/CompleteScreen';
import { EditorScreen } from './screens/EditorScreen';
import { HomeScreen } from './screens/HomeScreen';
import { TimerScreen } from './screens/TimerScreen';

type ScreenName = 'home' | 'editor' | 'timer' | 'complete';

interface EditorSession {
  draft: Workout;
  savedSignature: string | null;
  initialSignature: string;
}

function isDirty(session: EditorSession | null): boolean {
  if (!session) return false;
  const signature = workoutSignature(session.draft);
  if (session.savedSignature != null) return signature !== session.savedSignature;
  return signature !== session.initialSignature;
}

export default function App() {
  const { data, setPreferences, saveWorkout, deleteWorkout, duplicateSavedWorkout } = useAppData();
  const install = useInstallPrompt();
  const prefsRef = useRef(data.preferences);
  prefsRef.current = data.preferences;

  const [screen, setScreen] = useState<ScreenName>('home');
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const [returnTo, setReturnTo] = useState<'home' | 'editor'>('home');
  const [confirmHome, setConfirmHome] = useState(false);
  const startingRef = useRef(false);

  const handleEvents = useCallback((events: TimerEvent[]) => {
    const preferences = prefsRef.current;
    const delayBeep = events.some((event) => event.type === 'enter-phase' && event.kind !== 'prepare');
    for (const event of events) {
      if (event.type === 'countdown') {
        audio.playBeep(
          `${event.generation}:${event.phaseIndex}:beep:${event.second}`,
          delayBeep ? 0.1 : 0,
        );
      } else if (event.type === 'enter-phase') {
        const key = `${event.generation}:enter:${event.phaseIndex}`;
        if (event.kind === 'rush') audio.playRush(key);
        if (event.kind === 'break') audio.playBreak(key);
        if (preferences.vibration && event.kind !== 'prepare') vibratePhase(event.kind);
      } else {
        audio.playComplete(`${event.generation}:complete`);
        if (preferences.vibration) vibrateComplete();
        setScreen('complete');
      }
    }
  }, []);

  const timer = useWorkoutTimer(handleEvents);
  const view = getPhaseView(timer.snapshot);
  const gainWakeLock = useWakeLock(screen === 'timer' || screen === 'complete');

  useEffect(() => {
    audio.setVolume(data.preferences.volume);
    audio.setMuted(data.preferences.muted);
  }, [data.preferences.volume, data.preferences.muted]);

  const displayedSecond = Math.ceil(timer.snapshot.remainingMs / 1000);
  useEffect(() => {
    if (screen === 'timer' && view) {
      document.title = `${view.label} ${formatClockFromMs(view.remainingMs)} · RUSH TIMER`;
    } else if (screen === 'complete') {
      document.title = 'TREINO CONCLUÍDO · RUSH TIMER';
    } else {
      document.title = 'RUSH TIMER';
    }
  }, [screen, view, displayedSecond]);

  const openEditor = (draft: Workout, saved: boolean) => {
    const signature = workoutSignature(draft);
    setEditor({
      draft,
      savedSignature: saved ? signature : null,
      initialSignature: signature,
    });
    setScreen('editor');
  };

  const begin = async (workout: Workout, back: 'home' | 'editor') => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      audio.prime();
      gainWakeLock(true);
      try {
        await audio.unlock();
      } catch {
        // The clock still runs when the browser blocks audio.
      }
      const normalized = normalizeWorkout(workout);
      const started = timer.start(normalized);
      if (!started) return;
      if (back === 'editor') {
        setPreferences({ defaultPrepareSeconds: normalized.prepareSeconds });
      }
      setReturnTo(back);
      setScreen('timer');
    } finally {
      startingRef.current = false;
    }
  };

  const updateDraft = (draft: Workout) => {
    setEditor((current) => (current ? { ...current, draft } : current));
  };

  const handleSave = () => {
    if (!editor) return;
    const normalized = normalizeWorkout(editor.draft);
    saveWorkout(normalized);
    setPreferences({ defaultPrepareSeconds: normalized.prepareSeconds });
    const signature = workoutSignature(normalized);
    setEditor({
      draft: normalized,
      savedSignature: signature,
      initialSignature: editor.initialSignature,
    });
  };

  const leaveTimer = () => {
    timer.stop();
    setScreen(returnTo);
  };

  const goHome = () => {
    timer.stop();
    setEditor(null);
    setConfirmHome(false);
    setScreen('home');
  };

  const requestHome = () => {
    if (isDirty(editor)) setConfirmHome(true);
    else goHome();
  };

  const togglePause = () => {
    if (timer.snapshot.status === 'paused') timer.resume();
    else timer.pause();
  };

  const toggleMute = () => {
    const preferences: Partial<Preferences> = { muted: !data.preferences.muted };
    setPreferences(preferences);
  };

  return (
    <div className="h-full bg-ink font-display text-white">
      {screen === 'home' ? (
        <HomeScreen
          workouts={data.workouts}
          preferences={data.preferences}
          installKind={install.kind}
          onInstall={() => void install.install()}
          onDismissInstall={install.dismiss}
          onCreate={() => openEditor(createPreset('custom', data.preferences.defaultPrepareSeconds), false)}
          onQuick={(kind: PresetKind) =>
            openEditor(createPreset(kind, data.preferences.defaultPrepareSeconds), false)
          }
          onStart={(workout) => {
            setEditor(null);
            void begin(workout, 'home');
          }}
          onEdit={(workout) => openEditor(cloneWorkout(workout), true)}
          onDuplicate={(workout) => duplicateSavedWorkout(workout.id)}
          onDelete={(workout) => deleteWorkout(workout.id)}
          onPreferences={setPreferences}
        />
      ) : null}

      {screen === 'editor' && editor ? (
        <EditorScreen
          draft={editor.draft}
          dirty={isDirty(editor)}
          onChange={updateDraft}
          onBack={() => {
            setEditor(null);
            setScreen('home');
          }}
          onSave={handleSave}
          onStart={() => void begin(editor.draft, 'editor')}
        />
      ) : null}

      {screen === 'timer' && view ? (
        <TimerScreen
          workoutName={timer.workout?.name ?? 'TREINO'}
          view={view}
          muted={data.preferences.muted || data.preferences.volume === 0}
          onToggleMute={toggleMute}
          onToggle={togglePause}
          onNext={timer.next}
          onPrevious={timer.previous}
          onEnd={leaveTimer}
        />
      ) : null}

      {screen === 'complete' && timer.workout ? (
        <CompleteScreen
          workoutName={timer.workout.name}
          summary={summarize(timer.workout)}
          onRepeat={() => void begin(timer.workout as Workout, returnTo)}
          onHome={requestHome}
        />
      ) : null}

      <ConfirmDialog
        open={confirmHome}
        title="Descartar alterações?"
        body="As mudanças deste treino serão perdidas."
        confirmLabel="DESCARTAR"
        cancelLabel="CANCELAR"
        danger
        onCancel={() => setConfirmHome(false)}
        onConfirm={goHome}
      />
    </div>
  );
}
