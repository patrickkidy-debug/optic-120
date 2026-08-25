import { create } from 'zustand';
import type { PartnerAuthUser } from '@oculo/shared-types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface PartnerAuthState {
  accessToken: string | null;
  partner: PartnerAuthUser | null;
  status: Status;
  setAuth: (token: string, partner: PartnerAuthUser) => void;
  setStatus: (status: Status) => void;
  clear: () => void;
}

export const usePartnerAuthStore = create<PartnerAuthState>((set) => ({
  accessToken: null,
  partner: null,
  status: 'loading',
  setAuth: (accessToken, partner) => set({ accessToken, partner, status: 'authenticated' }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, partner: null, status: 'unauthenticated' }),
}));
