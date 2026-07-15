import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { resolveTour, getTourById } from './registry';
import { isTourCompleted, isTourDismissed, saveProgress, getProgress, clearProgress } from './storage';
import { mergeTheme, type TourTheme } from './theme';
import type { ProductTourApi, TourDefinition, TourStep } from './types';

/**
 * L'habillage visuel (voile, halo, bulle) vit dans un chunk séparé chargé
 * seulement quand une visite démarre : Framer Motion ne pèse donc rien sur le
 * premier rendu de l'application.
 */
const TourOverlay = lazy(() =>
  import('./TourOverlay').then((m) => ({ default: m.TourOverlay })),
);

export interface TourContextValue extends ProductTourApi {
  theme: TourTheme;
  steps: TourStep[];
}

export const TourContext = createContext<TourContextValue | null>(null);

export interface ProductTourProviderProps {
  children: ReactNode;
  /** Surcharge de l'apparence et des libellés. */
  theme?: Partial<TourTheme>;
  /** Lance la visite automatiquement à la première connexion. Défaut : vrai. */
  autoStart?: boolean;
  /** Délai avant l'auto-démarrage (laisse l'écran se peindre), en ms. */
  autoStartDelay?: number;
}

export function ProductTourProvider({
  children,
  theme: themeOverride,
  autoStart = true,
  autoStartDelay = 1200,
}: ProductTourProviderProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [tour, setTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const autoStarted = useRef(false);

  const theme = useMemo(() => mergeTheme(themeOverride), [themeOverride]);

  /** Visite du rôle courant. Le code de rôle est stable, contrairement au libellé. */
  const roleTour = useMemo(() => resolveTour(user?.roleCode), [user?.roleCode]);

  /**
   * Étapes réellement jouables : on retire celles dont la cible n'existera pas
   * (permission absente). Sans ce filtre, le halo pointerait dans le vide.
   */
  const guard = useMemo(
    () => ({
      permissions: new Set(user?.permissions ?? []),
      isPlatformOperator: user?.isPlatformOperator ?? false,
    }),
    [user?.permissions, user?.isPlatformOperator],
  );

  const steps = useMemo(() => {
    if (!tour) return [];
    return tour.steps.filter((s) => {
      if (guard.isPlatformOperator) return true; // l'opérateur voit tout
      return !s.enabled || s.enabled(guard);
    });
  }, [tour, guard]);

  const endTour = useCallback(
    (reason: 'finished' | 'skipped' = 'finished') => {
      setTour((current) => {
        if (current) {
          saveProgress(current.id, {
            lastStepIndex: 0,
            skipped: reason === 'skipped',
            completedVersion: reason === 'finished' ? current.version : null,
          });
        }
        return null;
      });
      setStepIndex(0);
    },
    [],
  );

  const startTour = useCallback(
    (tourId?: string, opts?: { fromStart?: boolean }) => {
      const target = tourId ? getTourById(tourId) ?? roleTour : roleTour;
      const saved = getProgress(target.id);
      const resume =
        !opts?.fromStart && saved && !saved.skipped && saved.completedVersion == null
          ? saved.lastStepIndex
          : 0;
      setTour(target);
      setStepIndex(resume);
    },
    [roleTour],
  );

  const restartTour = useCallback(
    (tourId?: string) => {
      const target = tourId ? getTourById(tourId) ?? roleTour : roleTour;
      clearProgress(target.id);
      setTour(target);
      setStepIndex(0);
    },
    [roleTour],
  );

  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      if (i >= steps.length - 1) {
        endTour('finished');
        return 0;
      }
      return i + 1;
    });
  }, [steps.length, endTour]);

  const previousStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToStep = useCallback(
    (stepId: string) => {
      const idx = steps.findIndex((s) => s.id === stepId);
      if (idx >= 0) setStepIndex(idx);
    },
    [steps],
  );

  const isCompleted = useCallback(
    (tourId?: string) => {
      const target = tourId ? getTourById(tourId) ?? roleTour : roleTour;
      return isTourCompleted(target.id, target.version);
    },
    [roleTour],
  );

  const currentStep = useCallback(
    () => (tour ? steps[stepIndex] ?? null : null),
    [tour, steps, stepIndex],
  );

  // Mémorise la progression pour permettre la reprise.
  useEffect(() => {
    if (tour) saveProgress(tour.id, { lastStepIndex: stepIndex });
  }, [tour, stepIndex]);

  // Une étape peut vivre sur un autre écran : on y navigue avant de l'afficher.
  const step = tour ? steps[stepIndex] : undefined;
  useEffect(() => {
    if (step?.route && location.pathname !== step.route) navigate(step.route);
  }, [step?.route, location.pathname, navigate]);

  // Déclencheur « première connexion » / « mise à jour importante » : la version
  // du contenu ayant changé, isTourCompleted redevient faux et la visite est
  // reproposée — sauf si l'utilisateur l'avait explicitement ignorée.
  useEffect(() => {
    if (!autoStart || !user || autoStarted.current) return;
    if (isTourCompleted(roleTour.id, roleTour.version)) return;
    if (isTourDismissed(roleTour.id, roleTour.version)) return;
    // Le drapeau est posé au déclenchement, PAS à la programmation : sinon un
    // changement de dépendance (ou le double effet de StrictMode) annulerait le
    // minuteur, et le garde-fou empêcherait d'en reprogrammer un — le tour ne
    // démarrerait jamais.
    const t = window.setTimeout(() => {
      autoStarted.current = true;
      startTour();
    }, autoStartDelay);
    return () => window.clearTimeout(t);
  }, [autoStart, user, roleTour, startTour, autoStartDelay]);

  const value = useMemo<TourContextValue>(
    () => ({
      startTour,
      nextStep,
      previousStep,
      goToStep,
      restartTour,
      endTour,
      isCompleted,
      currentStep,
      isRunning: Boolean(tour),
      stepIndex,
      stepCount: steps.length,
      tour,
      theme,
      steps,
    }),
    [
      startTour, nextStep, previousStep, goToStep, restartTour, endTour,
      isCompleted, currentStep, tour, stepIndex, steps, theme,
    ],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && steps.length > 0 && (
        <Suspense fallback={null}>
          <TourOverlay />
        </Suspense>
      )}
    </TourContext.Provider>
  );
}
