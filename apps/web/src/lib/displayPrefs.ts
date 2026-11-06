/**
 * Préférences d'affichage propres à l'appareil : taille du texte et animations
 * réduites. Stockées localement (chaque poste de la boutique garde les siennes)
 * et appliquées dès le démarrage, avant le premier rendu.
 */
export type TextSize = 'normal' | 'large' | 'xlarge';

const SIZE_KEY = 'oculo_text_size';
const MOTION_KEY = 'oculo_reduce_motion';
const SIZES: Record<TextSize, string> = { normal: '100%', large: '112.5%', xlarge: '125%' };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}

export function getTextSize(): TextSize {
  const v = read(SIZE_KEY);
  return v === 'large' || v === 'xlarge' ? v : 'normal';
}

export function getReduceMotion(): boolean {
  return read(MOTION_KEY) === '1';
}

export function applyDisplayPrefs(): void {
  const root = document.documentElement;
  root.style.fontSize = SIZES[getTextSize()];
  root.classList.toggle('reduce-motion', getReduceMotion());
}

export function setTextSize(size: TextSize): void {
  write(SIZE_KEY, size);
  applyDisplayPrefs();
}

export function setReduceMotion(on: boolean): void {
  write(MOTION_KEY, on ? '1' : '0');
  applyDisplayPrefs();
}

/**
 * « Réparer l'application » : vide les caches du navigateur et désinscrit le
 * service worker, puis recharge. Ne touche PAS à la base locale (IndexedDB) :
 * les opérations faites hors ligne et pas encore synchronisées sont conservées.
 */
export async function repairApp(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } finally {
    window.location.reload();
  }
}
