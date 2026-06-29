import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { getSubscription } from '../features/billing/api';
import { usePermission } from '../store/auth';

/**
 * Bannière de relance : apparaît pendant l'essai quand il reste ≤ 2 jours
 * (soit dès le 3ᵉ jour d'un essai de 5 jours) pour inciter à s'abonner.
 * Visible uniquement par les comptes pouvant gérer l'abonnement.
 */
export function TrialBanner() {
  const canManage = usePermission('billing.view');
  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    enabled: canManage,
  });

  if (!sub || sub.status !== 'TRIALING' || !sub.trialEndsAt) return null;

  const msLeft = new Date(sub.trialEndsAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  if (daysLeft > 2) return null; // relance seulement dans les 2 derniers jours

  const label =
    daysLeft <= 0
      ? "Votre essai se termine aujourd'hui"
      : `Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai`;

  return (
    <div className="border-b border-accent/30 bg-accent-soft">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-2.5 sm:flex-row sm:px-6">
        <p className="flex items-center gap-2 text-sm font-medium text-content">
          <Clock className="h-4 w-4 text-accent" />
          {label} — abonnez-vous pour conserver l'accès à votre espace.
        </p>
        <Link
          to="/parametres/abonnement"
          className="btn-accent h-8 shrink-0 rounded-lg px-3 text-xs"
        >
          S'abonner maintenant <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
