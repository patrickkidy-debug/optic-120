import { create } from 'zustand';
import { API_URL } from '../api';

/**
 * État du réseau, VÉRIFIÉ.
 *
 * `navigator.onLine` ne dit que « une interface réseau est active ». Un
 * téléphone connecté à un Wi-Fi de boutique sans accès Internet, ou à une box
 * dont l'abonnement a expiré, répond `true`. On le prend donc comme un indice,
 * et on confirme en joignant réellement l'API (/health). Hors ligne, on
 * revérifie toutes les 10 s ; en ligne, toutes les 30 s.
 */

interface NetworkState {
  online: boolean;
  checkedAt: number | null;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  checkedAt: null,
  setOnline: (online) => set({ online, checkedAt: Date.now() }),
}));

const ONLINE_INTERVAL_MS = 30_000;
const OFFLINE_INTERVAL_MS = 10_000;
const PROBE_TIMEOUT_MS = 6_000;

/** Joint réellement l'API. Un serveur qui répond (même une erreur 5xx) = réseau présent. */
export async function probe(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${API_URL}/health`, { cache: 'no-store', signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

export async function checkNow(): Promise<boolean> {
  const online = await probe();
  useNetworkStore.getState().setOnline(online);
  return online;
}

function schedule() {
  if (timer) clearTimeout(timer);
  const every = useNetworkStore.getState().online ? ONLINE_INTERVAL_MS : OFFLINE_INTERVAL_MS;
  timer = setTimeout(async () => {
    await checkNow();
    schedule();
  }, every);
}

/** Démarre la surveillance (une seule fois pour toute l'application). */
export function startNetworkWatch(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // L'événement « offline » du navigateur est fiable dans ce sens-là : on
  // bascule tout de suite. « online » n'est qu'un indice : on vérifie.
  window.addEventListener('offline', () => {
    useNetworkStore.getState().setOnline(false);
    schedule();
  });
  window.addEventListener('online', () => {
    void checkNow().then(schedule);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkNow().then(schedule);
  });
  void checkNow().then(schedule);
}

/**
 * Une requête vient d'échouer faute de réseau : inutile d'attendre la
 * prochaine vérification pour l'afficher.
 */
export function reportNetworkFailure(): void {
  if (useNetworkStore.getState().online) {
    useNetworkStore.getState().setOnline(false);
    schedule();
  }
}
