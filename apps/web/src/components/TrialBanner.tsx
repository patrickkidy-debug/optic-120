import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Zap } from 'lucide-react';
import { useSubscriptionPlan } from '../features/billing/useSubscriptionPlan';
import { usePermission } from '../store/auth';

interface Tier {
  tone: 'info' | 'warning' | 'danger';
  message: string;
  showCountdown: boolean;
}

/** Palier d'urgence progressif, calé sur l'essai 5 jours (J-7/J-3/J-1/J0 adaptés). */
function tierFor(daysLeft: number): Tier {
  if (daysLeft <= 0) {
    return { tone: 'danger', message: 'Votre compte est suspendu jusqu’à l’activation d’un abonnement.', showCountdown: true };
  }
  if (daysLeft === 1) {
    return { tone: 'danger', message: 'Dernière journée avant suspension.', showCountdown: true };
  }
  if (daysLeft <= 3) {
    return { tone: 'warning', message: 'Votre accès premium expire bientôt.', showCountdown: false };
  }
  return { tone: 'info', message: 'Votre essai vient de commencer.', showCountdown: false };
}

const TONE_CLASSES: Record<Tier['tone'], { bg: string; border: string; text: string; icon: string }> = {
  info: { bg: 'bg-accent-soft', border: 'border-accent/30', text: 'text-accent', icon: 'text-accent' },
  warning: {
    bg: 'bg-[color:var(--warning)]/12',
    border: 'border-[color:var(--warning)]/30',
    text: 'text-content',
    icon: 'text-[color:var(--warning)]',
  },
  danger: {
    bg: 'bg-[color:var(--danger)]/12',
    border: 'border-[color:var(--danger)]/30',
    text: 'text-content',
    icon: 'text-danger',
  },
};

function useCountdown(target: Date | null, enabled: boolean): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || !target) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [enabled, target]);
  if (!enabled || !target) return null;
  const ms = Math.max(0, target.getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Badge d'essai permanent : visible par tout le personnel dès le 1er jour
 * (pas seulement les gérants), avec urgence progressive et compte à rebours
 * le dernier jour. Disparaît une fois l'abonnement actif.
 */
export function TrialBanner() {
  const { status, isTrial } = useSubscriptionPlan();
  const canManage = usePermission('billing.manage');

  const trialEndsAt = status?.trialEndsAt ? new Date(status.trialEndsAt) : null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const tier = daysLeft != null ? tierFor(daysLeft) : null;
  const countdown = useCountdown(trialEndsAt, !!tier?.showCountdown);

  if (!isTrial || status?.status !== 'TRIALING' || !trialEndsAt || !tier) return null;

  const classes = TONE_CLASSES[tier.tone];

  return (
    <div className={`border-b ${classes.border} ${classes.bg}`}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-2.5 sm:flex-row sm:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-bold ${classes.text}`}>
            <Clock className={`h-3.5 w-3.5 ${classes.icon}`} />
            {daysLeft! > 0 ? `J-${daysLeft}` : 'Expiré'}
          </span>
          <p className="text-sm font-medium text-content">
            {tier.message}{' '}
            {canManage && (
              <span className="text-content-muted">
                Activez le plan Standard (12 000 FCFA/mois) pour éviter toute interruption.
              </span>
            )}
          </p>
          {countdown && (
            <span className="rounded-lg bg-surface px-2 py-1 font-mono text-xs font-bold text-danger">
              ⏱ {countdown}
            </span>
          )}
        </div>
        {canManage ? (
          <Link
            to="/parametres/abonnement?plan=STANDARD"
            className="btn-accent h-8 shrink-0 rounded-lg px-3 text-xs"
          >
            <Zap className="h-3.5 w-3.5" /> Activer mon abonnement
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-content-faint">Demandez à votre administrateur de s'abonner.</span>
        )}
      </div>
    </div>
  );
}
