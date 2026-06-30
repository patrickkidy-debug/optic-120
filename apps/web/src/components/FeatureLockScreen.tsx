import { Lock, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PremiumFeature } from '@oculo/shared-types';
import { PREMIUM_FEATURE_LABELS } from '@oculo/shared-types';
import { usePermission } from '../store/auth';
import { Button } from './ui';
import { formatCurrency } from '../lib/format';

/**
 * Écran de verrouillage plein-page pour une section réservée au plan
 * Standard (ex. rapports avancés). Remplace le contenu de la page tant que
 * le compte est en essai, avec une mise en avant directe de l'offre.
 */
export function FeatureLockScreen({ feature }: { feature: PremiumFeature }) {
  const navigate = useNavigate();
  const canManage = usePermission('billing.manage');
  const label = PREMIUM_FEATURE_LABELS[feature];

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-xl font-bold text-content">{label}</h2>
        <p className="mt-2 text-sm text-content-muted">
          Cette fonctionnalité fait partie du plan <b>Standard</b>. Passez au plan supérieur pour la
          débloquer, ainsi que le multi-magasins, la gestion avancée du stock et les paiements Wave,
          Orange Money et MTN Money.
        </p>
        <div className="mt-5 inline-flex items-baseline gap-1.5 rounded-2xl border border-primary/30 bg-primary-soft px-5 py-3">
          <span className="font-display text-2xl font-extrabold text-gradient">{formatCurrency(12000)}</span>
          <span className="text-xs text-content-muted">/ mois</span>
        </div>
        {canManage ? (
          <Button className="mt-5 w-full" onClick={() => navigate('/parametres/abonnement?plan=STANDARD')}>
            <Rocket className="h-4 w-4" /> Passer au plan Standard
          </Button>
        ) : (
          <p className="mt-5 text-xs text-content-faint">Demandez à votre administrateur de s'abonner.</p>
        )}
      </div>
    </div>
  );
}
