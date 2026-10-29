import { ChevronDown, ChevronLeft, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { summarize } from '../domain/phases';
import { formatRound } from '../domain/time';
import type { Workout } from '../domain/types';
import {
  MAX_NAME_LENGTH,
  MAX_ROUNDS,
  QUICK_BREAK_SECONDS,
  QUICK_PREPARE_SECONDS,
  QUICK_RUSH_SECONDS,
} from '../domain/types';
import { createId } from '../domain/time';
import { duplicateRound, moveRound, removeRound, updateRound } from '../domain/workout';
import { Button, IconButton } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SummaryGrid } from '../components/SummaryGrid';
import { TimeField } from '../components/TimeField';

interface EditorScreenProps {
  draft: Workout;
  dirty: boolean;
  onChange: (draft: Workout) => void;
  onBack: () => void;
  onSave: () => void;
  onStart: () => void;
}

export function EditorScreen({ draft, dirty, onChange, onBack, onSave, onStart }: EditorScreenProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const summary = summarize(draft);
  const atLimit = draft.rounds.length >= MAX_ROUNDS;

  useEffect(() => {
    if (!savedFlash) return;
    const timeout = window.setTimeout(() => setSavedFlash(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [savedFlash]);

  const requestBack = () => {
    if (dirty) setConfirmLeave(true);
    else onBack();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 pt-safe pb-36">
        <header className="flex items-center gap-3 pt-2">
          <IconButton label="Voltar" onClick={requestBack}>
            <ChevronLeft size={22} />
          </IconButton>
          <h1 className="text-xl font-bold tracking-[0.16em]">EDITOR</h1>
        </header>

        <label className="block">
          <span className="mb-2 block text-xs font-bold tracking-[0.16em] text-muted">NOME DO TREINO</span>
          <input
            value={draft.name}
            maxLength={MAX_NAME_LENGTH}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label="Nome do treino"
            onChange={(event) =>
              onChange({
                ...draft,
                name: event.target.value.toLocaleUpperCase('pt-BR').slice(0, MAX_NAME_LENGTH),
              })
            }
            className="h-14 w-full rounded-2xl bg-card px-4 text-xl font-bold tracking-wide outline-none ring-1 ring-white/10 focus:ring-rush"
          />
        </label>

        <section className="rounded-2xl bg-card p-4">
          <TimeField
            label="PREPARAÇÃO"
            tone="prepare"
            seconds={draft.prepareSeconds}
            minimum={0}
            shortcuts={QUICK_PREPARE_SECONDS}
            onChange={(prepareSeconds) => onChange({ ...draft, prepareSeconds })}
          />
          <p className="text-xs leading-relaxed text-muted">
            Contagem antes do primeiro RUSH. Use 0 para começar direto no exercício.
          </p>
        </section>

        <div className="flex flex-col gap-3">
          {draft.rounds.map((round, index) => {
            const isLast = index === draft.rounds.length - 1;
            return (
              <article key={round.id} className="rounded-2xl bg-card p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold tracking-[0.16em] text-muted">
                    ROUND {formatRound(index + 1)}
                  </h2>
                  <div className="flex gap-1">
                    <IconButton
                      label={`Mover round ${index + 1} para cima`}
                      disabled={index === 0}
                      onClick={() => onChange({ ...draft, rounds: moveRound(draft.rounds, index, -1) })}
                    >
                      <ChevronUp size={18} />
                    </IconButton>
                    <IconButton
                      label={`Mover round ${index + 1} para baixo`}
                      disabled={isLast}
                      onClick={() => onChange({ ...draft, rounds: moveRound(draft.rounds, index, 1) })}
                    >
                      <ChevronDown size={18} />
                    </IconButton>
                    <IconButton
                      label={`Duplicar round ${index + 1}`}
                      disabled={atLimit}
                      onClick={() => onChange({ ...draft, rounds: duplicateRound(draft.rounds, index) })}
                    >
                      <Copy size={18} />
                    </IconButton>
                    <IconButton
                      label={`Excluir round ${index + 1}`}
                      disabled={draft.rounds.length <= 1}
                      onClick={() => onChange({ ...draft, rounds: removeRound(draft.rounds, index) })}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </div>
                </div>
                <TimeField
                  label="RUSH"
                  tone="rush"
                  seconds={round.rushSeconds}
                  minimum={1}
                  shortcuts={QUICK_RUSH_SECONDS}
                  onChange={(rushSeconds) =>
                    onChange({ ...draft, rounds: updateRound(draft.rounds, index, { rushSeconds }) })
                  }
                />
                <div className={`mt-4 ${isLast ? 'opacity-80' : ''}`}>
                  <TimeField
                    label="BREAK"
                    tone="break"
                    seconds={round.breakSeconds}
                    minimum={0}
                    shortcuts={QUICK_BREAK_SECONDS}
                    onChange={(breakSeconds) =>
                      onChange({ ...draft, rounds: updateRound(draft.rounds, index, { breakSeconds }) })
                    }
                  />
                  {isLast ? (
                    <p className="text-xs text-muted">Sem BREAK no último round. O tempo fica guardado se você reordenar.</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <Button
          variant="secondary"
          className="w-full"
          disabled={atLimit}
          onClick={() =>
            onChange({
              ...draft,
              rounds: [...draft.rounds, { id: createId(), rushSeconds: 30, breakSeconds: 15 }],
            })
          }
        >
          <Plus size={18} />
          ADICIONAR ROUND
        </Button>

        <section>
          <h2 className="mb-3 text-xs font-bold tracking-[0.18em] text-muted">RESUMO</h2>
          <SummaryGrid summary={summary} />
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-3 px-5 pt-3 pb-safe">
          <Button
            variant="secondary"
            onClick={() => {
              onSave();
              setSavedFlash(true);
            }}
          >
            {savedFlash ? 'SALVO' : 'SALVAR'}
          </Button>
          <Button className="px-3 text-xs sm:text-sm" onClick={onStart}>
            INICIAR TREINO
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Descartar alterações?"
        body="As mudanças deste treino serão perdidas."
        confirmLabel="DESCARTAR"
        cancelLabel="CONTINUAR EDITANDO"
        danger
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          onBack();
        }}
      />
    </div>
  );
}
