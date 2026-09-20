import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BadgeCheck, LayoutDashboard, Loader2, MessageCircle } from 'lucide-react';
import { getActivationStatus, getActivation, trackActivation } from '../../features/activation/api';
import type { AuthUser } from '@oculo/shared-types';
import { useAuthStore } from '../../store/auth';
import { setActiveCurrency } from '../../lib/format';
import { api } from '../../lib/api';
import { DEMO_WHATSAPP_NUMBER, waLink } from '../../lib/whatsapp';
import { Button } from '../../components/ui';
import { ActivationShell, Glow, PrimaryAction } from './shared';

/** Délai entre deux interrogations : le webhook arrive en quelques secondes. */
const POLL_MS = 3000;
/** Au-delà, on cesse d'interroger et on propose de reprendre — pas de boucle infinie. */
const MAX_POLLS = 40;

/**
 * Retour du paiement.
 *
 * N'affiche JAMAIS un succès sur la seule foi du retour navigateur : c'est le
 * serveur qui tranche, en lisant l'abonnement réellement passé ACTIVE par le
 * webhook de la passerelle. Un client qui ferme le checkout sans payer puis
 * revient sur cette adresse ne voit donc aucune activation.
 */
export function ActivationReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('session') ?? '';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [state, setState] = useState<'checking' | 'activated' | 'pending' | 'error'>('checking');
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // Le numéro WhatsApp du prospect sert à préremplir la prise de contact.
    getActivation(token)
      .then((s) => !cancelled && setWhatsapp(s.whatsapp))
      .catch(() => undefined);

    const tick = async () => {
      if (cancelled) return;
      try {
        const status = await getActivationStatus(token);
        if (cancelled) return;

        if (status.activated && status.accessToken) {
          // Session ouverte par le serveur : le client arrive connecté, sans
          // avoir à ressaisir le mot de passe qu'il vient juste de choisir.
          const { data } = await api.get<{ user: AuthUser }>('/auth/me', {
            headers: { Authorization: `Bearer ${status.accessToken}` },
          });
          setActiveCurrency(data.user.tenantCurrency);
          setAuth(status.accessToken, data.user);
          void trackActivation(token, 'activation_completed');
          setState('activated');
          return;
        }
        if (status.activated) {
          setState('activated');
          return;
        }
        polls.current += 1;
        setState(polls.current >= MAX_POLLS ? 'pending' : 'checking');
        if (polls.current < MAX_POLLS) timer = setTimeout(tick, POLL_MS);
      } catch {
        if (!cancelled) setState('error');
      }
    };
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, setAuth]);

  if (state === 'checking') {
    return (
      <ActivationShell title="Vérification de votre paiement">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-content-muted">
            Nous attendons la confirmation de la passerelle. Ne fermez pas cette page.
          </p>
        </div>
      </ActivationShell>
    );
  }

  if (state === 'pending' || state === 'error') {
    return (
      <ActivationShell title="Paiement non confirmé">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <AlertTriangle className="mb-2 h-6 w-6 text-warning" aria-hidden="true" />
          <p className="text-sm text-content-muted">
            {state === 'error'
              ? "Nous n'avons pas pu vérifier votre paiement."
              : "Nous n'avons pas encore reçu la confirmation de votre paiement. S'il a bien été débité, votre espace s'ouvrira dès réception — vous pouvez recharger cette page dans quelques minutes."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => window.location.reload()}>Réessayer</Button>
            <WhatsappButton token={token} phone={whatsapp} label="Nous contacter" />
          </div>
        </div>
      </ActivationShell>
    );
  }

  return (
    <ActivationShell wide>
      <section className="relative overflow-hidden text-center">
        <Glow />
        <p className="text-4xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-content">
          Bienvenue sur OculoSaaS
        </h1>
        <p className="mt-2 text-content-muted">Votre abonnement est maintenant actif.</p>

        <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
          {['Paiement confirmé', 'Abonnement activé', 'Compte créé'].map((t) => (
            <li
              key={t}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-content"
            >
              <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="font-display text-xl font-extrabold text-content">Votre prochaine étape</h2>
        <p className="mt-1 text-sm text-content-muted">
          Entrez dans votre espace, ou laissez-nous le configurer avec vous : informations du magasin,
          produits et stock, utilisateurs, permissions, ventes, encaissements et rapports.
        </p>

        <div className="mt-5 space-y-2">
          <PrimaryAction onClick={() => navigate('/dashboard')}>
            <LayoutDashboard className="h-4 w-4" /> Accéder à mon tableau de bord
            <ArrowRight className="h-4 w-4" />
          </PrimaryAction>
          <WhatsappButton
            token={token}
            phone={whatsapp}
            label="Configurer mon espace avec l'équipe"
            full
          />
        </div>
      </section>
    </ActivationShell>
  );
}

/**
 * Prise de contact WhatsApp. Le numéro de l'équipe est centralisé dans
 * lib/whatsapp.ts : jamais recopié d'un écran à l'autre.
 */
function WhatsappButton({
  token,
  phone,
  label,
  full,
}: {
  token: string;
  phone: string | null;
  label: string;
  full?: boolean;
}) {
  const link = waLink(DEMO_WHATSAPP_NUMBER);
  const text = `Bonjour, je viens d'activer mon abonnement OculoSaaS${
    phone ? ` (${phone})` : ''
  }. Je souhaite configurer mon espace.`;

  return (
    <Button
      variant="outline"
      className={full ? 'w-full justify-center' : ''}
      onClick={() => {
        if (token) void trackActivation(token, 'whatsapp_clicked');
        if (link) window.open(`${link}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      }}
    >
      <MessageCircle className="h-4 w-4" /> {label}
    </Button>
  );
}
