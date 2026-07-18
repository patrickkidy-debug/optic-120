import { create } from 'zustand';
import type { AuthUser } from '@oculo/shared-types';
import { setActiveCurrency } from '../lib/format';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  locked: boolean;
  suspended: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  setStatus: (s: AuthStatus) => void;
  setLocked: (v: boolean) => void;
  setSuspended: (v: boolean) => void;
  clear: () => void;
  hasPermission: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  status: 'loading',
  locked: false,
  suspended: false,
  setAuth: (accessToken, user) => {
    // Fixe la devise d'affichage (FCFA, escudo, kwanza, metical) pour toute la session.
    setActiveCurrency(user.tenantCurrency);
    set({ accessToken, user, status: 'authenticated' });
  },
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  setLocked: (locked) => set({ locked }),
  setSuspended: (suspended) => set({ suspended }),
  clear: () =>
    set({ accessToken: null, user: null, status: 'unauthenticated', locked: false, suspended: false }),
  // Le fondateur / opérateur plateforme n'a aucune restriction : toutes permissions accordées.
  hasPermission: (perm) => {
    const u = get().user;
    return !!u && (u.isPlatformOperator || u.permissions.includes(perm));
  },
}));

/** Hook utilitaire de vérification de permission pour masquer l'UI. */
export function usePermission(perm: string): boolean {
  return useAuthStore((s) => !!s.user && (s.user.isPlatformOperator || s.user.permissions.includes(perm)));
}
