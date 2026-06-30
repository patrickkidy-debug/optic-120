import { Link } from 'react-router-dom';
import { Clock, Zap } from 'lucide-react';
import { useSubscriptionPlan } from '../features/billing/useSubscriptionPlan';
import { usePermission } from '../store/auth';

const TRIAL_TOTAL_DAYS = 5;

/**
 * Carte de suivi de l'essai gratuit affichée en haut du tableau de bord :
 * jours restants, barre de progression, et CTA d'activation. Distincte de
 * TrialBanner (bandeau global) — ici visible directement dans le contenu
 * du dashboard, pas seulement en haut de page.
 */
export function TrialCountdownCard() {
  const { status, isTrial } = useSubscriptionPlan();
  const canManage = usePermission('billing.manage');

  if (!isTrial || status?.status !== 'TRIALING' || !status.trialEndsAt) return null;

  const trialEndsAt = new Date(status.trialEndsAt);
  const msLeft = trialEndsAt.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const hoursLeft = Math.max(0, Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
  const pct = Math.min(100, Math.max(0, ((TRIAL_TOTAL_DAYS - daysLeft) / TRIAL_TOTAL_DAYS) * 100));
  const urgent = daysLeft <= 1;

  return (
    <div
      className={`mb-6 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
        urgent ? 'border-[color:var(--danger)]/30 bg-[color:var(--danger)]/8' : 'border-primary/25 bg-primary-soft'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
            urgent ? 'bg-danger/15 text-danger' : 'bg-primary/15 text-primary'
          }`}
        >
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display font-bold text-content">
            {daysLeft > 0
              ? `Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''}${hoursLeft > 0 ? ` et ${hoursLeft} h` : ''} d'essai gratuit`
              : "Votre essai gratuit se termine aujourd'hui"}
          </p>
          <p className="mt-0.5 text-xs text-content-muted">
            Offre Découverte — {TRIAL_TOTAL_DAYS} jours au total. Passez au plan Standard pour ne pas
            perdre l'accès à votre espace.
          </p>
          <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-surface-3">
            <div
              className={`h-full rounded-full transition-all ${urgent ? 'bg-danger' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      {canManage && (
        <Link to="/parametres/abonnement?plan=STANDARD" className="btn-primary h-9 shrink-0 px-4 text-sm">
          <Zap className="h-4 w-4" /> Activer mon abonnement
        </Link>
      )}
    </div>
  );
}
