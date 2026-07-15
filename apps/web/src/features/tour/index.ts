/**
 * Visite guidée (Interactive Product Tour) — API publique.
 *
 * Mise en place (déjà faite dans AppShell) :
 *   <ProductTourProvider><App /></ProductTourProvider>
 *
 * Utilisation :
 *   const { startTour, restartTour, isCompleted } = useProductTour();
 *
 * Ajouter une étape : poser `data-tour="mon-ancre"` sur l'élément visé, puis
 * ajouter l'étape dans `registry.ts`. Le cœur n'a pas à être modifié.
 */
export { ProductTourProvider } from './ProductTourProvider';
export { useProductTour, useOptionalProductTour } from './useProductTour';
export { RestartTourCard } from './RestartTourCard';
export { TourOverlay } from './TourOverlay';
export { TourTooltip } from './TourTooltip';
export { TourProgress } from './TourProgress';
export { TourControls } from './TourControls';
export { Spotlight } from './Spotlight';
export { TourPortal } from './TourPortal';
export { TOURS, resolveTour, getTourById } from './registry';
export { DEFAULT_TOUR_THEME, mergeTheme } from './theme';
export type { TourTheme } from './theme';
export type {
  TourStep,
  TourDefinition,
  TourPlacement,
  TourProgress as TourProgressState,
  ProductTourApi,
} from './types';
