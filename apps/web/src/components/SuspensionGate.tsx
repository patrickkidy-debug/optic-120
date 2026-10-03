import { lazy, Suspense } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Logo } from './Logo';
import { usePermission } from '../store/auth';
import { logout } from '../features/auth/api';
import { PageLoader } from './ui';
import { named } from '../lib/lazyChunk';
import { WatchDemoCard } from '../features/demo/WatchDemoCard';
import { tr } from '../lib/tr';

const SubscriptionPage = lazy(() => named(import('../pages/settings/SubscriptionPage'), 'SubscriptionPage'));

/**
 * Écran affiché tant que l'abonnement n'est pas payé : accès au dashboard et
 * à toutes les opérations totalement interdit (plus d'essai gratuit, plus
 * d'aperçu en lecture seule). Seuls le paiement et la déconnexion sont
 * disponibles ici.
 */
export function SuspensionGate() {
  const canManage = usePermission('billing.view');

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-bg/80 px-4 backdrop-blur-md sm:px-6">
        <Logo />
        <button onClick={() => void logout()} className="btn-ghost text-sm">
          {tr('ui.SuspensionGate.deconnexion')}
        </button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 p-4">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <h1 className="font-display text-lg font-bold text-content">{tr('ui.SuspensionGate.activezVotreAbonnement')}</h1>
            <p className="text-sm text-content-muted">
              {canManage
                ? tr('ui.SuspensionGate.lAccesAVotreEspace')
                : tr('ui.SuspensionGate.lAccesEstEnPause')}
            </p>
          </div>
        </div>

        {/* Moment décisif : le prospect hésite à payer. Lui couper l'accès à
            la démonstration serait contre-productif — c'est justement là
            qu'elle doit rester à portée de clic. */}
        <div className="mb-6">
          <WatchDemoCard compact />
        </div>

        {canManage && (
          <Suspense fallback={<PageLoader />}>
            <SubscriptionPage />
          </Suspense>
        )}
      </div>
    </div>
  );
}
