export type ThemeMode = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'oculo_theme';

export function getStoredTheme(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
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
  localStorage.setItem(STORAGE_KEY, mode);
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
