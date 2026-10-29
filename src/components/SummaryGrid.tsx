import type { WorkoutSummary } from '../domain/types';
import { formatDuration } from '../domain/time';

export function SummaryGrid({ summary }: { summary: WorkoutSummary }) {
  const items = [
    { label: 'ROUNDS', value: String(summary.rounds).padStart(2, '0') },
    { label: 'DURAÇÃO', value: formatDuration(summary.totalSeconds) },
    { label: 'EXERCÍCIO', value: formatDuration(summary.rushSeconds) },
    { label: 'DESCANSO', value: formatDuration(summary.breakSeconds) },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-card px-4 py-3">
            <dt className="text-[0.68rem] font-bold tracking-[0.16em] text-muted">{item.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        A duração inclui a preparação e não conta o descanso do último round.
      </p>
    </div>
  );
}
