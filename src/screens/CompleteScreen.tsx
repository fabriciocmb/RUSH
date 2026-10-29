import { Check } from 'lucide-react';
import type { WorkoutSummary } from '../domain/types';
import { Button } from '../components/Button';
import { SummaryGrid } from '../components/SummaryGrid';

interface CompleteScreenProps {
  workoutName: string;
  summary: WorkoutSummary;
  onRepeat: () => void;
  onHome: () => void;
}

export function CompleteScreen({ workoutName, summary, onRepeat, onHome }: CompleteScreenProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 px-5 pt-safe pb-safe">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-rush text-ink">
            <Check size={40} strokeWidth={3} />
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-wide text-rush">TREINO CONCLUÍDO</h1>
          <p className="mt-3 text-2xl font-semibold tracking-[0.12em]">{workoutName}</p>
        </div>
        <SummaryGrid summary={summary} />
        <div className="grid gap-3">
          <Button className="h-14" onClick={onRepeat}>
            REPETIR
          </Button>
          <Button variant="secondary" className="h-14" onClick={onHome}>
            VOLTAR AO INÍCIO
          </Button>
        </div>
      </div>
    </div>
  );
}
