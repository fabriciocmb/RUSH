import { clampPhaseSeconds } from '../domain/time';
import { formatClock } from '../domain/time';

interface TimeFieldProps {
  label: string;
  seconds: number;
  minimum: number;
  tone: 'rush' | 'break' | 'prepare';
  shortcuts: readonly number[];
  onChange: (seconds: number) => void;
}

const toneClass = {
  rush: 'text-rush',
  break: 'text-break',
  prepare: 'text-prepare',
} as const;

export function TimeField({ label, seconds, minimum, tone, shortcuts, onChange }: TimeFieldProps) {
  const commit = (next: number) => onChange(clampPhaseSeconds(next, minimum));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <span className={`text-sm font-bold tracking-[0.18em] ${toneClass[tone]}`}>{label}</span>
        <span className="font-mono text-3xl font-bold tracking-tight tabular-nums">
          {formatClock(seconds)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stepper
          caption="MIN"
          value={minutes}
          decreaseLabel={`Diminuir minutos de ${label}`}
          increaseLabel={`Aumentar minutos de ${label}`}
          onDecrease={() => commit(seconds - 60)}
          onIncrease={() => commit(seconds + 60)}
        />
        <Stepper
          caption="SEG"
          value={remainder}
          decreaseLabel={`Diminuir segundos de ${label}`}
          increaseLabel={`Aumentar segundos de ${label}`}
          onDecrease={() => commit(seconds - 1)}
          onIncrease={() => commit(seconds + 1)}
        />
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {shortcuts.map((shortcut) => {
          const selected = seconds === shortcut;
          return (
            <button
              key={shortcut}
              type="button"
              aria-pressed={selected}
              onClick={() => commit(shortcut)}
              className={`h-9 shrink-0 rounded-full px-3 text-xs font-bold tracking-[0.08em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush ${
                selected ? 'bg-white text-ink' : 'bg-white/10 text-muted'
              }`}
            >
              {shortcut}s
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({
  caption,
  value,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
}: {
  caption: string;
  value: number;
  decreaseLabel: string;
  increaseLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-ink px-1 py-1">
      <button
        type="button"
        aria-label={decreaseLabel}
        onClick={onDecrease}
        className="grid h-11 w-11 place-items-center rounded-lg text-2xl leading-none text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rush"
      >
        −
      </button>
      <div className="text-center">
        <div className="font-mono text-lg font-bold tabular-nums">{String(value).padStart(2, '0')}</div>
        <div className="text-[0.62rem] tracking-[0.16em] text-muted">{caption}</div>
      </div>
      <button
        type="button"
        aria-label={increaseLabel}
        onClick={onIncrease}
        className="grid h-11 w-11 place-items-center rounded-lg text-2xl leading-none text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rush"
      >
        +
      </button>
    </div>
  );
}
