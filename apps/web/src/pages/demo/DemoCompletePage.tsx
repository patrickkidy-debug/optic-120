import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Check, ArrowRight, MessageCircle, PartyPopper } from 'lucide-react';
import { PageHeader, Button } from '../../components/ui';
import { demoWhatsappLink } from '../../lib/whatsapp';
import { trackDemoEvent } from '../../features/tour/api';

const RECAP = [
  'Gestion des stocks',
  'Gestion des patients',
  'Gestion des ventes',
  "Suivi de l'activité",
  'Gestion multi-boutiques',
];

/**
 * Fin de la visite guidée démo : récap, puis choix de l'abonnement réel (les
 * plans affichés viennent de la page Abonnement existante — aucun prix codé
 * en dur ici) ou demande d'une démonstration personnalisée (WhatsApp,
 * réutilise le même canal que la bannière du dashboard).
 */
export function DemoCompletePage() {
  const navigate = useNavigate();

  useEffect(() => {
    trackDemoEvent('pricing_viewed');
  }, []);

  const demoLink = demoWhatsappLink(
    "Bonjour, je viens de terminer la visite guidée d'OculoSaaS et j'aimerais une démonstration personnalisée.",
  );

  return (
    <div>
      <PageHeader title="Vous êtes prêt à utiliser OculoSaaS" subtitle="Voici ce que vous venez de découvrir" />

      <div className="mx-auto max-w-2xl">
        <div className="card flex flex-col items-center gap-4 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/15 text-success">
            <PartyPopper className="h-7 w-7" />
          </span>
          <ul className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {RECAP.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-content">
                <Check className="h-4 w-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1"
            onClick={() => {
              trackDemoEvent('plan_selected');
              navigate('/parametres/abonnement');
            }}
          >
            Choisir mon abonnement <ArrowRight className="h-4 w-4" />
          </Button>
          <a
            href={demoLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackDemoEvent('custom_demo_requested')}
            className="btn-outline flex-1 items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" /> Démonstration personnalisée
          </a>
        </div>
        <p className="mt-3 text-center text-xs text-content-faint">
          Les données de démonstration seront remplacées par votre établissement réel au moment du paiement.
        </p>
      </div>
    </div>
  );
}

export default DemoCompletePage;
