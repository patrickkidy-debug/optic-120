import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CalendarCheck,
  CreditCard,
  Glasses,
  Headphones,
  MessageCircle,
  MousePointerClick,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivationShell, Glow, Pill, PrimaryAction } from './shared';
import { SoftwarePreview } from './SoftwarePreview';
import { formatTrialDuration } from './PaymentStep';
import { Link } from 'react-router-dom';
import { tr } from '../../lib/tr';
import { useAuthStore } from '../../store/auth';
import { demoWhatsappLink, TEAM_WHATSAPP_DISPLAY } from '../../lib/whatsapp';

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

/** Couleur propre à chaque module : la grille se lit d'un coup d'œil. */
const TINTS = [
  'from-violet-500 to-fuchsia-500',
  'from-fuchsia-500 to-orange-400',
  'from-sky-500 to-violet-500',
  'from-emerald-500 to-teal-400',
  'from-orange-400 to-rose-500',
  'from-indigo-500 to-sky-400',
];

/** « Essayez le logiciel » : déjà connecté, droit au logiciel (/signup renverrait ailleurs). */
function TryButton({ className = '', tabIndex, short }: { className?: string; tabIndex?: number; short?: boolean }) {
  const authenticated = useAuthStore((s) => s.status === 'authenticated');
  return (
    <Link
      to={authenticated ? '/dashboard' : '/signup'}
      tabIndex={tabIndex}
      className={`flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3.5 font-display font-bold text-emerald-950 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)] transition hover:bg-emerald-300 active:scale-[0.98] ${className}`}
    >
      <MousePointerClick className="h-5 w-5 shrink-0" aria-hidden="true" />
      {short ? (
        <>
          <span className="lg:hidden">{tr('ui.Intro.essayer')}</span>
          <span className="hidden lg:inline">{tr('ui.Intro.essayezLeLogiciel')}</span>
        </>
      ) : (
        tr('ui.Intro.essayezLeLogiciel')
      )}
    </Link>
  );
}

/** « Nous contacter » : WhatsApp de l'équipe, message pré-rempli. */
function contactLink(): string {
  return demoWhatsappLink(tr('ui.Intro.messageContact'));
}

