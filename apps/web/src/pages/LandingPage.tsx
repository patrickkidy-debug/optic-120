import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  Store,
  Stethoscope,
  Boxes,
  Users,
  Smartphone,
  Building2,
  BarChart3,
  ShieldCheck,
  Wallet,
  Check,
  ArrowRight,
  Sparkles,
  Menu,
  X,
  Clock,
  Globe,
  HeartPulse,
} from 'lucide-react';
import clsx from 'clsx';
import { PLAN_CATALOG } from '@oculo/shared-types';
import { PaymentMethodLogos } from '../components/PaymentMethodLogos';

/* ============================================================
 * Page d'accueil publique (vitrine commerciale)
 * Thème CLAIR vibrant + dégradés modernes + images floutées en
 * arrière-plan. Responsive mobile-first. Le reste de l'app garde
 * son thème sombre : la palette claire est cantonnée à cette page
 * via le conteneur `.light` et des variables locales.
 * ============================================================ */

/** Palette vive locale : recolore text-gradient, .bg-brand et les boutons. */
const VIVID_THEME = {
  '--primary': '#6d28d9',
  '--primary-hover': '#5b21b6',
  '--primary-soft': 'rgba(109, 40, 217, 0.10)',
  '--gradient-brand': 'linear-gradient(120deg, #7c3aed 0%, #ec4899 50%, #f97316 100%)',
  '--ring': 'rgba(124, 58, 237, 0.35)',
} as CSSProperties;

/** Photos d'ambiance (Unsplash) posées en CSS background : si une URL
 *  échoue, le dégradé en dessous reste visible (aucune icône cassée). */
const IMG_HERO =
  'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1400&q=60';
const IMG_CTA =
  'https://images.unsplash.com/photo-1606318801954-d46d46d3360a?auto=format&fit=crop&w=1400&q=60';

const MODULES = [
  {
    icon: Store,
    title: 'Caisse & ventes optique',
    text: "Point de vente rapide, devis, factures et suivi des ventes en temps réel pour votre magasin d'optique.",
    color: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: Stethoscope,
    title: 'Gestion clinique',
    text: 'Patients, consultations, rendez-vous et chirurgies ophtalmologiques dans un dossier médical unifié.',
    color: 'from-sky-500 to-cyan-400',
  },
  {
    icon: Boxes,
    title: 'Stocks & produits',
    text: 'Montures, verres et accessoires : entrées/sorties, seuils d’alerte et inventaire toujours à jour.',
    color: 'from-emerald-500 to-teal-400',
  },
  {
    icon: Smartphone,
    title: 'Paiements Mobile Money',
    text: 'Encaissez par Wave, Orange Money, MTN, Moov et Free — en plus des espèces et de la carte.',
    color: 'from-orange-500 to-amber-400',
  },
  {
    icon: Building2,
    title: 'Multi-magasins',
    text: 'Pilotez plusieurs magasins et cliniques depuis un seul compte, avec des données cloisonnées.',
    color: 'from-rose-500 to-pink-400',
  },
  {
    icon: Users,
    title: 'Équipes & rôles',
    text: 'Invitez vos collaborateurs et attribuez des permissions précises par rôle et par succursale.',
    color: 'from-indigo-500 to-blue-400',
  },
  {
    icon: Wallet,
    title: 'Finance & RH',
    text: 'Suivez dépenses, recettes, fournisseurs, assurances et personnel pour une vue 360° de l’activité.',
    color: 'from-fuchsia-500 to-purple-400',
  },
  {
    icon: BarChart3,
    title: 'Tableaux de bord',
    text: 'Indicateurs clés, rapports et statistiques pour décider vite et piloter votre croissance.',
    color: 'from-cyan-500 to-sky-400',
  },
];

const STEPS = [
  {
    icon: Sparkles,
    title: 'Créez votre compte',
    text: 'Inscrivez votre établissement en 2 minutes et profitez de 14 jours d’essai gratuit.',
  },
  {
    icon: Users,
    title: 'Configurez votre équipe',
    text: 'Ajoutez vos magasins, vos utilisateurs et importez vos produits et patients.',
  },
  {
    icon: HeartPulse,
    title: 'Pilotez au quotidien',
    text: 'Vendez, encaissez, suivez vos patients et vos performances depuis n’importe quel appareil.',
  },
];

const STATS = [
  { value: '14 j', label: 'd’essai gratuit' },
  { value: '5+', label: 'opérateurs Mobile Money' },
  { value: '100 %', label: 'web & responsive' },
  { value: '24/7', label: 'accès à vos données' },
];

