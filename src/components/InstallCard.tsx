import { Download, Share, X } from 'lucide-react';
import type { InstallKind } from '../hooks/useInstallPrompt';
import { Button } from './Button';

interface InstallCardProps {
  kind: InstallKind;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallCard({ kind, onInstall, onDismiss }: InstallCardProps) {
  if (kind === 'hidden') return null;

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xs font-bold tracking-[0.18em] text-muted">INSTALAR</h2>
        <button
          type="button"
          aria-label="Fechar instruções de instalação"
          onClick={onDismiss}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-rush"
        >
          <X size={16} />
        </button>
      </div>
      {kind === 'android' ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-white/90">
            Instale o RUSH TIMER para abrir em tela cheia e usar offline.
          </p>
          <Button className="mt-4 w-full" onClick={onInstall}>
            <Download size={18} />
            INSTALAR
          </Button>
        </div>
      ) : null}
      {kind === 'ios' ? (
        <p className="mt-3 flex gap-3 text-sm leading-relaxed text-white/90">
          <Share size={18} className="mt-0.5 shrink-0 text-prepare" aria-hidden />
          <span>No Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.</span>
        </p>
      ) : null}
      {kind === 'manual' ? (
        <p className="mt-3 text-sm leading-relaxed text-white/90">
          No menu do navegador, escolha Instalar app ou Adicionar à Tela de Início.
        </p>
      ) : null}
    </section>
  );
}
