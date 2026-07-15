import type { LucideIcon } from 'lucide-react';

/** Côté où la bulle se place par rapport à la cible. `auto` = choisi à l'exécution. */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';

/**
 * Une étape de visite.
 *
 * La cible est désignée par un sélecteur CSS — en pratique un attribut
 * `data-tour="…"` posé sur l'élément. On passe par le DOM (et non par des refs)
 * pour qu'une étape puisse viser n'importe quel écran sans que celui-ci ait à
 * connaître le système de visite : c'est ce qui rend le tout extensible.
 */
export interface TourStep {
  /** Identifiant stable, unique dans la visite. Sert aussi à `goToStep`. */
  id: string;
  /** Sélecteur de la cible. Absent = étape « plein écran » (message centré). */
  target?: string;
  title: string;
  content: string;
  icon?: LucideIcon;
  placement?: TourPlacement;
  /** Route à ouvrir avant d'afficher l'étape (la cible vit sur cet écran). */
  route?: string;
  /** Marge du halo autour de la cible, en pixels. */
  spotlightPadding?: number;
  /** Laisse l'utilisateur cliquer la cible (étape « fais-le toi-même »). */
  interactive?: boolean;
  /**
   * Étape ignorée si la fonction renvoie faux — permission manquante, écran
   * absent de l'offre… Évite de pointer un élément qui n'existe pas.
   */
  enabled?: (ctx: TourGuardContext) => boolean;
}

export interface TourGuardContext {
  permissions: ReadonlySet<string>;
  isPlatformOperator: boolean;
}

export interface TourDefinition {
  id: string;
  label: string;
  /** Codes de rôles concernés. `['*']` = repli pour tout rôle non couvert. */
  roles: string[];
  /**
   * Version du contenu. L'incrémenter re-propose la visite aux utilisateurs
   * qui l'avaient déjà terminée (déclencheur « mise à jour importante »).
   */
  version: number;
  steps: TourStep[];
}

/** État persisté (localStorage), par visite. */
export interface TourProgress {
  completedVersion: number | null;
  lastStepIndex: number;
  skipped: boolean;
  updatedAt: string;
}

/** API publique exposée par `useProductTour()`. */
export interface ProductTourApi {
  startTour: (tourId?: string, opts?: { fromStart?: boolean }) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (stepId: string) => void;
  restartTour: (tourId?: string) => void;
  endTour: (reason?: 'finished' | 'skipped') => void;
  isCompleted: (tourId?: string) => boolean;
  /** Étape courante, ou null si aucune visite en cours. */
  currentStep: () => TourStep | null;
  isRunning: boolean;
  stepIndex: number;
  stepCount: number;
  tour: TourDefinition | null;
}
