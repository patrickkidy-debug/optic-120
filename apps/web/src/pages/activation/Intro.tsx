import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CalendarCheck,
  CreditCard,
  Glasses,
  Headphones,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import { ActivationShell, Glow, Pill, PrimaryAction } from './shared';

/**
 * Accueil du tunnel : page de conversion.
 *
 * Contenu volontairement limité à ce qui est VRAI d'OculoSaaS. La maquette de
 * référence décrivait un marché français (100 % Santé, télétransmission,
 * tiers payant, hébergement HDS, paiement Stripe, prix en euros) : repris tel
 * quel, chacun de ces éléments aurait été une affirmation fausse vis-à-vis des
 * opticiens d'Afrique de l'Ouest, et une promesse que le logiciel ne tient pas.
 *
 * Une seule action, aussi : proposer « parler à un conseiller » ici offrirait
 * une sortie avant la première question. L'accompagnement est annoncé, et
 * proposé concrètement APRÈS l'activation.
 */

const MODULES = [
  { icon: Boxes, title: 'Stock', text: 'Montures, verres et accessoires, magasin par magasin.' },
  { icon: Glasses, title: 'Ventes & devis', text: 'Devis, ventes, ordonnances et garanties.' },
  { icon: Users, title: 'Clients', text: 'Fiches, ordonnances et historique d’équipement.' },
  { icon: CreditCard, title: 'Encaissements', text: 'Acomptes, soldes et prise en charge assurance.' },
  { icon: BarChart3, title: 'Rapports', text: 'Chiffre d’affaires, encaissé et reste à percevoir.' },
  { icon: Smartphone, title: 'Multi-support', text: 'Ordinateur, tablette et téléphone, sans installation.' },
];

const STEPS = [
  {
    n: '01',
    title: 'Répondez à quelques questions',
    text: 'Votre structure, votre taille et vos besoins, pour cibler la formule juste.',
  },
  {
    n: '02',
    title: 'Activez votre abonnement',
    text: 'Paiement par Orange Money, Wave, MTN MoMo, Moov Money ou carte bancaire.',
  },
  {
    n: '03',
    title: 'Configurez avec notre équipe',
    text: 'Une session d’accompagnement réservée dès le paiement confirmé.',
  },
];

const ONBOARDING = [
  'Informations de votre magasin',
  'Produits et stock de départ',
  'Utilisateurs et permissions',
  'Ventes et encaissements',
  'Commandes de verres',
  'Rapports et application mobile',
];

export function Intro({ onStart }: { onStart: () => void }) {
  return (
    <ActivationShell wide>
      {/* Hero */}
      <section className="relative overflow-hidden text-center">
        <Glow />
        <Pill>Logiciel de gestion pour opticiens</Pill>

        <h1 className="mx-auto max-w-lg font-display text-3xl font-extrabold leading-tight tracking-tight text-content sm:text-4xl">
          Activez OculoSaaS{' '}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            pour votre magasin
          </span>
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm text-content-muted sm:text-base">
          Répondez à quelques questions, choisissez votre formule et activez votre espace. Notre équipe
          vous accompagne ensuite dans la configuration.
        </p>

        <div className="mx-auto mt-6 max-w-sm">
          <PrimaryAction onClick={onStart}>
            Commencer mon activation <ArrowRight className="h-4 w-4" />
          </PrimaryAction>
        </div>

        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {['Configuration accompagnée', 'Paiement sécurisé', 'Accès après activation'].map((t) => (
            <li key={t} className="flex items-center gap-1.5 text-xs text-content-muted">
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Modules */}
      <section className="mt-12">
        <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-primary">
          Tout au même endroit
        </p>
        <h2 className="mb-5 text-center font-display text-xl font-extrabold text-content sm:text-2xl">
          Ce que vous gérez avec OculoSaaS
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.title} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <span className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <m.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-semibold text-content">{m.title}</h3>
              <p className="mt-0.5 text-xs text-content-muted">{m.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Déroulé */}
      <section className="mt-12">
        <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-accent">
          Comment ça se passe
        </p>
        <h2 className="mb-6 text-center font-display text-xl font-extrabold text-content sm:text-2xl">
          Activation en 3 étapes
        </h2>
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-bold text-white">
                {s.n}
              </span>
              <span>
                <h3 className="font-semibold text-content">{s.title}</h3>
                <p className="mt-0.5 text-sm text-content-muted">{s.text}</p>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Accompagnement */}
      <section className="mt-12 rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          <Headphones className="h-4 w-4" aria-hidden="true" /> Accompagnement inclus
        </span>
        <h2 className="font-display text-xl font-extrabold text-content sm:text-2xl">
          Vous n'êtes pas seul après le paiement
        </h2>
        <p className="mt-2 text-sm text-content-muted">
          Une session de 30 à 45 minutes avec notre équipe pour mettre votre magasin en route.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ONBOARDING.map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-content">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-content-faint">
          <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Le rendez-vous se réserve juste après la confirmation du paiement.
        </p>
      </section>

      {/* Réassurance */}
      <section className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-surface-3/50 px-4 py-3 text-xs text-content-muted">
        <span className="inline-flex items-center gap-1.5">
          <Wallet className="h-4 w-4 text-primary" aria-hidden="true" /> Paiement mobile ou carte
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BadgeCheck className="h-4 w-4 text-success" aria-hidden="true" /> Accès dès le paiement confirmé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Headphones className="h-4 w-4 text-accent" aria-hidden="true" /> Assistance WhatsApp
        </span>
      </section>

      {/* Dernier appel */}
      <section className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-center text-white shadow-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">
          Prêt à mieux gérer votre magasin ?
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/90">
          Quelques minutes suffisent. La session de configuration est comprise.
        </p>
        <div className="mx-auto mt-5 max-w-sm">
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 font-display font-bold text-primary shadow-lg transition-transform active:scale-[0.98]"
          >
            Commencer mon activation <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="mt-10 pb-4 text-center text-xs text-content-faint">
        <p>© {new Date().getFullYear()} OculoSaaS. Tous droits réservés.</p>
      </footer>
    </ActivationShell>
  );
}
