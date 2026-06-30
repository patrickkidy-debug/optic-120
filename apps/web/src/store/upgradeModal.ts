import { create } from 'zustand';
import type { PremiumFeature } from '@oculo/shared-types';

interface UpgradeModalState {
  feature: PremiumFeature | null;
  open: (feature: PremiumFeature) => void;
  close: () => void;
}

/** Déclenchement global de la modale de conversion (appelable depuis n'importe quelle page). */
export const useUpgradeModalStore = create<UpgradeModalState>((set) => ({
  feature: null,
  open: (feature) => set({ feature }),
  close: () => set({ feature: null }),
}));
