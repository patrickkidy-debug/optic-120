import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ShieldCheck, Sparkles, Video } from 'lucide-react';
import clsx from 'clsx';
import {
  PLAN_CATALOG,
  BILLING_CYCLE_MONTHS,
  BILLING_CYCLE_DISCOUNT,
  type BillingCycle,
} from '@oculo/shared-types';
import { useAuthStore } from '../../store/auth';
import { Logo } from '../../components/Logo';

const CYCLES: BillingCycle[] = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL'];

function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

/**
 * Page d'activation partagée aux prospects (WhatsApp) : oculosaas.com/activer.
 *
 * Elle présente les offres et laisse le prospect choisir, plutôt que de le
 * précipiter vers un paiement qu'il n'a pas choisi. Le bouton mène ensuite :
 * - client déjà connecté → page Abonnement, qui lance le paiement Moneroo ;
 * - visiteur → inscription, puis ce même paiement enchaîné via ?next=.
 *
 * ?plan= et ?cycle= pré-sélectionnent seulement l'affichage : le prospect
 * garde la main.
 */
export function ActivateSubscriptionPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const status = useAuthStore((s) => s.status);

  const rawCycle = (params.get('cycle') ?? '').toUpperCase() as BillingCycle;
  const [cycle, setCycle] = useState<BillingCycle>(CYCLES.includes(rawCycle) ? rawCycle : 'MONTHLY');

  const rawPlan = (params.get('plan') ?? '').toUpperCase();
  const suggested = PLAN_CATALOG.some((p) => p.code === rawPlan) ? rawPlan : 'STANDARD';

  /** Destination du bouton : paiement direct si déjà connecté, sinon inscription puis paiement. */
  function activateHref(planCode: string): string {
    const pay = `/parametres/abonnement?plan=${planCode}&cycle=${cycle}`;
    if (status === 'authenticated') return pay;
    return `/signup?plan=${planCode}&cycle=${cycle}&next=${encodeURIComponent(pay)}`;
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-10 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Activation de votre abonnement
          </span>
          <h1 className="mt-4 text-balance font-display text-3xl font-extrabold text-content sm:text-4xl">
            Choisissez l'offre qui correspond à votre boutique
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-content-muted">
            Activez votre abonnement en quelques minutes par Mobile Money. Nous configurons ensuite
            votre boutique ensemble, en visioconférence.
          </p>
        </div>

        {/* Cycle de facturation : payer plusieurs mois d'avance donne une remise. */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-1 rounded-2xl border bg-surface-2 p-1">
            {CYCLES.map((c) => {
              const active = cycle === c;
              const label =
                c === 'MONTHLY' ? 'Mensuel' : c === 'QUARTERLY' ? '3 mois' : '6 mois';
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition',
                    active ? 'bg-brand text-white shadow-card' : 'text-content-muted hover:text-content',
                  )}
                >
                  {label}
                  {c !== 'MONTHLY' && (
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                        active ? 'bg-white/20 text-white' : 'bg-success/15 text-success',
                      )}
                    >
                      −{Math.round(BILLING_CYCLE_DISCOUNT[c] * 100)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-3">
          {PLAN_CATALOG.map((plan) => {
            const highlighted = plan.code === suggested;
            const months = BILLING_CYCLE_MONTHS[cycle];
            const total = Math.round(plan.priceMonthly * months * (1 - BILLING_CYCLE_DISCOUNT[cycle]));
            const savings = plan.priceMonthly * months - total;
            return (
              <div
                key={plan.code}
                className={clsx(
                  'card relative flex h-full flex-col gap-5 p-6',
                  highlighted && 'border-2 border-primary shadow-glow',
                )}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-card">
                    Recommandé
                  </span>
                )}
                <div>
                  <p
                    className={clsx(
                      'text-sm font-semibold uppercase tracking-wide',
                      highlighted ? 'text-primary' : 'text-content-muted',
                    )}
                  >
                    {plan.name}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-extrabold text-content">
                      {formatPrice(total)}
                    </span>
                    <span className="text-sm text-content-muted">
                      FCFA {cycle === 'MONTHLY' ? '/ mois' : cycle === 'QUARTERLY' ? '/ 3 mois' : '/ 6 mois'}
                    </span>
                  </div>
                  {cycle !== 'MONTHLY' && (
                    <>
                      <p className="mt-1 text-sm text-content-muted">
                        ≈ {formatPrice(Math.round(total / months))} FCFA / mois
                      </p>
                      <p className="mt-1.5 inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                        Vous économisez {formatPrice(savings)} FCFA
                      </p>
                    </>
                  )}
                </div>

                <p className="min-h-[40px] text-sm text-content-muted">{plan.description}</p>

                <ul className="flex flex-1 flex-col gap-2.5">
                  {(t(`planFeatures.${plan.code}`, { returnObjects: true }) as string[]).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-content-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to={activateHref(plan.code)}
                  className={clsx(
                    'w-full rounded-xl py-3.5 text-center',
                    highlighted ? 'btn-primary' : 'btn-outline',
                  )}
                >
                  Activer {plan.name}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border bg-surface-2/60 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-content-muted">
              Paiement sécurisé par Mobile Money. Votre accès s'ouvre dès la confirmation.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border bg-surface-2/60 p-4">
            <Video className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-content-muted">
              Configuration de votre boutique accompagnée en visioconférence, juste après.
            </p>
          </div>
        </div>

        {status !== 'authenticated' && (
          <p className="mt-8 text-center text-sm text-content-muted">
            Vous avez déjà un compte ?{' '}
            <Link
              to={`/login?next=${encodeURIComponent(`/parametres/abonnement?plan=${suggested}&cycle=${cycle}`)}`}
              className="font-semibold text-primary hover:underline"
            >
              Se connecter
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
