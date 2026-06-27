import { create } from 'zustand';
import { applyTheme, getStoredTheme, type ThemeMode } from '../lib/theme';

const BRANCH_KEY = 'oculo_branch';
const LOCALE_KEY = 'oculo_locale';

interface UIState {
  theme: ThemeMode;
  locale: string;
  sidebarOpen: boolean;
  activeBranchId: string | null;
  setTheme: (t: ThemeMode) => void;
  setLocale: (l: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setActiveBranch: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: getStoredTheme(),
  locale: localStorage.getItem(LOCALE_KEY) ?? 'fr',
  sidebarOpen: false,
  activeBranchId: localStorage.getItem(BRANCH_KEY),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  setLocale: (locale) => {
    localStorage.setItem(LOCALE_KEY, locale);
    set({ locale });
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  setActiveBranch: (id) => {
    if (id) localStorage.setItem(BRANCH_KEY, id);
    set({ activeBranchId: id });
  },
}));
