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
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { resolveTour, getTourById } from './registry';
import { isTourCompleted, isTourDismissed, saveProgress, getProgress, clearProgress } from './storage';
import { mergeTheme, type TourTheme } from './theme';
import { useSpeechNarration } from './useSpeechNarration';
import { getDemoProgress, saveDemoProgress, trackDemoEvent } from './api';
import type { ProductTourApi, TourDefinition, TourStep } from './types';

const DEMO_TOUR_ID = 'demo-onboarding';

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
  narration: ReturnType<typeof useSpeechNarration>;
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
  const { i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setSidebar = useUIStore((s) => s.setSidebar);
  const navigate = useNavigate();
  const location = useLocation();
  const narration = useSpeechNarration();

  const [tour, setTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [actionCompleted, setActionCompleted] = useState(true);
  const autoStarted = useRef(false);

  const theme = useMemo(() => mergeTheme(themeOverride), [themeOverride]);

  /**
   * Visite du rôle courant — ou visite démo dédiée si l'établissement est
   * démo (l'admin démo a le rôle "admin" comme n'importe quel admin réel).
   */
  const roleTour = useMemo(
    () => resolveTour(user?.roleCode, user?.tenantIsDemo),
    [user?.roleCode, user?.tenantIsDemo],
  );

  /**
   * Étapes réellement jouables : on retire celles dont la cible n'existera pas
   * (permission absente). Sans ce filtre, le halo pointerait dans le vide.
   */
  const guard = useMemo(
    () => ({
      permissions: new Set(user?.permissions ?? []),
      isPlatformOperator: user?.isPlatformOperator ?? false,
      isDemo: user?.tenantIsDemo ?? false,
    }),
    [user?.permissions, user?.isPlatformOperator, user?.tenantIsDemo],
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
            skippedVersion: reason === 'skipped' ? current.version : undefined,
            completedVersion: reason === 'finished' ? current.version : null,
          });
          // Progression serveur pour TOUTE visite (pas seulement l'ancien tenant
          // démo) : permet la reprise cross-appareil et déclenche côté serveur
          // l'effacement des données d'exemple pré-remplies à l'inscription.
          trackDemoEvent(reason === 'finished' ? 'demo_completed' : 'demo_abandoned');
          void saveDemoProgress({
            currentStepId: null,
            completedAt: reason === 'finished' ? new Date().toISOString() : null,
            skipped: reason === 'skipped',
          });
          // Une visite terminée débouche toujours sur le choix d'un abonnement.
          // Un "Passer" repasse juste à zéro en silence — l'utilisateur explore.
          if (reason === 'finished') navigate('/onboarding/complete');
        }
        return null;
      });
      narration.stop();
      setStepIndex(0);
      setSidebar(false);
    },
    [navigate, narration, setSidebar],
  );

  /**
   * Narre une étape d'une visite donnée (pas forcément la visite en cours dans
   * le state — utile depuis startTour/restartTour où `tour` n'est pas encore
   * mis à jour au moment de l'appel). Sans effet si appelé hors d'un geste
   * utilisateur réel (voir narration.speak).
   */
  const speakStepOf = useCallback(
    (tourDef: TourDefinition, target: TourStep | undefined) => {
      if (tourDef.narrate && target?.content) narration.speak(target.content, i18n.language);
    },
    [narration, i18n.language],
  );

  const startTour = useCallback(
    (tourId?: string, opts?: { fromStart?: boolean; resumeStepId?: string }) => {
      const target = tourId ? getTourById(tourId) ?? roleTour : roleTour;
      let resume = 0;
      if (opts?.resumeStepId) {
        // Reprise pilotée par la progression serveur (visite démo, autre appareil) :
        // évite la course entre startTour (async React state) et un goToStep séparé.
        const idx = target.steps.findIndex((s) => s.id === opts.resumeStepId);
        if (idx >= 0) resume = idx;
      } else if (!opts?.fromStart) {
        const saved = getProgress(target.id);
        resume = saved && !saved.skipped && saved.completedVersion == null ? saved.lastStepIndex : 0;
      }
      setTour(target);
      setStepIndex(resume);
      // Narre immédiatement SI cet appel vient d'un vrai clic (reprise manuelle,
      // bouton "relancer la visite") ; silencieux et sans risque si c'est le
      // minuteur d'auto-démarrage (pas de geste — le navigateur bloquera de
      // toute façon, l'utilisateur peut toujours taper "Réécouter").
      speakStepOf(target, target.steps[resume]);
      if (target.id === DEMO_TOUR_ID) trackDemoEvent('demo_started');
    },
    [roleTour, speakStepOf],
  );

  const restartTour = useCallback(
    (tourId?: string) => {
      const target = tourId ? getTourById(tourId) ?? roleTour : roleTour;
      clearProgress(target.id);
      setTour(target);
      setStepIndex(0);
      speakStepOf(target, target.steps[0]);
    },
    [roleTour, speakStepOf],
  );

  /**
   * Narre l'étape ciblée — appelé UNIQUEMENT de façon synchrone depuis un vrai
   * geste utilisateur (clic Suivant/Précédent, touche clavier). Safari iOS (et
   * la plupart des navigateurs mobiles) bloque silencieusement `speechSynthesis`
   * hors d'un geste réel : un déclenchement passif (useEffect après l'ouverture
   * automatique de la visite) ne fonctionne quasiment jamais sur téléphone.
   */
  const narrateStep = useCallback(
    (target: TourStep | undefined) => {
      if (tour) speakStepOf(tour, target);
    },
    [tour, speakStepOf],
  );

  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      const next = i + 1;
      if (next >= steps.length) {
        endTour('finished');
        return 0;
      }
      narrateStep(steps[next]);
      return next;
    });
  }, [steps, endTour, narrateStep]);

  const previousStep = useCallback(() => {
    setStepIndex((i) => {
      const prev = Math.max(0, i - 1);
      narrateStep(steps[prev]);
      return prev;
    });
  }, [steps, narrateStep]);

  const goToStep = useCallback(
    (stepId: string) => {
      const idx = steps.findIndex((s) => s.id === stepId);
      if (idx >= 0) {
        narrateStep(steps[idx]);
        setStepIndex(idx);
      }
    },
    [steps, narrateStep],
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

  const step = tour ? steps[stepIndex] : undefined;

  // Mémorise la progression pour permettre la reprise (localStorage toujours ;
  // en plus côté serveur pour la visite démo, qui doit survivre à un changement
  // d'appareil — voir DemoResumeBanner).
  useEffect(() => {
    if (!tour) return;
    saveProgress(tour.id, { lastStepIndex: stepIndex });
    void saveDemoProgress({ currentStepId: step?.id ?? null });
  }, [tour, stepIndex, step?.id]);

  // Une étape peut demander une action ("essayez de rechercher…") : le bouton
  // Suivant reste désactivé tant que la page cible n'a pas signalé l'action.
  useEffect(() => {
    setActionCompleted(!step?.awaitAction);
  }, [step]);
  useEffect(() => {
    if (!step?.awaitAction) return;
    const expected = step.awaitAction.event;
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<{ event?: string }>).detail;
      if (detail?.event === expected) setActionCompleted(true);
    };
    window.addEventListener('oculo-tour-action', onAction);
    return () => window.removeEventListener('oculo-tour-action', onAction);
  }, [step]);

  // Une étape peut vivre sur un autre écran : on y navigue avant de l'afficher.
  useEffect(() => {
    if (step?.route && location.pathname !== step.route) navigate(step.route);
  }, [step?.route, location.pathname, navigate]);

  // Sur mobile, la barre latérale est un tiroir fermé par défaut (masqué hors
  // écran par transform, pas par display:none — voir queryVisible dans
  // useTargetRect.ts). Une étape qui cible un lien de nav (`nav:<route>`) ou
  // la barre elle-même n'a donc RIEN à montrer tant qu'on ne l'ouvre pas
  // nous-mêmes : c'est ce qui rendait ces étapes invisibles ("reste caché") sur
  // téléphone. On l'ouvre pour ces étapes précisément, et on la referme sinon
  // pour ne pas cacher le contenu de page des étapes suivantes.
  useEffect(() => {
    if (!tour) return;
    const isSidebarStep = step?.target === '[data-tour="sidebar"]' || step?.target?.includes('data-tour="nav:');
    setSidebar(Boolean(isSidebarStep));
  }, [tour, step, setSidebar]);

  // Déclencheur « première connexion » / « mise à jour importante » : la version
  // du contenu ayant changé, isTourCompleted redevient faux et la visite est
  // reproposée — sauf si l'utilisateur l'avait explicitement ignorée. Si une
  // progression serveur existe déjà (visite laissée en cours, sur cet appareil
  // ou un autre), on NE relance PAS automatiquement : c'est DemoResumeBanner
  // qui propose Continuer / Recommencer / Passer à l'abonnement.
  useEffect(() => {
    if (!autoStart || !user || autoStarted.current) return;
    if (isTourCompleted(roleTour.id, roleTour.version)) return;
    if (isTourDismissed(roleTour.id, roleTour.version)) return;
    let cancelled = false;
    async function schedule() {
      const progress = await getDemoProgress().catch(() => null);
      if (progress && (progress.currentStepId || progress.skipped)) return; // repris via la bannière
      if (cancelled) return;
      // Le drapeau est posé au déclenchement, PAS à la programmation : sinon un
      // changement de dépendance (ou le double effet de StrictMode) annulerait le
      // minuteur, et le garde-fou empêcherait d'en reprogrammer un — le tour ne
      // démarrerait jamais.
      window.setTimeout(() => {
        if (cancelled) return;
        autoStarted.current = true;
        startTour();
      }, autoStartDelay);
    }
    void schedule();
    return () => {
      cancelled = true;
    };
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
      actionCompleted,
      narration,
      stepIndex,
      stepCount: steps.length,
      tour,
      theme,
      steps,
    }),
    [
      startTour, nextStep, previousStep, goToStep, restartTour, endTour,
      isCompleted, currentStep, tour, stepIndex, steps, theme, actionCompleted, narration,
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
