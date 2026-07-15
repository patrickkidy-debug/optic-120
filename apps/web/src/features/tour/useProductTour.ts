import { useContext } from 'react';
import { TourContext, type TourContextValue } from './ProductTourProvider';

/**
 * Accès à la visite guidée depuis n'importe quel écran.
 *
 *   const { startTour, isCompleted } = useProductTour();
 */
export function useProductTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useProductTour doit être utilisé dans <ProductTourProvider>.');
  }
  return ctx;
}

/**
 * Variante tolérante : renvoie null hors du provider au lieu de jeter.
 * Utile pour un bouton présent sur des écrans publics (hors application).
 */
export function useOptionalProductTour(): TourContextValue | null {
  return useContext(TourContext);
}
