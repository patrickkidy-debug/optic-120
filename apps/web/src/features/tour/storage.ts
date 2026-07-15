import type { TourProgress } from './types';

const KEY = 'oculo_tour_v1';

type Store = Record<string, TourProgress>;

/** localStorage peut jeter (mode privé, quota) : la visite ne doit jamais casser l'app. */
function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}

export function getProgress(tourId: string): TourProgress | null {
  return read()[tourId] ?? null;
}

export function saveProgress(tourId: string, patch: Partial<TourProgress>): void {
  const store = read();
  const current: TourProgress = store[tourId] ?? {
    completedVersion: null,
    lastStepIndex: 0,
    skipped: false,
    updatedAt: new Date().toISOString(),
  };
  store[tourId] = { ...current, ...patch, updatedAt: new Date().toISOString() };
  write(store);
}

export function clearProgress(tourId: string): void {
  const store = read();
  delete store[tourId];
  write(store);
}

/**
 * Vrai si la visite a été terminée pour cette version de contenu.
 * Une version supérieure la rend « à revoir » (mise à jour importante).
 */
export function isTourCompleted(tourId: string, version: number): boolean {
  const p = getProgress(tourId);
  return p?.completedVersion != null && p.completedVersion >= version;
}

/** Vrai si l'utilisateur a explicitement ignoré cette version : ne pas relancer seul. */
export function isTourDismissed(tourId: string, version: number): boolean {
  const p = getProgress(tourId);
  return Boolean(p?.skipped) && (p?.completedVersion ?? -1) < version;
}
