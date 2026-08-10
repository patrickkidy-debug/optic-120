import { useQuery } from '@tanstack/react-query';
import { Sparkles, MessageCircle } from 'lucide-react';
import { getPlanStatus } from '../features/billing/api';
import { useAuthStore } from '../store/auth';

const DEMO_WHATSAPP_NUMBER = '2385936598';

/**
 * Bannière tableau de bord : propose une démonstration gratuite aux
 * établissements en essai ou sans abonnement actif, en contactant
 * directement l'équipe sur WhatsApp (message pré-rempli). Masquée dès que
 * l'abonnement est actif.
 */
export function DemoBooking() {
  const { data: plan } = useQuery({ queryKey: ['plan-status'], queryFn: getPlanStatus });
  const user = useAuthStore((s) => s.user);

  if (plan && plan.status === 'ACTIVE') return null;

  const message = `Bonjour, je suis ${user?.firstName ?? ''} de ${user?.tenantName ?? 'mon établissement'} sur OculoSaaS. Je souhaite réserver une démonstration gratuite.`;
  const link = `https://wa.me/${DEMO_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display font-bold text-content">Démonstration gratuite</p>
          <p className="mt-0.5 text-sm text-content-muted">
            Découvrez toutes les fonctionnalités avec un expert, directement sur WhatsApp.
          </p>
        </div>
      </div>
      <a href={link} target="_blank" rel="noopener noreferrer" className="btn-accent shrink-0">
        <MessageCircle className="h-4 w-4" /> Demander une démo sur WhatsApp
      </a>
    </div>
  );
}
