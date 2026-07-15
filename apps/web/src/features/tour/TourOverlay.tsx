import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TourPortal } from './TourPortal';
import { Spotlight } from './Spotlight';
import { TourTooltip } from './TourTooltip';
import { useTargetRect } from './useTargetRect';
import { useProductTour } from './useProductTour';

/**
 * Assemble la visite : voile + halo + bulle, et le clavier.
 *
 * Ce module est le seul à importer Framer Motion. Il n'est chargé que lorsqu'une
 * visite démarre (import dynamique dans le provider) : coût nul au premier rendu.
 */
export function TourOverlay() {
  const { steps, stepIndex, stepCount, nextStep, previousStep, endTour, theme } =
    useProductTour();

  const step = steps[stepIndex];
  const { rect, settling, missing } = useTargetRect(step?.target, [stepIndex]);

  // Une cible introuvable ne doit pas bloquer la visite (écran modifié, élément
  // masqué par une permission qu'on n'a pas su prédire) : on enchaîne.
  useEffect(() => {
    if (missing) nextStep();
  }, [missing, nextStep]);

  // Échap quitte, Entrée continue, flèches naviguent.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        endTour('skipped');
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        // Entrée sur un bouton est déjà géré par le navigateur : ne pas doubler.
        if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'BUTTON') return;
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousStep();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nextStep, previousStep, endTour]);

  // Fige le défilement de la page pendant la visite : c'est nous qui pilotons
  // le scroll (auto-centrage). Restauré à la sortie.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!step) return null;

  const padding = step.spotlightPadding ?? theme.spotlightPadding;
  const centered = step.placement === 'center' || !step.target;

  return (
    <TourPortal>
      <AnimatePresence>
        <Spotlight
          key="spotlight"
          rect={centered ? null : rect}
          padding={padding}
          theme={theme}
          interactive={step.interactive}
        />
        {/* On attend la fin du recentrage avant d'afficher la bulle : sinon elle
            se placerait sur une position de cible déjà périmée. */}
        {!settling && (
          <TourTooltip
            key={step.id}
            step={step}
            rect={centered ? null : rect}
            index={stepIndex}
            total={stepCount}
            theme={theme}
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={() => endTour('skipped')}
          />
        )}
      </AnimatePresence>
    </TourPortal>
  );
}
