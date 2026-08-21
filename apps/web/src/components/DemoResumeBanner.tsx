import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useProductTour } from '../features/tour/useProductTour';
import { getDemoProgress, type DemoProgress } from '../features/tour/api';
import { Button } from './ui';

/**
 * Utilisateur revenant après avoir quitté la visite guidée en cours de route
 * (nouvelle inscription ou ancien tenant démo) : "Vous étiez arrivé à l'étape
 * X. Continuer / Recommencer / Passer à l'abonnement ?" — la visite ne
 * redémarre jamais automatiquement dans ce cas (voir ProductTourProvider),
 * c'est ce bandeau qui pilote la reprise.
 */
export function DemoResumeBanner() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { startTour, restartTour, tour } = useProductTour();
  const [progress, setProgress] = useState<DemoProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDemoProgress()
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || dismissed || tour) return null;
  if (!progress || !progress.currentStepId || progress.completedAt) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Compass className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display font-bold text-content">Vous étiez en train de découvrir OculoSaaS</p>
          <p className="mt-0.5 text-sm text-content-muted">
            Reprenez la visite où vous l'aviez laissée, ou passez directement au choix de votre abonnement.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setDismissed(true);
            restartTour();
          }}
        >
          Recommencer
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDismissed(true);
            navigate('/onboarding/complete');
          }}
        >
          Passer à l'abonnement
        </Button>
        <Button
          onClick={() => {
            setDismissed(true);
            startTour(undefined, { resumeStepId: progress?.currentStepId ?? undefined });
          }}
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}
