import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getVideoProgress } from './api';
import { DEMO_VIDEO_COUNT } from './videos';
import { tr } from '../../lib/tr';

/**
 * Point d'entrée vers la démonstration vidéo. Affiché sur le tableau de bord,
 * la page Aide et le profil : le prospect peut reprendre là où il s'est arrêté
 * à tout moment, y compris plusieurs jours après son inscription.
 *
 * `compact` : variante sobre pour les pages secondaires (Aide, Profil).
 * `mini` : simple bouton, pour le tableau de bord où la configuration de la
 * boutique doit rester l'élément mis en avant.
 */
export function WatchDemoCard({ compact = false, mini = false }: { compact?: boolean; mini?: boolean }) {
  const { data } = useQuery({ queryKey: ['demo-video-progress'], queryFn: getVideoProgress });

  const completed = (data ?? []).filter((p) => p.completedAt).length;
  const started = (data ?? []).some((p) => p.maxPercent > 0);
  const allDone = completed >= DEMO_VIDEO_COUNT;
  const globalPercent = data?.length
    ? Math.round(data.reduce((sum, p) => sum + p.maxPercent, 0) / DEMO_VIDEO_COUNT)
    : 0;

  // Bouton discret : reste accessible en permanence, même une fois les vidéos
  // vues, sans jamais concurrencer la carte de configuration.
  if (mini) {
    return (
      <Link to="/demo/videos" className="btn-outline h-9 rounded-xl px-3.5 text-sm">
        <PlayCircle className="h-4 w-4" />
        {allDone
          ? tr('ui.WatchDemoCard.revoirLaDemonstration')
          : started
            ? tr('ui.WatchDemoCard.demonstrationCompletedDemoVideoCount', { completed: completed, DEMO_VIDEO_COUNT: DEMO_VIDEO_COUNT })
            : tr('ui.WatchDemoCard.voirLaDemonstration')}
      </Link>
    );
  }

  if (compact) {
    return (
      <Link
        to="/demo/videos"
        className="card flex items-center gap-3 p-4 transition hover:border-primary hover:shadow-card-md"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          {allDone ? <CheckCircle2 className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-content">{tr('ui.WatchDemoCard.demonstrationDuLogiciel')}</p>
          <p className="text-xs text-content-muted">
            {allDone
              ? tr('ui.WatchDemoCard.revoirLesVideosQuandVous')
              : started
                ? tr('ui.WatchDemoCard.reprendreCompletedDemoVideoCount', { completed: completed, DEMO_VIDEO_COUNT: DEMO_VIDEO_COUNT })
                : tr('ui.WatchDemoCard.demoVideoCountVideosPour', { DEMO_VIDEO_COUNT: DEMO_VIDEO_COUNT })}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-content-faint" />
      </Link>
    );
  }

  // Une fois tout vu, l'encart disparaît du tableau de bord (il reste
  // accessible depuis la page Aide) : on ne re-sollicite pas un client convaincu.
  if (allDone) return null;

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <PlayCircle className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-lg font-bold text-content">
            {started ? tr('ui.WatchDemoCard.reprenezLaDemonstration') : tr('ui.WatchDemoCard.regardezLaDemonstrationDuLogiciel')}
          </p>
          <p className="mt-0.5 text-sm text-content-muted">
            {started
              ? tr('ui.WatchDemoCard.vousEnEtesACompleted', { completed: completed, DEMO_VIDEO_COUNT: DEMO_VIDEO_COUNT, globalPercent: globalPercent })
              : tr('ui.WatchDemoCard.demoVideoCountCourtesVideos', { DEMO_VIDEO_COUNT: DEMO_VIDEO_COUNT })}
          </p>
          {started && (
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand" style={{ width: `${globalPercent}%` }} />
            </div>
          )}
        </div>
      </div>
      <Link to="/demo/videos" className="btn-primary shrink-0 rounded-xl px-6 py-3">
        {started ? tr('ui.WatchDemoCard.reprendre') : tr('ui.WatchDemoCard.regarder')} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
