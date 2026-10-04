import { useMemo, useState } from 'react';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { Button, Field, Modal } from '../../../components/ui';
import { waLinkWithText } from '../billing/shared';
import type { RealSubState } from '../../../features/billing/console';

/**
 * Message WhatsApp de la console fondateur vers un client.
 *
 * Le fondateur choisit le message parmi des modèles prêts (bienvenue, fin
 * d'essai, relance, paiement reçu…), personnalisés avec les vraies données du
 * client, puis l'ajuste librement avant d'ouvrir WhatsApp. Le modèle le plus
 * pertinent est présélectionné selon l'état de l'abonnement. L'envoi reste
 * manuel (wa.me) : rien ne part sans validation dans WhatsApp.
 */
export interface WhatsappContact {
  /** Nom complet de la personne (le prénom est déduit). */
  name?: string | null;
  tenantName: string;
  phone: string | null;
  email?: string | null;
  planName?: string | null;
  /** Échéance d'essai ou d'abonnement. */
  endsAt?: string | null;
  state?: RealSubState | null;
  lastLoginAt?: string | null;
  /** Code pays (RW → message en anglais par défaut). */
  countryCode?: string | null;
}

type Lang = 'fr' | 'en';
type Need = 'echeance' | 'offre' | 'email';

interface Template {
  key: string;
  label: string;
  needs?: Need[];
  fr: string;
  en: string;
}

const LOGIN_URL = 'https://oculosaas.com/login';

const TEMPLATES: Template[] = [
  {
    key: 'contact',
    label: 'Prise de contact',
    fr: 'Bonjour {prenom}, ici l’équipe OculoSaaS 👋\nJe vous écris au sujet de {etablissement}. Avez-vous un moment pour échanger ?',
    en: 'Hello {prenom}, this is the OculoSaaS team 👋\nI am reaching out about {etablissement}. Do you have a moment to talk?',
  },
  {
    key: 'welcome',
    label: 'Bienvenue',
    fr: 'Bonjour {prenom}, bienvenue sur OculoSaaS ! 🎉\nL’espace de {etablissement} est prêt. Pour bien démarrer :\n1. Ajoutez vos produits (montures, verres…)\n2. Enregistrez vos clients\n3. Faites votre première vente en caisse\nJe reste disponible ici pour vous accompagner.',
    en: 'Hello {prenom}, welcome to OculoSaaS! 🎉\nThe {etablissement} workspace is ready. To get started:\n1. Add your products (frames, lenses…)\n2. Register your customers\n3. Make your first sale at the till\nI am available here to help you.',
  },
  {
    key: 'onboarding',
    label: 'Aide à la prise en main',
    fr: 'Bonjour {prenom}, avez-vous pu configurer {etablissement} sur OculoSaaS ?\nJe vous propose une prise en main gratuite de 15 minutes, par téléphone ou en visio. Quel créneau vous arrange ?',
    en: 'Hello {prenom}, have you been able to set up {etablissement} on OculoSaaS?\nI can offer you a free 15-minute onboarding session, by phone or video call. Which time suits you?',
  },
  {
    key: 'trial_end',
    label: 'Fin d’essai',
    needs: ['echeance'],
    fr: 'Bonjour {prenom}, l’essai gratuit OculoSaaS de {etablissement} se termine le {echeance}.\nPour continuer sans interruption, activez votre abonnement depuis Paramètres → Abonnement. Besoin d’aide pour choisir l’offre ? Je suis là.',
    en: 'Hello {prenom}, the OculoSaaS free trial for {etablissement} ends on {echeance}.\nTo keep going without interruption, activate your subscription from Settings → Subscription. Need help choosing a plan? I am here.',
  },
  {
    key: 'renewal',
    label: 'Échéance d’abonnement',
    needs: ['echeance', 'offre'],
    fr: 'Bonjour {prenom}, l’abonnement {offre} de {etablissement} arrive à échéance le {echeance}.\nPensez à le renouveler pour éviter toute coupure. Merci de votre confiance !',
    en: 'Hello {prenom}, the {offre} subscription for {etablissement} expires on {echeance}.\nPlease renew it to avoid any interruption. Thank you for your trust!',
  },
  {
    key: 'expired',
    label: 'Abonnement expiré',
    fr: 'Bonjour {prenom}, l’accès de {etablissement} à OculoSaaS est actuellement suspendu.\nVos données sont conservées : il suffit de réactiver l’abonnement pour tout retrouver. Je peux vous guider si besoin.',
    en: 'Hello {prenom}, access to OculoSaaS for {etablissement} is currently suspended.\nYour data is kept safe: simply reactivate the subscription to get everything back. I can guide you if needed.',
  },
  {
    key: 'paid',
    label: 'Paiement reçu',
    needs: ['offre', 'echeance'],
    fr: 'Bonjour {prenom}, nous avons bien reçu votre paiement ✅\nL’abonnement {offre} de {etablissement} est actif jusqu’au {echeance}. Merci de votre confiance !',
    en: 'Hello {prenom}, we have received your payment ✅\nThe {offre} subscription for {etablissement} is active until {echeance}. Thank you for your trust!',
  },
  {
    key: 'access',
    label: 'Vos accès',
    needs: ['email'],
    fr: 'Bonjour {prenom}, voici vos accès OculoSaaS :\nConnexion : ' + LOGIN_URL + '\nIdentifiant : {email}\nSi vous avez oublié votre mot de passe, dites-le-moi et je vous en génère un nouveau.',
    en: 'Hello {prenom}, here are your OculoSaaS login details:\nLogin: ' + LOGIN_URL + '\nUsername: {email}\nIf you have forgotten your password, let me know and I will generate a new one.',
  },
  {
    key: 'inactive',
    label: 'Relance d’inactivité',
    fr: 'Bonjour {prenom}, nous ne vous avons pas vu sur OculoSaaS depuis quelque temps. Tout va bien pour {etablissement} ?\nS’il y a un blocage, dites-le-moi : je vous aide à le régler.',
    en: 'Hello {prenom}, we have not seen you on OculoSaaS for a while. Is everything fine at {etablissement}?\nIf something is blocking you, let me know: I will help you sort it out.',
  },
  {
    key: 'feedback',
    label: 'Demande d’avis',
    fr: 'Bonjour {prenom}, que pensez-vous d’OculoSaaS jusqu’ici ?\nVotre avis nous aide à améliorer le logiciel pour les opticiens. Une phrase suffit 🙏',
    en: 'Hello {prenom}, what do you think of OculoSaaS so far?\nYour feedback helps us improve the software for opticians. One sentence is enough 🙏',
  },
  { key: 'free', label: 'Message libre', fr: 'Bonjour {prenom}, ', en: 'Hello {prenom}, ' },
];