/** Étiquette flottante posée sur la capture du logiciel. */
function Chip({ icon: Icon, children, className }: { icon: typeof Wallet; children: ReactNode; className: string }) {
  return (
    <div
      className={`absolute z-10 flex animate-float whitespace-nowrap items-center gap-2 rounded-2xl bg-surface/95 px-3 py-2 text-left text-xs font-semibold text-content shadow-[0_12px_30px_-8px_rgba(15,23,42,0.25)] ring-1 ring-line backdrop-blur ${className}`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {children}
    </div>
  );
}

export function Intro({ onStart, trialMinutes = 0 }: { onStart: () => void; trialMinutes?: number }) {
  const trial = trialMinutes > 0 ? tr('ui.Intro.essaiGratuitTrialminutes', { trialMinutes: formatTrialDuration(trialMinutes) }) : null;

  // Barre d'action collante : apparaît dès que les boutons du hero sortent de l'écran.
  const heroCta = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const el = heroCta.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSticky(!e!.isIntersecting && e!.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <ActivationShell
      wide
      headerAction={
        <a
          href={contactLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content shadow-sm ring-1 ring-line transition hover:text-primary hover:ring-primary/40"
        >
          <MessageCircle className="h-4 w-4 text-success" aria-hidden="true" />
          {tr('ui.Intro.nousContacter')}
          <span className="hidden text-content-muted sm:inline">· {TEAM_WHATSAPP_DISPLAY}</span>
        </a>
      }
    >
      {/* Hero */}
      <section className="relative text-center lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14 lg:py-8 lg:text-left">
        <Glow />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-10 -z-10 hidden h-96 w-96 rounded-full bg-gradient-to-br from-accent/20 via-primary/10 to-transparent blur-3xl lg:block"
        />
        <div>
          <Pill>{tr('ui.Intro.logicielDeGestionPourOpticiens')}</Pill>

          <h1 className="mx-auto max-w-lg font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight text-content sm:text-5xl lg:mx-0 lg:text-[3.25rem]">
            {tr('ui.Intro.activezOculosaas')}{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {tr('ui.Intro.pourVotreMagasin')}
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-md text-base text-content-muted lg:mx-0 lg:text-lg">
            {tr('ui.Intro.repondezAQuelquesQuestionsChoisissez')}
          </p>

          <div ref={heroCta} className="mx-auto mt-7 max-w-sm space-y-3 lg:mx-0">
            <PrimaryAction onClick={onStart}>
              {tr('ui.Intro.commencerMonActivation')} <ArrowRight className="h-4 w-4" />
            </PrimaryAction>
            <TryButton />
          </div>

          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-start">
            {[tr('ui.Intro.configurationAccompagnee'), tr('ui.Intro.paiementSecurise'), trial ?? tr('ui.Intro.accesApresActivation')].map((t) => (
              <li key={t} className="flex items-center gap-1.5 text-xs font-medium text-content-muted">
                <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Le logiciel visible dès l'arrivée, sur tous les écrans. */}
        <div className="relative mx-auto mt-12 max-w-xl px-2 lg:mt-0 lg:max-w-none lg:px-0">
          <Chip icon={Wallet} className="-left-1 -top-5 sm:-left-6 lg:-left-10">{tr('ui.Intro.chipPaiements')}</Chip>
          <Chip icon={Glasses} className="-right-1 bottom-20 [animation-delay:1.2s] sm:-right-6">{tr('ui.Intro.chipOrdonnances')}</Chip>
          <Chip icon={Smartphone} className="-bottom-6 left-4 [animation-delay:2.4s] sm:left-10">{tr('ui.Intro.chipMultiSupport')}</Chip>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-24px_rgba(124,58,237,0.45)] lg:[transform:perspective(1600px)_rotateY(-6deg)_rotateX(2deg)]">
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
      <section className="mt-16">
        <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-primary">
          {tr('ui.Intro.toutAuMemeEndroit')}
        </p>
        <h2 className="mb-6 text-center font-display text-2xl font-extrabold text-content sm:text-3xl">
          {tr('ui.Intro.ceQueVousGerezAvec')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-5">
          {MODULES.map((m, i) => (
            <div
              key={m.title}
              className="group rounded-2xl border border-line bg-surface p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(124,58,237,0.45)] lg:p-6"
            >
              <span className={`mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${TINTS[i % TINTS.length]} text-white shadow-md transition-transform group-hover:scale-110`}>
                <m.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-display font-bold text-content">{m.title}</h3>
              <p className="mt-1 text-xs text-content-muted sm:text-sm">{m.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Déroulé */}
      <section className="mt-16">
        <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-accent">
          {tr('ui.Intro.commentCaSePasse')}
        </p>
        <h2 className="mb-8 text-center font-display text-2xl font-extrabold text-content sm:text-3xl">
          {tr('ui.Intro.activationEn3Etapes')}
        </h2>
        <ol className="relative space-y-3 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          <span aria-hidden="true" className="absolute left-[16%] right-[16%] top-11 hidden h-0.5 bg-gradient-to-r from-primary/40 via-accent/40 to-success/40 lg:block" />
          {STEPS.map((s) => (
            <li key={s.n} className="relative flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:flex-col lg:items-center lg:p-6 lg:text-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-bold text-white">
                {s.n}
              </span>
              <span>
                <h3 className="font-display font-bold text-content">{s.title}</h3>
                <p className="mt-1 text-sm text-content-muted">{s.text}</p>
              </span>
            </li>
          ))}
        </ol>
        <div className="mx-auto mt-6 max-w-sm">
          <PrimaryAction onClick={onStart}>
            {tr('ui.Intro.commencerMonActivation')} <ArrowRight className="h-4 w-4" />
          </PrimaryAction>
        </div>
      </section>

      {/* Accompagnement */}
      <section className="mt-16 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm lg:grid lg:grid-cols-[1.3fr_1fr]">
        <div className="p-6 lg:p-10">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            <Headphones className="h-4 w-4" aria-hidden="true" /> {tr('ui.Intro.accompagnementInclus')}
          </span>
          <h2 className="font-display text-2xl font-extrabold text-content sm:text-3xl">
            {tr('ui.Intro.vousNEtesPasSeul')}
          </h2>
          <p className="mt-2 text-sm text-content-muted sm:text-base">
            {tr('ui.Intro.uneSessionDe30A')}
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {ONBOARDING().map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-content">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-1.5 text-xs text-content-faint">
            <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {tr('ui.Intro.leRendezVousSeReserve')}
          </p>
        </div>
        <div className="relative hidden min-h-[320px] lg:block">
          <img src="/images/auth/opticienne.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/10 to-transparent" />
        </div>
      </section>

      {/* Réassurance */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: Wallet, tint: 'text-primary bg-primary-soft', text: tr('ui.Intro.paiementMobileOuVirement') },
          { icon: BadgeCheck, tint: 'text-success bg-success/10', text: trial ? tr('ui.Intro.trialSansPaiement', { trial: trial }) : tr('ui.Intro.accesDesLePaiementConfirme') },
          { icon: Headphones, tint: 'text-accent bg-accent/10', text: tr('ui.Intro.assistanceWhatsapp') },
        ].map(({ icon: Icon, tint, text }) => (
          <div key={text} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium text-content">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            {text}
          </div>
        ))}
      </section>

      {/* Dernier appel */}
      <section className="relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-fuchsia-600 to-accent p-7 text-center text-white shadow-[0_30px_80px_-30px_rgba(124,58,237,0.7)] lg:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <h2 className="relative font-display text-2xl font-extrabold sm:text-4xl">
          {tr('ui.Intro.pretAMieuxGererVotre')}
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-white/90 sm:text-base">
          {tr('ui.Intro.quelquesMinutesSuffisentLaSession')}
        </p>
        <div className="relative mx-auto mt-7 max-w-sm space-y-3">
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 font-display font-bold text-primary shadow-lg transition-transform active:scale-[0.98]"
          >
            {tr('ui.Intro.commencerMonActivation')} <ArrowRight className="h-4 w-4" />
          </button>
          <TryButton />
          <a
            href={contactLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white/95 ring-1 ring-white/40 transition hover:bg-white/10"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {tr('ui.Intro.nousContacter')} · {TEAM_WHATSAPP_DISPLAY}
          </a>
        </div>
      </section>

      <footer className="mt-10 pb-24 text-center text-xs text-content-faint lg:pb-4">
        <p>© {new Date().getFullYear()} {tr('ui.Intro.oculosaasTousDroitsReserves')}</p>
      </footer>

      {/* Barre collante : l'action reste à portée de pouce pendant la lecture. */}
      <div
        aria-hidden={!sticky}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-12px_rgba(15,23,42,0.25)] backdrop-blur transition-transform duration-300 lg:bottom-auto lg:top-0 lg:border-b lg:border-t-0 lg:pb-3 ${
          sticky ? 'translate-y-0' : 'invisible translate-y-full lg:-translate-y-full'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 lg:justify-between lg:px-4">
          <span className="hidden font-display font-bold text-content lg:block">{tr('ui.Intro.pretAMieuxGererVotre')}</span>
          <div className="flex flex-1 gap-2 lg:max-w-md">
            <button
              type="button"
              tabIndex={sticky ? 0 : -1}
              onClick={onStart}
              className="flex flex-[1.4] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-primary to-accent px-3 py-3 font-display text-sm font-bold text-white"
            >
              <span className="lg:hidden">{tr('ui.Intro.commencer')}</span>
              <span className="hidden lg:inline">{tr('ui.Intro.commencerMonActivation')}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <TryButton short tabIndex={sticky ? 0 : -1} className="!w-auto flex-1 whitespace-nowrap !px-3 !py-3 text-sm" />
          </div>
        </div>
      </div>
    </ActivationShell>
  );
}
