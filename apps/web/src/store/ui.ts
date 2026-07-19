import { create } from 'zustand';
import { applyTheme, getStoredTheme, type ThemeMode } from '../lib/theme';
import { resolveLocale, setLocale as applyLocale } from '../lib/i18n';
import type { LocaleCode } from '../lib/locale-resolve';

const BRANCH_KEY = 'oculo_branch';
const LOCALE_KEY = 'oculo_locale';
const HELP_KEY = 'oculo_help_hidden';

interface UIState {
  theme: ThemeMode;
  locale: string;
  sidebarOpen: boolean;
  activeBranchId: string | null;
  supportWidgetHidden: boolean;
  setTheme: (t: ThemeMode) => void;
  setLocale: (l: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setActiveBranch: (id: string | null) => void;
  setSupportWidgetHidden: (hidden: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: getStoredTheme(),
  // Même repli que i18n : une langue inconnue en stockage ne doit pas laisser
  // le sélecteur sans option active alors que l'app affiche du français.
  locale: resolveLocale(window.location.pathname).locale,
  sidebarOpen: false,
  activeBranchId: localStorage.getItem(BRANCH_KEY),
  supportWidgetHidden: localStorage.getItem(HELP_KEY) === '1',
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  setLocale: (locale) => {
    // applyLocale memorise le choix et met a jour <html lang> : ne pas
    // dupliquer l'ecriture localStorage ici.
    void applyLocale(locale as LocaleCode);
    set({ locale });
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  setActiveBranch: (id) => {
    if (id) localStorage.setItem(BRANCH_KEY, id);
    set({ activeBranchId: id });
  },
  setSupportWidgetHidden: (hidden) => {
    localStorage.setItem(HELP_KEY, hidden ? '1' : '0');
    set({ supportWidgetHidden: hidden });
  },
}));
