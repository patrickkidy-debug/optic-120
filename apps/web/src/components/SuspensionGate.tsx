import { useState } from 'react';
import { AlertOctagon, Eye, EyeOff } from 'lucide-react';
import { Logo } from './Logo';
import { usePermission } from '../store/auth';
import { logout } from '../features/auth/api';
import { SubscriptionPage } from '../pages/settings/SubscriptionPage';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * Écran de reprise d'activité affiché quand l'essai/abonnement est terminé.
 * Les opérations sont bloquées côté serveur (méthodes d'écriture uniquement),
 * mais la consultation des données (tableau de bord en lecture seule) reste
 * possible — seul le paiement permet de réactiver les actions.
 */
export function SuspensionGate() {
  const canManage = usePermission('billing.view');
  const [showData, setShowData] = useState(true);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-bg/80 px-4 backdrop-blur-md sm:px-6">
        <Logo />
        <button onClick={() => void logout()} className="btn-ghost text-sm">
          Déconnexion
        </button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 p-4">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <h1 className="font-display text-lg font-bold text-content">Activez votre abonnement</h1>
            <p className="text-sm text-content-muted">
              {canManage
                ? "Votre période d'essai (ou votre abonnement) est terminée. Vos données sont conservées et consultables ci-dessous ; choisissez une offre et payez pour réactiver immédiatement la caisse, les ventes et les autres actions."
                : "L'accès aux opérations est en pause. Vos données restent consultables ci-dessous. Contactez l'administrateur de votre établissement pour activer l'abonnement."}
            </p>
          </div>
        </div>

        {canManage && <SubscriptionPage />}

        <div className="mt-8">
          <button
            onClick={() => setShowData((v) => !v)}
            className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-content-muted hover:text-content"
          >
            {showData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showData ? 'Masquer mes données' : 'Consulter mes données (lecture seule)'}
          </button>
          {showData && (
            <div className="pointer-events-none opacity-90">
              <DashboardPage />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