const FAQ = [
  {
    q: 'Ai-je besoin d’installer un logiciel ?',
    a: 'Non. OculoSaaS est 100 % en ligne. Il fonctionne dans votre navigateur, sur ordinateur, tablette et téléphone, sans installation.',
  },
  {
    q: 'Puis-je essayer gratuitement ?',
    a: 'Oui, vous bénéficiez de 14 jours d’essai gratuit sur l’offre Découverte, sans engagement et sans carte bancaire.',
  },
  {
    q: 'Mes données sont-elles en sécurité ?',
    a: 'Vos données sont isolées par établissement, chiffrées et sauvegardées. Vous restez seul propriétaire de vos informations.',
  },
  {
    q: 'Comment se passent les paiements ?',
    a: 'Vous encaissez vos clients en espèces, par carte ou via Mobile Money (Wave, Orange, MTN, Moov, Free). L’abonnement se règle mensuellement.',
  },
  {
    q: 'Puis-je changer d’offre plus tard ?',
    a: 'Oui, vous pouvez passer à une offre supérieure ou inférieure à tout moment, selon l’évolution de votre activité.',
  },
];

const NAV = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#etapes', label: 'Comment ça marche' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
];

function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-card">
        <Eye className="h-5 w-5 text-white" strokeWidth={2.6} />
      </div>
      <span className="font-display text-lg font-extrabold tracking-tight text-content">
        Oculo<span className="text-gradient">SaaS</span>
      </span>
    </div>
  );
}

