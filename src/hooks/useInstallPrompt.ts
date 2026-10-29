import { useEffect, useState } from 'react';
import { INSTALL_DISMISS_KEY } from '../domain/types';

export type InstallKind = 'hidden' | 'android' | 'ios' | 'manual';

function isStandalone(): boolean {
  const displayMode = window.matchMedia('(display-mode: standalone)').matches;
  return displayMode || window.navigator.standalone === true;
}

function isIos(): boolean {
  const userAgent = window.navigator.userAgent;
  const iPhone = /iphone|ipad|ipod/i.test(userAgent);
  const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return iPhone || iPadOs;
}

function dismissed(): boolean {
  try {
    return sessionStorage.getItem(INSTALL_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function useInstallPrompt() {
  const [kind, setKind] = useState<InstallKind>('hidden');
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || dismissed()) return;

    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setPromptEvent(event);
      setKind('android');
    };

    window.addEventListener('beforeinstallprompt', onPrompt);

    if (isIos()) {
      setKind('ios');
      return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    }

    const revealManual = window.setTimeout(() => {
      setKind((current) => (current === 'hidden' ? 'manual' : current));
    }, 1200);

    return () => {
      window.clearTimeout(revealManual);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(INSTALL_DISMISS_KEY, '1');
    } catch {
      // Ignore private mode.
    }
    setKind('hidden');
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setKind('hidden');
    setPromptEvent(null);
  };

  return { kind, install, dismiss };
}
