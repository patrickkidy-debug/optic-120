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
import { SoftwarePreview } from './SoftwarePreview';
import { formatTrialDuration } from './PaymentStep';
import { tr } from '../../lib/tr';

/**
 * Accueil du tunnel : page de conversion.
 *
 * Contenu volontairement limité à ce qui est VRAI d'OculoSaaS. La maquette de
 * référence décrivait un marché français (100 % Santé, télétransmission,
 * tiers payant, hébergement HDS, paiement Stripe, prix en euros) : repris tel
 * quel, chacun de ces éléments aurait été une affirmation fausse vis-à-vis des
 * opticiens d'Afrique de l'Ouest, et une promesse que le logiciel ne tient pas.
 *
 * Une seule action : commencer. La discussion WhatsApp n'est proposée qu'à
 * l'étape 5, une fois les coordonnées saisies : l'équipe ne parle qu'à des
 * prospects qualifiés, dont elle connaît déjà l'établissement et l'offre.
 */

const MODULES = [
  { icon: Boxes, title: 'Stock', get text() { return tr('ui.Intro.monturesVerresEtAccessoiresMagasin'); } },
  { icon: Glasses, get title() { return tr('ui.Intro.ventesDevis'); }, get text() { return tr('ui.Intro.devisVentesOrdonnancesEtGaranties'); } },
  { icon: Users, title: 'Clients', get text() { return tr('ui.Intro.fichesOrdonnancesEtHistoriqueD'); } },
  { icon: CreditCard, get title() { return tr('ui.Intro.encaissements'); }, get text() { return tr('ui.Intro.acomptesSoldesEtPriseEn'); } },
  { icon: BarChart3, get title() { return tr('ui.Intro.rapports'); }, get text() { return tr('ui.Intro.chiffreDAffairesEncaisseEt'); } },
  { icon: Smartphone, get title() { return tr('ui.Intro.multiSupport'); }, get text() { return tr('ui.Intro.ordinateurTabletteEtTelephoneSans'); } },
];

const STEPS = [
  {
    n: '01',
    get title() { return tr('ui.Intro.repondezAQuelquesQuestions'); },
    get text() { return tr('ui.Intro.votreStructureVotreTailleEt'); },
  },
  {
    n: '02',
    get title() { return tr('ui.Intro.activezVotreAbonnement'); },
    get text() { return tr('ui.Intro.paiementParOrangeMoneyWave'); },
  },
  {
    n: '03',
    get title() { return tr('ui.Intro.configurezAvecNotreEquipe'); },
    get text() { return tr('ui.Intro.uneSessionDAccompagnementReservee'); },
  },
];

const ONBOARDING = () => [
  tr('ui.Intro.informationsDeVotreMagasin'),
  tr('ui.Intro.produitsEtStockDeDepart'),
  tr('ui.Intro.utilisateursEtPermissions'),
  tr('ui.Intro.ventesEtEncaissements'),
  tr('ui.Intro.commandesDeVerres'),
  tr('ui.Intro.rapportsEtApplicationMobile'),
];

