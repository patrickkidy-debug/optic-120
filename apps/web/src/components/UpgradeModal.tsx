import { Rocket, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PREMIUM_FEATURE_LABELS } from '@oculo/shared-types';
import { useUpgradeModalStore } from '../store/upgradeModal';
import { usePermission } from '../store/auth';
import { Modal, Button } from './ui';
import { formatCurrency } from '../lib/format';

/**
 * Modale de conversion : déclenchée globalement (useUpgradeModalStore) dès
 * qu'un compte en essai tente d'utiliser une fonctionnalité réservée au plan
 * Standard. Montée une seule fois (AppShell) — aucune duplication par page.
 */
export function UpgradeModal() {
  const feature = useUpgradeModalStore((s) => s.feature);
  const close = useUpgradeModalStore((s) => s.close);
  const canManageBilling = usePermission('billing.manage');
  const navigate = useNavigate();

  if (!feature) return null;
  const featureLabel = PREMIUM_FEATURE_LABELS[feature];

  return (
    <Modal open onClose={close} title="Fonctionnalité Standard" size="sm">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">{featureLabel}</p>
        <h3 className="mt-1 font-display text-lg font-bold text-content">
          Trouvez-vous votre expérience satisfaisante ?
        </h3>
        <p className="mt-2 text-sm text-content-muted">
          Passez au plan <b>Standard</b> pour débloquer toutes les fonctionnalités professionnelles —
          {' '}{featureLabel.toLowerCase()} et bien plus.
        </p>

        <div className="mt-5 rounded-2xl border border-primary/30 bg-primary-soft p-4">
          <p className="font-display text-3xl font-extrabold text-gradient">{formatCurrency(12000)}</p>
          <p className="text-xs text-content-muted">par mois, sans engagement</p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {canManageBilling ? (
            <Button
              className="w-full"
              onClick={() => {
                close();
                navigate('/parametres/abonnement?plan=STANDARD');
              }}
            >
              <Rocket className="h-4 w-4" /> Passer au plan Standard
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                close();
                navigate('/parametres/abonnement');
              }}
            >
              Voir les offres
            </Button>
          )}
          <button onClick={close} className="btn-ghost h-9 w-full rounded-xl text-sm">
            Continuer avec les limitations
          </button>
        </div>
      </div>
    </Modal>
  );
}
