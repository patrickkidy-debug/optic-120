import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getPlanStatus } from '../features/billing/api';

/**
 * Bandeau d'essai gratuit : pendant les 2 h offertes à l'inscription (accès
 * complet au dashboard), affiche le temps restant et incite à activer
 * l'abonnement. Disparaît dès que l'essai est terminé (l'app bascule alors sur
 * l'écran d'abonnement via la réponse 402 du serveur).
 */
export function TrialBanner() {
  const { data } = useQuery({
    queryKey: ['plan-status'],
    queryFn: getPlanStatus,
    refetchInterval: 60_000,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!data || data.status !== 'TRIALING' || !data.trialEndsAt) return null;
  const remaining = new Date(data.trialEndsAt).getTime() - now;
  if (remaining <= 0) return null;

  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const label = hours > 0 ? `${hours} h ${mins.toString().padStart(2, '0')} min` : `${mins} min`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary-soft px-4 py-2 text-sm sm:px-6">
      <div className="flex items-center gap-2 text-content">
        <Clock className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Essai gratuit — il vous reste <b>{label}</b> d'accès complet. Activez votre abonnement pour
          continuer sans interruption.
        </span>
      </div>
      <Link to="/parametres/abonnement" className="btn-primary h-8 shrink-0 rounded-lg px-3 text-xs">
        Activer l'abonnement
      </Link>
    </div>
  );
}
