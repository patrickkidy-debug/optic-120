import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, WifiOff, X, Share } from 'lucide-react';
import { Button } from './ui';
import { useNetworkStore } from '../lib/offline/network';
import { useAuthStore } from '../store/auth';

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

/** Prompt capturé tôt par le script inline d'index.html (avant React). */
type WinWithPrompt = Window & { __oculoInstallPrompt?: InstallPromptEvent | null };

/**
 * Contrôles PWA globaux :
 *  - bandeau « Hors ligne » quand le réseau tombe (données figées, reconnexion auto) ;
 *  - invite d'installation quand le navigateur le permet (Chrome/Edge Android & desktop).
 * Rien à configurer : le service worker et le manifest sont déjà en place.
 */
export function PwaControls() {
  const { t } = useTranslation();
  // Le tunnel d'activation est une page de conversion : une invite qui recouvre
  // le bas de l'ecran mobile detourne du bouton principal. Le bandeau « Hors
  // ligne » reste affiche partout, lui : il previent d'une vraie panne.
  const path = useLocation().pathname;
  // Même règle pour le portail fournisseurs / transporteurs et le suivi public
  // (OculoTrack) : ce ne sont pas l'application du magasin, et l'invite
  // recouvrait le bouton « Confirmer la réception » sur téléphone.
  const onFunnel = ['/activation', '/portail', '/track/', '/s/'].some((p) => path.startsWith(p));
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  // Etat reseau VERIFIE (voir lib/offline/network.ts) plutot que
  // navigator.onLine, qui dit « en ligne » sur un Wi-Fi sans Internet.
  const offline = !useNetworkStore((st) => st.online);
  const hasSession = useAuthStore((st) => !!st.user);
  const [dismissed, setDismissed] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const w = window as WinWithPrompt;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // empêche l'invite native, on affiche la nôtre
      setDeferred(e as InstallPromptEvent);
    };
    // L'événement a pu se produire AVANT le montage de React : le script inline
    // d'index.html l'a stocké → on le récupère ici.
    const onAvailable = () => {
      if (w.__oculoInstallPrompt) setDeferred(w.__oculoInstallPrompt);
    };
    const onInstalled = () => {
      w.__oculoInstallPrompt = null;
      setDeferred(null);
    };

    setIosHint(shouldShowIosHint());
    if (w.__oculoInstallPrompt) setDeferred(w.__oculoInstallPrompt);
    window.addEventListener('oculo-install-available', onAvailable);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('oculo-install-available', onAvailable);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    (window as WinWithPrompt).__oculoInstallPrompt = null;
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
          {hasSession ? t('sync.bannerSession') : t('sync.bannerNoSession')}
        </div>
      )}

      {deferred && !dismissed && !onFunnel && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-surface px-4 py-3 shadow-card-lg">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-content">{t('pwa.installTitle')}</p>
            <p className="text-content-muted">{t('pwa.installText')}</p>
          </div>
          <Button onClick={install}>{t('pwa.install')}</Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-content-faint transition hover:text-content"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* iOS : Safari n'a pas d'invite automatique → guide « Sur l'écran d'accueil ». */}
      {iosHint && !onFunnel && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border bg-surface px-4 py-3 shadow-card-lg">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Share className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-content">{t('pwa.iosTitle')}</p>
            <p className="text-content-muted">
              {t('pwa.iosTap')} <b>{t('pwa.iosShare')}</b> {t('pwa.iosIcon')} <span aria-hidden>⬆️</span>{' '}
              {t('pwa.iosBottom')} <b>{t('pwa.iosHome')}</b>.
            </p>
          </div>
          <button
            onClick={dismissIos}
            className="text-content-faint transition hover:text-content"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
