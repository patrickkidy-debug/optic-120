import { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { Button } from './ui';

/** Événement `beforeinstallprompt` (non typé par défaut dans lib.dom). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Contrôles PWA globaux :
 *  - bandeau « Hors ligne » quand le réseau tombe (données figées, reconnexion auto) ;
 *  - invite d'installation quand le navigateur le permet (Chrome/Edge Android & desktop).
 * Rien à configurer : le service worker et le manifest sont déjà en place.
 */
export function PwaControls() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // empêche l'invite native, on affiche la nôtre
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <>
      {offline && (
        <div
          className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-1.5 text-center text-sm font-medium text-white"
          style={{ background: '#d97706' }}
          role="status"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          Hors ligne — les données ne se mettent plus à jour. Reconnexion automatique au retour du réseau.
        </div>
      )}

      {deferred && !dismissed && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-surface px-4 py-3 shadow-card-lg">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-content">Installer OculoSaaS</p>
            <p className="text-content-muted">Accès plein écran, ouverture rapide, hors connexion.</p>
          </div>
          <Button onClick={install}>Installer</Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-content-faint transition hover:text-content"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
