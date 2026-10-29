export type ThemeMode = 'light' | 'dark' | 'auto';

// Le logiciel s'ouvre TOUJOURS sur la nuit violette de la marque : le choix
// clair / auto ne vaut que pour la session en cours (sessionStorage), il est
// oublié à la fermeture de l'onglet ou de l'application.
const STORAGE_KEY = 'oculo_theme_session';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getStoredTheme(): ThemeMode {
  const v = storage()?.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'dark';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function effectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const eff = effectiveTheme(mode);
  root.classList.remove('light', 'dark');
  root.classList.add(eff);
  root.style.colorScheme = eff;
  storage()?.setItem(STORAGE_KEY, mode);
  // Ancien choix mémorisé durablement : ne doit plus imposer le clair.
  try {
    localStorage.removeItem('oculo_theme');
    localStorage.removeItem('oculo_theme_v2');
  } catch {
    /* stockage indisponible : rien à nettoyer */
  }
}

/** Réagit aux changements système quand le mode est « auto ». */
export function watchSystemTheme(getMode: () => ThemeMode): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getMode() === 'auto') applyTheme('auto');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
