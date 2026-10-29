import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { formatClockFromMs, formatRound } from '../domain/time';
import type { PhaseView } from '../domain/view';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface TimerScreenProps {
  workoutName: string;
  view: PhaseView;
  muted: boolean;
  onToggleMute: () => void;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onEnd: () => void;
}

export function TimerScreen({
  workoutName,
  view,
  muted,
  onToggleMute,
  onToggle,
  onNext,
  onPrevious,
  onEnd,
}: TimerScreenProps) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const clock = formatClockFromMs(view.remainingMs);
  const paused = view.status === 'paused';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirmEnd) return;
      if (event.code === 'Space') {
        event.preventDefault();
        onToggle();
      } else if (event.code === 'ArrowRight') {
        onNext();
      } else if (event.code === 'ArrowLeft') {
        onPrevious();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmEnd, onToggle, onNext, onPrevious]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 28%, ${view.glow}, transparent 58%), #101820`,
      }}
    >
      <div className="h-1.5 w-full shrink-0" style={{ background: view.accent }} />
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 px-4 pt-safe">
        <button
          type="button"
          onClick={() => setConfirmEnd(true)}
          className="h-11 rounded-xl px-3 text-xs font-bold tracking-[0.14em] text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-rush"
        >
          FINALIZAR
        </button>
        <p className="truncate text-center text-sm font-bold tracking-[0.16em]">{workoutName}</p>
        <button
          type="button"
          aria-label={muted ? 'Ativar som' : 'Silenciar'}
          aria-pressed={muted}
          onClick={onToggleMute}
          className="grid h-11 w-11 place-items-center rounded-xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rush"
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-5">
        <p className="sr-only" aria-live="polite">
          {view.label}. Round {view.roundNumber} de {view.roundCount}.
        </p>
        <p className="text-sm font-bold tracking-[0.22em] text-white/80">
          ROUND {formatRound(view.roundNumber)} / {formatRound(view.roundCount)}
        </p>
        <h1 className="phase-label mt-[clamp(0.4rem,2vh,1.25rem)]" style={{ color: view.accent }}>
          {view.label}
        </h1>
        <p
          role="timer"
          aria-label={`${view.label}, ${clock} restantes`}
          className={`timer-digits mt-[clamp(0.25rem,1.5vh,1rem)] ${view.countdown ? 'countdown-pulse' : ''}`}
          style={{ color: view.countdown ? view.accent : '#FFFFFF' }}
        >
          {clock}
        </p>
        <div className="mt-[clamp(0.8rem,3vh,1.75rem)] h-2 w-full max-w-3xl overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${view.progress * 100}%`,
              background: view.accent,
              transition: 'width 120ms linear',
            }}
          />
        </div>
        <p className="mt-[clamp(0.7rem,2vh,1.25rem)] text-center text-base font-bold tracking-[0.12em] text-white/85 sm:text-lg">
          PRÓXIMO: {view.nextLabel}
        </p>
      </main>

      <footer className="mx-auto grid w-full max-w-3xl shrink-0 grid-cols-3 gap-3 px-4 pt-2 pb-safe">
        <ControlButton label="FASE ANTERIOR" onClick={onPrevious}>
          <SkipBack size={26} />
        </ControlButton>
        <button
          type="button"
          onClick={onToggle}
          className="flex h-[clamp(4.5rem,14vh,6.5rem)] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl font-bold tracking-[0.12em] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ background: view.accent }}
        >
          {paused ? <Play size={28} fill="currentColor" /> : <Pause size={28} fill="currentColor" />}
          <span className="text-[0.72rem]">{paused ? 'RETOMAR' : 'PAUSAR'}</span>
        </button>
        <ControlButton label="PRÓXIMA FASE" onClick={onNext}>
          <SkipForward size={26} />
        </ControlButton>
      </footer>

      <ConfirmDialog
        open={confirmEnd}
        title="Encerrar treino?"
        body="O cronômetro será interrompido."
        confirmLabel="ENCERRAR"
        cancelLabel="CONTINUAR"
        danger
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false);
          onEnd();
        }}
      />
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[clamp(4.5rem,14vh,6.5rem)] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl bg-card px-2 font-bold tracking-[0.1em] text-white ring-1 ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush"
    >
      {children}
      <span className="max-w-[8.5rem] text-center text-[0.68rem] leading-tight">{label}</span>
    </button>
  );
}
