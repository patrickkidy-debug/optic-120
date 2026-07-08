import { useEffect, useState } from 'react';
import { Download, WifiOff, X, Share } from 'lucide-react';
import { Button } from './ui';

const IOS_HINT_KEY = 'oculo_ios_hint_dismissed';

/** Vrai sur iPhone/iPad dans Safari, quand l'app n'est pas déjà installée. */
function shouldShowIosHint(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && isSafari && !standalone && localStorage.getItem(IOS_HINT_KEY) !== '1';
}

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
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // empêche l'invite native, on affiche la nôtre
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);

    setIosHint(shouldShowIosHint());
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

  function dismissIos() {
    localStorage.setItem(IOS_HINT_KEY, '1');
    setIosHint(false);
  }

  return (
    <>
      {offline && (
        <div
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-1.5 text-center text-sm font-medium text-white"
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

      {/* iOS : Safari n'a pas d'invite automatique → guide « Sur l'écran d'accueil ». */}
      {iosHint && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border bg-surface px-4 py-3 shadow-card-lg">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Share className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-content">Installer sur iPhone / iPad</p>
            <p className="text-content-muted">
              Appuie sur <b>Partager</b> (l'icône <span aria-hidden>⬆️</span> en bas de Safari), puis{' '}
              <b>« Sur l'écran d'accueil »</b>.
            </p>
          </div>
          <button
            onClick={dismissIos}
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