export function Intro({ onStart, trialMinutes = 0 }: { onStart: () => void; trialMinutes?: number }) {
  const trial = trialMinutes > 0 ? tr('ui.Intro.essaiGratuitTrialminutes', { trialMinutes: formatTrialDuration(trialMinutes) }) : null;
  return (
    <ActivationShell wide>
      {/* Hero */}
      <section className="relative overflow-hidden text-center lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12 lg:overflow-visible lg:py-6 lg:text-left">
        <Glow />
        <div>
        <Pill>{tr('ui.Intro.logicielDeGestionPourOpticiens')}</Pill>

        <h1 className="mx-auto max-w-lg font-display text-3xl font-extrabold leading-tight tracking-tight text-content sm:text-4xl lg:mx-0 lg:text-5xl">
          {tr('ui.Intro.activezOculosaas')}{' '}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {tr('ui.Intro.pourVotreMagasin')}
          </span>
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm text-content-muted sm:text-base lg:mx-0 lg:text-lg">
          {tr('ui.Intro.repondezAQuelquesQuestionsChoisissez')}
        </p>

        <div className="mx-auto mt-6 max-w-sm lg:mx-0">
          <PrimaryAction onClick={onStart}>
            {tr('ui.Intro.commencerMonActivation')} <ArrowRight className="h-4 w-4" />
          </PrimaryAction>
        </div>

        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-start">
          {[tr('ui.Intro.configurationAccompagnee'), tr('ui.Intro.paiementSecurise'), trial ?? tr('ui.Intro.accesApresActivation')].map((t) => (
            <li key={t} className="flex items-center gap-1.5 text-xs text-content-muted">
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        </div>

        {/* Grand écran : le logiciel visible dès l'arrivée. */}
        <div className="hidden lg:block">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_20px_60px_-20px_rgba(124,58,237,0.35)]">
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-accent/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
              <span className="ml-3 font-mono text-[11px] text-content-faint">oculosaas.com/dashboard</span>
            </div>
            <img
              src="/apercu/dashboard-vignette.webp"
              alt={tr('ui.Intro.tableauDeBordDOculosaas')}
              width={720}
              height={508}
              className="block h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* Aperçu : vrais écrans du logiciel */}
      <SoftwarePreview />

      {/* Modules */}
      <section className="mt-12">
        <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-primary">
          {tr('ui.Intro.toutAuMemeEndroit')}
        </p>
        <h2 className="mb-5 text-center font-display text-xl font-extrabold text-content sm:text-2xl">
          {tr('ui.Intro.ceQueVousGerezAvec')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
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
          {tr('ui.Intro.commentCaSePasse')}
        </p>
        <h2 className="mb-6 text-center font-display text-xl font-extrabold text-content sm:text-2xl">
          {tr('ui.Intro.activationEn3Etapes')}
        </h2>
        <ol className="space-y-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:flex-col lg:p-6">
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
      <section className="mt-12 rounded-3xl border border-line bg-surface p-6 shadow-sm lg:p-10">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          <Headphones className="h-4 w-4" aria-hidden="true" /> {tr('ui.Intro.accompagnementInclus')}
        </span>
        <h2 className="font-display text-xl font-extrabold text-content sm:text-2xl">
          {tr('ui.Intro.vousNEtesPasSeul')}
        </h2>
        <p className="mt-2 text-sm text-content-muted">
          {tr('ui.Intro.uneSessionDe30A')}
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ONBOARDING().map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-content">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-content-faint">
          <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {tr('ui.Intro.leRendezVousSeReserve')}
        </p>
      </section>

      {/* Réassurance */}
      <section className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-surface-3/50 px-4 py-3 text-xs text-content-muted">
        <span className="inline-flex items-center gap-1.5">
          <Wallet className="h-4 w-4 text-primary" aria-hidden="true" /> {tr('ui.Intro.paiementMobileOuVirement')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BadgeCheck className="h-4 w-4 text-success" aria-hidden="true" />{' '}
          {trial ? tr('ui.Intro.trialSansPaiement', { trial: trial }) : tr('ui.Intro.accesDesLePaiementConfirme')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Headphones className="h-4 w-4 text-accent" aria-hidden="true" /> {tr('ui.Intro.assistanceWhatsapp')}
        </span>
      </section>

      {/* Dernier appel */}
      <section className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-center text-white shadow-lg lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">
          {tr('ui.Intro.pretAMieuxGererVotre')}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/90">
          {tr('ui.Intro.quelquesMinutesSuffisentLaSession')}
        </p>
        <div className="mx-auto mt-5 max-w-sm">
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 font-display font-bold text-primary shadow-lg transition-transform active:scale-[0.98]"
          >
            {tr('ui.Intro.commencerMonActivation')} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="mt-10 pb-4 text-center text-xs text-content-faint">
        <p>© {new Date().getFullYear()} {tr('ui.Intro.oculosaasTousDroitsReserves')}</p>
      </footer>
    </ActivationShell>
  );
}
