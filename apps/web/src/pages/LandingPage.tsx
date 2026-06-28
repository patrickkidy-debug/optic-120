import { useState } from 'react';
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

/* ============================================================
 * Page d'accueil publique (vitrine commerciale)
 * Présente le produit, les modules, les tarifs et les CTA d'essai.
 * Responsive mobile-first, thème sombre premium.
 * ============================================================ */

const MODULES = [
  {
    icon: Store,
    title: 'Caisse & ventes optique',
    text: "Point de vente rapide, devis, factures et suivi des ventes en temps réel pour votre magasin d'optique.",
  },
  {
    icon: Stethoscope,
    title: 'Gestion clinique',
    text: 'Patients, consultations, rendez-vous et chirurgies ophtalmologiques dans un dossier médical unifié.',
  },
  {
    icon: Boxes,
    title: 'Stocks & produits',
    text: 'Montures, verres et accessoires : entrées/sorties, seuils d’alerte et inventaire toujours à jour.',
  },
  {
    icon: Smartphone,
    title: 'Paiements Mobile Money',
    text: 'Encaissez par Wave, Orange Money, MTN, Moov et Free — en plus des espèces et de la carte.',
  },
  {
    icon: Building2,
    title: 'Multi-magasins',
    text: 'Pilotez plusieurs magasins et cliniques depuis un seul compte, avec des données cloisonnées.',
  },
  {
    icon: Users,
    title: 'Équipes & rôles',
    text: 'Invitez vos collaborateurs et attribuez des permissions précises par rôle et par succursale.',
  },
  {
    icon: Wallet,
    title: 'Finance & RH',
    text: 'Suivez dépenses, recettes, fournisseurs, assurances et personnel pour une vue 360° de l’activité.',
  },
  {
    icon: BarChart3,
    title: 'Tableaux de bord',
    text: 'Indicateurs clés, rapports et statistiques pour décider vite et piloter votre croissance.',
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

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-content">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <a href="#top" className="shrink-0">
            <BrandMark />
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition hover:bg-surface-2 hover:text-content"
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
          <div className="border-t border-line bg-bg px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-content-muted hover:bg-surface-2 hover:text-content"
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
        <section className="relative overflow-hidden bg-hero">
          <div
            className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
            style={{ background: 'var(--gradient-brand)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full opacity-20 blur-3xl"
            style={{ background: 'var(--accent)' }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-4 py-1.5 text-xs font-semibold text-content-muted">
              <Sparkles className="h-3.5 w-3.5 text-cyan" />
              La plateforme tout-en-un pour optiques & cliniques
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
              <a href="#tarifs" className="btn-outline w-full px-6 py-3 text-base sm:w-auto">
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
                <div key={s.label} className="card px-4 py-5">
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
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white">
                  <m.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-content-muted">{m.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Comment ça marche ---------- */}
        <section id="etapes" className="border-y border-line bg-bg-subtle">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
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
                <div key={s.title} className="relative card p-6">
                  <span className="absolute -top-3 left-6 grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white shadow-card">
                    {i + 1}
                  </span>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
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
                    className={clsx(
                      'mt-6 w-full',
                      highlighted ? 'btn-primary' : 'btn-outline',
                    )}
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
              <ShieldCheck className="h-4 w-4 text-cyan" /> Données chiffrées &amp; sauvegardées
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-cyan" /> Accessible partout, sur tout appareil
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-cyan" /> Paiement Mobile Money intégré
            </span>
          </p>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="border-t border-line bg-bg-subtle">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
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
                <details key={item.q} className="card group p-5 [&_summary]:cursor-pointer">
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
          <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-hero p-8 text-center sm:p-14">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-30 blur-3xl"
              style={{ background: 'var(--gradient-brand)' }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Prêt à moderniser votre établissement ?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-content-muted">
                Rejoignez les optiques et cliniques qui digitalisent leur gestion avec OculoSaaS.
                Essai gratuit de 14 jours, sans engagement.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/signup" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                  Créer mon compte
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/login" className="btn-outline w-full px-6 py-3 text-base sm:w-auto">
                  J’ai déjà un compte
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line">
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