const DAY = 86_400_000;

/** Modèle le plus pertinent selon la situation du client. */
function suggested(c: WhatsappContact): string {
  const left = c.endsAt ? (new Date(c.endsAt).getTime() - Date.now()) / DAY : null;
  if (c.state === 'trialing') return c.endsAt ? 'trial_end' : 'onboarding';
  if (c.state === 'expired' || c.state === 'suspended' || c.state === 'cancelled') return 'expired';
  if (c.state === 'paying' && left !== null && left <= 10) return 'renewal';
  if (c.lastLoginAt === null) return 'onboarding';
  if (c.lastLoginAt && Date.now() - new Date(c.lastLoginAt).getTime() > 14 * DAY) return 'inactive';
  return 'contact';
}

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

export function ContactWhatsappModal({ contact, onClose }: { contact: WhatsappContact; onClose: () => void }) {
  const defaultLang: Lang =
    contact.countryCode === 'RW' || (contact.phone ?? '').replace(/[^0-9+]/g, '').startsWith('+250') ? 'en' : 'fr';
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [phone, setPhone] = useState(contact.phone ?? '');

  const vars = useMemo(() => {
    const first = (contact.name ?? '').trim().split(/\s+/)[0] ?? '';
    const date = contact.endsAt
      ? new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(contact.endsAt))
      : '';
    return {
      prenom: first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '',
      etablissement: contact.tenantName,
      offre: contact.planName ?? '',
      echeance: date,
      email: contact.email ?? '',
    };
  }, [contact, lang]);

  const available = (t: Template) =>
    (t.needs ?? []).every((n) => Boolean(n === 'echeance' ? vars.echeance : n === 'offre' ? vars.offre : vars.email));

  const build = (k: string, l: Lang) => {
    const t = TEMPLATES.find((x) => x.key === k) ?? TEMPLATES[0]!;
    // « Bonjour , » quand le prénom manque : on retire la virgule orpheline.
    return fill(t[l], vars).replace(/^(Bonjour|Hello) ,/, '$1,');
  };
  const [key, setKey] = useState(() => {
    const k = suggested(contact);
    return available(TEMPLATES.find((t) => t.key === k)!) ? k : 'contact';
  });
  const [message, setMessage] = useState(() => build(key, defaultLang));

  function choose(k: string, l: Lang = lang) {
    setKey(k);
    setLang(l);
    setMessage(build(k, l));
  }

  const link = waLinkWithText(phone, message);

  return (
    <Modal open onClose={onClose} title={`WhatsApp — ${contact.name || contact.tenantName}`} size="lg">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="font-semibold text-content">{contact.tenantName}</div>
          <div className="text-content-muted">
            {[contact.planName, vars.echeance && `échéance ${vars.echeance}`].filter(Boolean).join(' · ') || 'Aucun abonnement'}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="label mb-0">Message</span>
            <div className="inline-flex rounded-lg bg-surface-2 p-0.5 text-xs" role="group" aria-label="Langue du message">
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => choose(key, l)}
                  aria-pressed={lang === l}
                  className={`rounded-md px-2.5 py-1 font-semibold ${lang === l ? 'bg-primary text-white' : 'text-content-muted hover:text-content'}`}
                >
                  {l === 'fr' ? 'Français' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => {
              const ok = available(t);
              return (
                <button
                  key={t.key}
                  type="button"
                  disabled={!ok}
                  title={ok ? undefined : 'Information manquante pour ce client (offre, échéance ou e-mail)'}
                  onClick={() => choose(t.key)}
                  aria-pressed={key === t.key}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    key === t.key ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
                  }`}
                >
                  {t.label}
                  {t.key === suggested(contact) && key !== t.key && ' ★'}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Texte envoyé (modifiable)">
          <textarea className="input min-h-[180px] text-sm leading-relaxed" value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>

        <Field label="Numéro WhatsApp">
          <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {!link && (
          <p className="flex items-start gap-2 rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Aucun numéro WhatsApp utilisable. Renseignez-le ci-dessus pour activer l’envoi.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!link || message.trim().length === 0}
            onClick={() => {
              if (!link) return;
              window.open(link, '_blank', 'noopener,noreferrer');
              onClose();
            }}
          >
            <MessageCircle className="h-4 w-4" /> Ouvrir WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
}
