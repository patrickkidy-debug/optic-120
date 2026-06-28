import { create } from 'zustand';
import type { AuthUser } from '@oculo/shared-types';

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
  setAuth: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  setLocked: (locked) => set({ locked }),
  setSuspended: (suspended) => set({ suspended }),
  clear: () =>
    set({ accessToken: null, user: null, status: 'unauthenticated', locked: false, suspended: false }),
  hasPermission: (perm) => get().user?.permissions.includes(perm) ?? false,
}));

/** Hook utilitaire de vérification de permission pour masquer l'UI. */
export function usePermission(perm: string): boolean {
  return useAuthStore((s) => s.user?.permissions.includes(perm) ?? false);
}
