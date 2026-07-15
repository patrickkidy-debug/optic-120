import { Compass, RotateCcw, Play } from 'lucide-react';
import { useProductTour } from './useProductTour';
import { Button } from '../../components/ui';

/**
 * Point d'entrée manuel de la visite guidée. À poser dans Réglages et dans
 * Aide & support. Propose « Reprendre » si une visite a été laissée en cours.
 */
export function RestartTourCard() {
  const { restartTour, startTour, isCompleted, tour, isRunning } = useProductTour();
  const done = isCompleted();

  return (
    <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Compass className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-content">Visite guidée</h3>
          <p className="mt-0.5 text-sm text-content-muted">
            {done
              ? 'Vous avez terminé la visite. Vous pouvez la revoir quand vous voulez.'
              : "Un tour rapide des écrans adaptés à votre rôle. Environ deux minutes."}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        {!done && !isRunning && (
          <Button variant="outline" onClick={() => startTour()}>
            <Play className="h-4 w-4" /> Reprendre
          </Button>
        )}
        <Button onClick={() => restartTour()} disabled={isRunning}>
          <RotateCcw className="h-4 w-4" />
          {done ? 'Revoir la visite' : 'Depuis le début'}
        </Button>
      </div>
    </div>
  );
}

export default RestartTourCard;
