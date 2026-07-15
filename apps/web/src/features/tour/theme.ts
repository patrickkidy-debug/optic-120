import type { Transition } from 'framer-motion';

/**
 * Personnalisation du système de visite : couleurs, animations, libellés,
 * rayons. Surchargeable via la prop `theme` de <ProductTourProvider> — sans
 * toucher au cœur.
 */
export interface TourTheme {
  /** Opacité du voile sombre (0 → 1). */
  overlayOpacity: number;
  /** Couleur de l'anneau du halo. Défaut : la couleur primaire du thème. */
  ringColor: string;
  ringWidth: number;
  /** Rayon des coins du halo, en pixels. */
  spotlightRadius: number;
  spotlightPadding: number;
  /** Transition du halo quand il passe d'une cible à l'autre. */
  spotlightTransition: Transition;
  tooltipTransition: Transition;
  labels: {
    next: string;
    previous: string;
    skip: string;
    finish: string;
    stepOf: (current: number, total: number) => string;
    close: string;
  };
}

export const DEFAULT_TOUR_THEME: TourTheme = {
  overlayOpacity: 0.62,
  ringColor: 'var(--primary)',
  ringWidth: 2,
  spotlightRadius: 12,
  spotlightPadding: 8,
  // Ressort : le halo « atterrit » sur la cible sans rebond sec.
  spotlightTransition: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
  tooltipTransition: { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 },
  labels: {
    next: 'Suivant',
    previous: 'Précédent',
    skip: 'Ignorer',
    finish: 'Terminer',
    stepOf: (c, t) => `Étape ${c} / ${t}`,
    close: 'Quitter la visite',
  },
};

export function mergeTheme(override?: Partial<TourTheme>): TourTheme {
  if (!override) return DEFAULT_TOUR_THEME;
  return {
    ...DEFAULT_TOUR_THEME,
    ...override,
    labels: { ...DEFAULT_TOUR_THEME.labels, ...override.labels },
  };
}
