import { Copy, Pencil, Play, Plus, Trash2, Vibrate, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { summarize } from '../domain/phases';
import { formatDuration } from '../domain/time';
import type { Preferences, PresetKind, Workout } from '../domain/types';
import type { InstallKind } from '../hooks/useInstallPrompt';
import { Button, IconButton } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InstallCard } from '../components/InstallCard';
import { Logo } from '../components/Logo';

const QUICK: Array<{ kind: PresetKind; title: string; detail: string }> = [
  { kind: 'tabata', title: 'TABATA', detail: '8 × 00:20 / 00:10' },
  { kind: 'hiit', title: 'HIIT', detail: '10 × 00:40 / 00:20' },
  { kind: 'boxing', title: 'BOXE', detail: '5 × 03:00 / 01:00' },
  { kind: 'custom', title: 'PERSONALIZADO', detail: 'Criar do zero' },
];

interface HomeScreenProps {
  workouts: Workout[];
  preferences: Preferences;
  installKind: InstallKind;
  onInstall: () => void;
  onDismissInstall: () => void;
  onCreate: () => void;
  onQuick: (kind: PresetKind) => void;
  onStart: (workout: Workout) => void;
  onEdit: (workout: Workout) => void;
  onDuplicate: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
  onPreferences: (patch: Partial<Preferences>) => void;
}

export function HomeScreen({
  workouts,
  preferences,
  installKind,
  onInstall,
  onDismissInstall,
  onCreate,
  onQuick,
  onStart,
  onEdit,
  onDuplicate,
  onDelete,
  onPreferences,
}: HomeScreenProps) {
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);
  const ordered = [...workouts].sort((a, b) => b.updatedAt - a.updatedAt);
  const muted = preferences.muted || preferences.volume === 0;
  const volumePercent = Math.round(preferences.volume * 100);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-5 pt-safe pb-safe">
        <header className="flex items-center gap-4 pt-2">
          <Logo />
          <div>
            <p className="text-4xl font-bold leading-none tracking-tight text-rush">RUSH</p>
            <h1 className="text-2xl font-semibold tracking-[0.22em] text-white">TIMER</h1>
          </div>
        </header>

        <Button className="h-14 w-full text-base" onClick={onCreate}>
          <Plus size={20} />
          CRIAR TREINO
        </Button>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-[0.18em] text-muted">MEUS TREINOS</h2>
          {ordered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">
              Nenhum treino salvo ainda.
            </p>
          ) : (
            ordered.map((workout) => {
              const summary = summarize(workout);
              return (
                <article key={workout.id} className="rounded-2xl bg-card p-4">
                  <h3 className="truncate text-xl font-bold tracking-wide">{workout.name}</h3>
                  <p className="mt-1 font-mono text-sm text-muted tabular-nums">
                    {summary.rounds} rounds · {formatDuration(summary.totalSeconds)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button className="min-w-36 flex-1" onClick={() => onStart(workout)}>
                      <Play size={18} fill="currentColor" />
                      INICIAR
                    </Button>
                    <IconButton label={`Editar ${workout.name}`} onClick={() => onEdit(workout)}>
                      <Pencil size={18} />
                    </IconButton>
                    <IconButton label={`Duplicar ${workout.name}`} onClick={() => onDuplicate(workout)}>
                      <Copy size={18} />
                    </IconButton>
                    <IconButton label={`Excluir ${workout.name}`} onClick={() => setPendingDelete(workout)}>
                      <Trash2 size={18} />
                    </IconButton>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-[0.18em] text-muted">TREINOS RÁPIDOS</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK.map((preset) => (
              <button
                key={preset.kind}
                type="button"
                onClick={() => onQuick(preset.kind)}
                className="rounded-2xl bg-card px-4 py-4 text-left ring-1 ring-white/5 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush"
              >
                <span className="block text-lg font-bold tracking-wide">{preset.title}</span>
                <span className="mt-1 block font-mono text-xs text-muted">{preset.detail}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-[0.18em] text-muted">AJUSTES</h2>
          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="volume" className="text-sm font-bold tracking-[0.14em]">
                VOLUME {volumePercent}%
              </label>
              <button
                type="button"
                aria-pressed={muted}
                onClick={() => onPreferences({ muted: !preferences.muted })}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-bold tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rush"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                {muted ? 'MUDO' : 'SOM'}
              </button>
            </div>
            <input
              id="volume"
              className="mt-4"
              type="range"
              min={0}
              max={100}
              value={volumePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={volumePercent}
              aria-valuetext={`${volumePercent}%`}
              onChange={(event) =>
                onPreferences({ volume: Number(event.target.value) / 100, muted: false })
              }
            />
            <button
              type="button"
              aria-pressed={preferences.vibration}
              onClick={() => onPreferences({ vibration: !preferences.vibration })}
              className="mt-4 flex h-11 w-full items-center justify-between rounded-xl bg-ink px-3 text-sm font-bold tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rush"
            >
              <span className="inline-flex items-center gap-2">
                <Vibrate size={16} />
                VIBRAÇÃO
              </span>
              <span className={preferences.vibration ? 'text-rush' : 'text-muted'}>
                {preferences.vibration ? 'LIGADA' : 'DESLIGADA'}
              </span>
            </button>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              A vibração só acontece em aparelhos compatíveis e não interrompe o treino se faltar suporte.
            </p>
          </div>
        </section>

        <InstallCard kind={installKind} onInstall={onInstall} onDismiss={onDismissInstall} />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir treino?"
        body={
          pendingDelete
            ? `${pendingDelete.name} será removido deste aparelho.`
            : 'Esse treino será removido deste aparelho.'
        }
        confirmLabel="EXCLUIR"
        cancelLabel="CANCELAR"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
