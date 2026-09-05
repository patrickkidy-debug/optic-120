import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import type { BillingCycle } from '@oculo/shared-types';

const PLANS = ['STARTER', 'STANDARD', 'GROWTH'] as const;
const CYCLES: BillingCycle[] = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL'];

/**
 * Lien d'activation à partager (WhatsApp, email) : oculosaas.com/activer.
 *
 * Une seule adresse à donner à un prospect, qu'il ait déjà un compte ou non :
 * - déjà connecté → page Abonnement, qui lance aussitôt le paiement Moneroo ;
 * - sinon → inscription, puis le même paiement enchaîné via ?next=.
 *
 * L'offre et le cycle se choisissent dans l'URL (?plan=GROWTH&cycle=SEMIANNUAL) ;
 * sans précision, Standard mensuel — l'offre recommandée.
 */
export function ActivateSubscriptionPage() {
  const [params] = useSearchParams();
  const status = useAuthStore((s) => s.status);

  const rawPlan = (params.get('plan') ?? '').toUpperCase();
  const plan = (PLANS as readonly string[]).includes(rawPlan) ? rawPlan : 'STANDARD';
  const rawCycle = (params.get('cycle') ?? '').toUpperCase() as BillingCycle;
  const cycle = CYCLES.includes(rawCycle) ? rawCycle : 'MONTHLY';

  const pay = `/parametres/abonnement?plan=${plan}&cycle=${cycle}`;

  // Tant que la session se rétablit (rafraîchissement du jeton au chargement),
  // on attend : rediriger trop tôt enverrait un client déjà inscrit s'inscrire
  // à nouveau.
  if (status === 'loading') {
    return <div className="grid min-h-screen place-items-center text-sm text-content-muted">Chargement…</div>;
  }

  if (status === 'authenticated') return <Navigate to={pay} replace />;

  return (
    <Navigate to={`/signup?plan=${plan}&cycle=${cycle}&next=${encodeURIComponent(pay)}`} replace />
  );
}