/** Calque d'arrière-plan : photo floutée (optionnelle) + halos colorés. */
function BlurBackdrop({ image }: { image?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {image && (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-[0.12] blur-2xl"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-violet-400/40 blur-3xl" />
      <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl" />
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="light relative min-h-screen overflow-x-hidden bg-bg text-content"
      style={VIVID_THEME}
    >
      {/* Voile de fond global doux (mesh très clair) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 60rem at 80% -10%, rgba(124,58,237,0.10), transparent 60%),' +
            'radial-gradient(50rem 50rem at -10% 20%, rgba(236,72,153,0.10), transparent 60%),' +
            'radial-gradient(50rem 50rem at 50% 120%, rgba(34,211,238,0.12), transparent 60%),' +
            'linear-gradient(180deg, #fbfaff 0%, #ffffff 100%)',
        }}
      />

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <a href="#top" className="shrink-0">
            <BrandMark />
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition hover:bg-surface-3 hover:text-content"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link to="/login" className="btn-ghost">
              Se connecter
            </Link>
            <Link to="/signup" className="btn-primary">
              Essai gratuit
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-xl border text-content md:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Menu mobile */}
        {menuOpen && (
          <div className="border-t border-line bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-content-muted hover:bg-surface-3 hover:text-content"
                >
                  {n.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-outline">
                  Se connecter
                </Link>
                <Link to="/signup" onClick={() => setMenuOpen(false)} className="btn-primary">
                  Essai gratuit
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <BlurBackdrop image={IMG_HERO} />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/70 px-4 py-1.5 text-xs font-semibold text-content-muted backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              La plateforme tout-en-un pour optiques &amp; cliniques
            </span>

            <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Gérez votre optique &amp; clinique en toute{' '}
              <span className="text-gradient">simplicité</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base text-content-muted sm:text-lg">
              Caisse, stocks, patients, paiements Mobile Money et rapports : tout ce qu’il faut pour
              piloter votre établissement, réuni dans une seule plateforme moderne pensée pour
              l’Afrique de l’Ouest.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                Démarrer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#tarifs" className="btn-outline w-full bg-white/70 px-6 py-3 text-base backdrop-blur sm:w-auto">
                Voir les tarifs
              </a>
            </div>

            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-content-faint">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" /> 14 jours d’essai gratuit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" /> Sans carte bancaire
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" /> Sans engagement
              </span>
            </p>

            {/* Stats */}
            <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-2xl border border-line bg-white/70 px-4 py-5 shadow-card backdrop-blur">
                  <div className="font-display text-2xl font-extrabold text-content sm:text-3xl">
                    {s.value}
                  </div>
                  <div className="mt-1 text-xs text-content-muted">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Fonctionnalités ---------- */}
        <section id="fonctionnalites" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Tout votre métier, <span className="text-gradient">au même endroit</span>
            </h2>
            <p className="mt-4 text-content-muted">
              Des modules pensés pour les opticiens et ophtalmologues : de la vente au suivi médical,
              jusqu’à la comptabilité.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="card group p-5 transition hover:-translate-y-1 hover:shadow-card-lg"
              >
                <span
                  className={clsx(
                    'grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-card',
                    m.color,
                  )}
                >
                  <m.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-content-muted">{m.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Comment ça marche ---------- */}
        <section id="etapes" className="relative overflow-hidden border-y border-line">
          <BlurBackdrop />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Opérationnel en <span className="text-gradient">quelques minutes</span>
              </h2>
              <p className="mt-4 text-content-muted">
                Pas de matériel, pas d’installation. Créez votre compte et commencez immédiatement.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="relative card bg-white/80 p-6 backdrop-blur">
                  <span className="absolute -top-3 left-6 grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white shadow-card">
                    {i + 1}
                  </span>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-card">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-content-muted">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Tarifs ---------- */}
        <section id="tarifs" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Des tarifs <span className="text-gradient">clairs et accessibles</span>
            </h2>
            <p className="mt-4 text-content-muted">
              Choisissez l’offre adaptée à votre établissement. Changez de formule à tout moment,
              sans frais cachés.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
            {PLAN_CATALOG.map((plan) => {
              const highlighted = plan.code === 'STANDARD';
              return (
                <div
                  key={plan.code}
                  className={clsx(
                    'relative flex flex-col rounded-2xl border bg-surface p-6 shadow-card transition',
                    highlighted
                      ? 'border-primary ring-2 ring-primary shadow-card-lg lg:-translate-y-2'
                      : 'hover:-translate-y-1 hover:shadow-card-lg',
                  )}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white shadow-card">
                      Le plus populaire
                    </span>
                  )}

                  <h3 className="font-display text-xl font-extrabold">{plan.name}</h3>
                  <p className="mt-1.5 min-h-[40px] text-sm text-content-muted">
                    {plan.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-extrabold">
                      {formatPrice(plan.priceMonthly)}
                    </span>
                    <span className="text-sm text-content-muted">FCFA / mois</span>
                  </div>
                  {plan.trialDays > 0 && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-success">
                      <Clock className="h-3.5 w-3.5" /> {plan.trialDays} jours d’essai gratuit
                    </p>
                  )}

                  <Link
                    to="/signup"
                    className={clsx('mt-6 w-full', highlighted ? 'btn-primary' : 'btn-outline')}
                  >
                    Choisir {plan.name}
                  </Link>

                  <ul className="mt-6 space-y-3 border-t border-line pt-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-content-muted">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-content-faint">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Données chiffrées &amp; sauvegardées
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" /> Accessible partout, sur tout appareil
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-primary" /> Paiement Mobile Money intégré
            </span>
          </p>

          {/* Moyens de paiement acceptés (via Moneroo) */}
          <div className="mt-10 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-faint">
              Paiement sécurisé via Moneroo
            </p>
            <PaymentMethodLogos className="justify-center" />
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="relative overflow-hidden border-t border-line">
          <BlurBackdrop />
          <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <div className="text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Questions fréquentes
              </h2>
              <p className="mt-4 text-content-muted">
                Tout ce que vous devez savoir avant de vous lancer.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="card group bg-white/80 p-5 backdrop-blur [&_summary]:cursor-pointer"
                >
                  <summary className="flex items-center justify-between gap-4 font-display text-base font-semibold marker:content-none">
                    {item.q}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-content-muted transition group-open:rotate-45">
                      <span className="text-lg leading-none">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-content-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA final ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-line-strong p-8 text-center shadow-card-lg sm:p-14">
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center opacity-20 blur-2xl"
              style={{ backgroundImage: `url(${IMG_CTA})` }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(120deg, #7c3aed 0%, #ec4899 55%, #f97316 100%)', opacity: 0.92 }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Prêt à moderniser votre établissement ?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/90">
                Rejoignez les optiques et cliniques qui digitalisent leur gestion avec OculoSaaS.
                Essai gratuit de 14 jours, sans engagement.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="btn w-full bg-white px-6 py-3 text-base text-primary hover:bg-white/90 sm:w-auto"
                >
                  Créer mon compte
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="btn w-full border border-white/60 px-6 py-3 text-base text-white hover:bg-white/10 sm:w-auto"
                >
                  J’ai déjà un compte
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <BrandMark />
          <p className="text-xs text-content-faint">
            © 2026 OculoSaaS — Solution de gestion pour optiques &amp; cliniques en Afrique de
            l’Ouest.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/login" className="text-content-muted hover:text-content">
              Connexion
            </Link>
            <Link to="/signup" className="text-content-muted hover:text-content">
              Inscription
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
