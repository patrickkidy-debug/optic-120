import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Stethoscope,
  Wallet,
  Check,
  ArrowRight,
  Menu,
  X,
  Star,
  TrendingUp,
  CalendarDays,
  LineChart,
  Lock,
  CloudUpload,
  Database,
  Gauge,
  Network,
  Maximize2,
} from 'lucide-react';
import clsx from 'clsx';
import { PLAN_CATALOG } from '@oculo/shared-types';
import { Logo } from '../components/Logo';

/* ============================================================
 * Page d'accueil publique (vitrine commerciale) — thème CLAIR
 * premium : verre dépoli sur blanc, halos pastel, grille fine et
 * dégradé de marque. La palette est épinglée localement pour un
 * rendu identique quel que soit le thème choisi ailleurs dans
 * l'application (qui reste sombre par défaut).
 * ============================================================ */

/**
 * Palette claire de marque, épinglée sur la page (indépendante du thème global).
 * Les teintes d'accent sont volontairement plus foncées que dans l'app sombre :
 * sur fond blanc, l'orange 500 et le cyan 400 tombent sous le ratio de contraste
 * 4.5:1 exigé pour du texte (WCAG AA).
 */
const LANDING_THEME = {
  '--bg': '#ffffff',
  '--bg-rgb': '255 255 255',
  '--bg-subtle': '#f7f8fc',
  '--bg-subtle-rgb': '247 248 252',
  '--surface': '#ffffff',
  '--surface-rgb': '255 255 255',
  '--surface-2': '#f4f6fb',
  '--surface-2-rgb': '244 246 251',
  '--surface-3': '#eaeefb',
  '--surface-3-rgb': '234 238 251',
  '--border': 'rgba(15, 23, 42, 0.08)',
  '--border-strong': 'rgba(15, 23, 42, 0.14)',
  '--primary': '#7c3aed',
  '--primary-rgb': '124 58 237',
  '--primary-hover': '#6d28d9',
  '--primary-hover-rgb': '109 40 217',
  '--primary-soft': 'rgba(124, 58, 237, 0.09)',
  '--accent': '#ea580c',
  '--accent-rgb': '234 88 12',
  '--accent-hover': '#c2410c',
  '--accent-hover-rgb': '194 65 12',
  '--accent-soft': 'rgba(234, 88, 12, 0.10)',
  '--accent-cyan': '#0e7490',
  '--accent-cyan-rgb': '14 116 144',
  '--text': '#0f172a',
  '--text-rgb': '15 23 42',
  '--text-muted': '#4a5568',
  '--text-muted-rgb': '74 85 104',
  '--text-faint': '#94a3b8',
  '--text-faint-rgb': '148 163 184',
  '--success': '#15803d',
  '--success-rgb': '21 128 61',
  '--warning': '#b45309',
  '--warning-rgb': '180 83 9',
  '--danger': '#dc2626',
  '--danger-rgb': '220 38 38',
  '--gradient-brand': 'linear-gradient(120deg, #7c3aed 0%, #ec4899 50%, #f97316 100%)',
  '--ring': 'rgba(124, 58, 237, 0.28)',
  colorScheme: 'light',
} as CSSProperties;

const NAV = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#apercu', label: 'Aperçu' },
  { href: '#securite', label: 'Sécurité' },
  { href: '#tarifs', label: 'Tarifs' },
];

const ADVANTAGES = [
  {
    icon: Stethoscope,
    title: 'Gestion intelligente',
    tone: 'primary' as const,
    items: ['Dossiers patients complets', 'Suivi des consultations', 'Ordonnances numériques'],
  },
  {
    icon: Wallet,
    title: 'Gestion commerciale',
    tone: 'accent' as const,
    items: ['Ventes et facturation', 'Stocks et montures', 'Gestion des assurances'],
  },
  {
    icon: Network,
    title: 'Collaboration',
    tone: 'cyan' as const,
    items: ['Accès multi-utilisateurs', 'Multi-magasins synchronisés', 'Réseau de cliniques'],
  },
];

const SHOWCASE = [
  {
    icon: CalendarDays,
    title: 'Agenda intelligent',
    text: 'Planification optimisée des rendez-vous avec rappels automatiques.',
    tone: 'primary' as const,
  },
  {
    icon: LineChart,
    title: 'Analyses en temps réel',
    text: 'Visualisez vos performances de vente et le flux de patients instantanément.',
    tone: 'cyan' as const,
  },
  {
    icon: Wallet,
    title: 'Comptabilité intégrée',
    text: 'Gérez vos dépenses, recettes et rapprochements sans effort.',
    tone: 'accent' as const,
  },
];

const PAYMENTS = [
  { label: 'Wave', short: 'Wave', bg: '#1DC3F5', fg: '#00263A' },
  { label: 'Orange Money', short: 'OM', bg: '#FF6600', fg: '#ffffff' },
  { label: 'MTN MoMo', short: 'MTN', bg: '#FFCC00', fg: '#111111' },
  { label: 'Moov Money', short: 'Moov', bg: '#0A56A5', fg: '#ffffff' },
  { label: 'Free Money', short: 'Free', bg: '#E4032E', fg: '#ffffff' },
];

const SECURITY = [
  {
    icon: Lock,
    title: 'Chiffrement AES-256',
    text: 'Vos données sensibles sont chiffrées, au repos comme en transit.',
    tone: 'primary' as const,
  },
  {
    icon: CloudUpload,
    title: 'Sauvegardes régulières',
    text: 'Sauvegardes automatiques pour protéger vos informations.',
    tone: 'cyan' as const,
  },
  {
    icon: Database,
    title: 'Isolation des données',
    text: 'Chaque établissement dispose de ses propres données cloisonnées.',
    tone: 'accent' as const,
  },
  {
    icon: Gauge,
    title: 'Haute disponibilité',
    text: 'Architecture cloud pensée pour un service fiable et continu.',
    tone: 'primary' as const,
  },
];

const STATS = [
  { value: '100 %', label: 'en ligne, sans installation' },
  { value: '5+', label: 'opérateurs Mobile Money' },
  { value: '24/7', label: 'accès à vos données' },
];

const TESTIMONIALS = [
  {
    name: 'Dr. Aminata Sow',
    role: 'Clinique de l’Œil — Dakar',
    initials: 'AS',
    text: 'OculoSaaS a transformé notre organisation : rendez-vous, dossiers patients et caisse réunis au même endroit.',
  },
  {
    name: 'Mamadou Diallo',
    role: 'Optique Horizon — Abidjan',
    initials: 'MD',
    text: 'Encaisser par Wave et Orange Money directement à la caisse, c’est exactement ce qu’il nous fallait.',
  },
  {
    name: 'Fatou Ndiaye',
    role: 'Vision Plus — Thiès',
    initials: 'FN',
    text: 'Je pilote mes magasins depuis mon téléphone. Les rapports montrent clairement où je gagne de l’argent.',
  },
];

const TONE_TEXT: Record<'primary' | 'accent' | 'cyan', string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  cyan: 'text-cyan',
};
const TONE_SOFT: Record<'primary' | 'accent' | 'cyan', string> = {
  primary: 'bg-primary/10 border-primary/20',
  accent: 'bg-accent/10 border-accent/20',
  cyan: 'bg-cyan/10 border-cyan/20',
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

/** Détecte l'entrée d'un élément dans le viewport (une seule fois). */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

/** Enveloppe : anime l'apparition au défilement, avec délai (effet décalé). */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={clsx('reveal', inView && 'is-visible', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Présentation animée (motion design) : la présentation HTML/CSS animée
 * (`/promo-complete.html`) intégrée via une iframe silencieuse. Le lien ouvre la
 * version complète (lecture, plein écran, téléchargement).
 */
function DemoVideo() {
  return (
    <div className="relative">
      <div className="glass-card overflow-hidden rounded-[28px] p-2 shadow-card-lg">
        <div className="aspect-video overflow-hidden rounded-[22px]">
          <iframe
            title="Présentation animée OculoSaaS"
            src="/promo-complete.html?embed=1"
            className="h-full w-full bg-black"
            loading="lazy"
            allow="autoplay; fullscreen"
            style={{ border: 0 }}
          />
        </div>
      </div>
      {/* Badge flottant. Posé sur la vidéo sombre : blanc plein plutôt que verre
          dépoli, qui virerait au gris sale sur ce fond. */}
      <div className="float-slow absolute -right-3 top-6 hidden rounded-2xl border border-line bg-surface p-3 shadow-card-lg sm:block">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-cyan/15 text-cyan">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-bold text-content">Temps réel</div>
            <div className="text-xs text-content-muted">Données synchronisées</div>
          </div>
        </div>
      </div>
      <div className="mt-4 text-center">
        <a
          href="/promo-complete.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted transition hover:text-primary"
        >
          <Maximize2 className="h-4 w-4" /> Voir en plein écran &amp; télécharger la vidéo
        </a>
      </div>
    </div>
  );
}

/** Maquette de tableau de bord (CSS pur, sans dépendance ni image externe). */
function DashboardMock() {
  const bars = [40, 65, 35, 80, 95, 60, 50];
  return (
    <div className="relative">
      <div className="glass-card rounded-[32px] p-4 shadow-card-lg">
        <div className="overflow-hidden rounded-2xl border border-line bg-bg-subtle">
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-danger/50" />
              <span className="h-3 w-3 rounded-full bg-accent/50" />
              <span className="h-3 w-3 rounded-full bg-primary/50" />
            </div>
            <div className="font-mono text-xs text-content-muted">oculosaas.com/dashboard</div>
            <div className="w-10" />
          </div>
          <div className="grid grid-cols-3 gap-4 p-6">
            <div className="col-span-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wide text-primary">
                Flux patients hebdomadaire
              </div>
              <div className="flex h-24 items-end gap-2">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="mini-bar flex-1 rounded-t-sm bg-gradient-to-t from-primary/40 to-primary/80"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <div className="text-[10px] text-content-muted">Ventes / jour</div>
              <div className="mt-1 text-xl font-bold text-content">450k</div>
              <div className="text-[10px] text-cyan">+12% vs hier</div>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <div className="text-[10px] text-content-muted">Consultations</div>
              <div className="mt-1 text-xl font-bold text-content">18</div>
              <div className="text-[10px] text-accent">8 complétées</div>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <div className="text-[10px] text-content-muted">Alertes stock</div>
              <div className="mt-1 text-xl font-bold text-danger">3</div>
              <div className="text-[10px] text-content-muted">Lentilles CR39</div>
            </div>
          </div>
        </div>
      </div>
      <div className="glow-blob absolute left-1/2 top-1/2 -z-10 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 bg-primary/15" />
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div style={LANDING_THEME} className="relative min-h-screen overflow-x-hidden bg-bg text-content">
      {/* Fond : grille fine + halos pastel animés */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="grid-overlay absolute inset-0" />
        <div className="glow-blob left-[6%] top-[2%] h-96 w-96 bg-primary/30" />
        <div
          className="glow-blob right-[4%] top-[30%] h-96 w-96 bg-[#ec4899]/22"
          style={{ animationDelay: '4s' }}
        />
        <div
          className="glow-blob bottom-[6%] left-[28%] h-80 w-80 bg-accent/18"
          style={{ animationDelay: '8s' }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-4 sm:px-8">
          <Logo />
          <div className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-sm text-content-muted transition-colors hover:text-primary"
              >
                {n.label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="btn-ghost">
              Se connecter
            </Link>
            <Link to="/signup" className="btn-primary neon-glow rounded-full px-6">
              Utiliser le logiciel
            </Link>
          </div>
          <button
            className="btn-ghost md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        {menuOpen && (
          <div className="border-t border-line bg-bg/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm text-content-muted hover:bg-surface-2 hover:text-content"
                >
                  {n.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-outline">
                  Se connecter
                </Link>
                <Link to="/signup" onClick={() => setMenuOpen(false)} className="btn-primary">
                  Utiliser le logiciel
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative px-4 pb-24 pt-16 sm:px-8 lg:pt-24">
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="flex flex-col gap-6">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Pensé pour l’Afrique de l’Ouest
                  </span>
                </span>
                <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-content sm:text-5xl lg:text-6xl">
                  La gestion <span className="text-gradient">premium</span> de votre magasin
                  d'optique et de votre clinique.
                </h1>
                <p className="max-w-[540px] text-lg leading-relaxed text-content-muted">
                  La plateforme tout-en-un conçue pour les opticiens et ophtalmologues : caisse,
                  stocks, patients, paiements Mobile Money et rapports. Précision médicale,
                  efficacité commerciale.
                </p>
                <div className="mt-2 flex flex-col gap-4 sm:flex-row">
                  <Link
                    to="/signup"
                    className="btn-primary neon-glow rounded-xl px-8 py-4 text-base transition hover:-translate-y-0.5"
                  >
                    Utiliser le logiciel <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#tarifs"
                    className="glass-card glass-hover rounded-xl px-8 py-4 text-center text-base font-semibold text-content"
                  >
                    Voir les tarifs
                  </a>
                </div>
                <div className="mt-8 flex flex-wrap gap-3 text-xs text-content-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-cyan" /> Activation immédiate
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-cyan" /> Paiement Mobile Money
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-cyan" /> Sans engagement
                  </span>
                </div>
                <div className="mt-8 flex flex-wrap gap-8 border-t border-line pt-8">
                  {STATS.map((s) => (
                    <div key={s.label}>
                      <div className="font-display text-2xl font-extrabold text-content">
                        {s.value}
                      </div>
                      <div className="text-sm text-content-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <DemoVideo />
            </Reveal>
          </div>
        </section>

        {/* Avantages */}
        <section id="fonctionnalites" className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-14 text-center">
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">
                L’excellence opérationnelle
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-content-muted">
                Une suite complète d’outils intégrés pour piloter chaque aspect de votre activité
                médicale et commerciale.
              </p>
            </Reveal>
            <div className="grid gap-6 md:grid-cols-3">
              {ADVANTAGES.map((a, i) => (
                <Reveal key={a.title} delay={i * 120} className="h-full">
                  <div className="glass-card glass-hover flex h-full flex-col gap-6 rounded-3xl p-8">
                    <div
                      className={clsx(
                        'grid h-16 w-16 place-items-center rounded-2xl border',
                        TONE_SOFT[a.tone],
                      )}
                    >
                      <a.icon className={clsx('h-8 w-8', TONE_TEXT[a.tone])} />
                    </div>
                    <h3 className="font-display text-xl font-bold text-content">{a.title}</h3>
                    <ul className="flex flex-col gap-3">
                      {a.items.map((it) => (
                        <li key={it} className="flex items-center gap-3 text-content-muted">
                          <Check className={clsx('h-4 w-4 shrink-0', TONE_TEXT[a.tone])} />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Aperçu tableau de bord */}
        <section id="apercu" className="px-4 py-24 sm:px-8">
          <div className="mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-2">
            <Reveal>
              <div>
                <h2 className="mb-8 font-display text-3xl font-extrabold text-content sm:text-4xl">
                  Un tableau de bord qui anticipe vos besoins
                </h2>
                <div className="flex flex-col gap-8">
                  {SHOWCASE.map((s) => (
                    <div key={s.title} className="flex gap-4">
                      <div
                        className={clsx(
                          'grid h-12 w-12 shrink-0 place-items-center rounded-lg',
                          s.tone === 'primary' ? 'glass-card neon-border' : 'glass-card',
                        )}
                      >
                        <s.icon className={clsx('h-5 w-5', TONE_TEXT[s.tone])} />
                      </div>
                      <div>
                        <h4 className="mb-1 font-bold text-content">{s.title}</h4>
                        <p className="text-sm text-content-muted">{s.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <DashboardMock />
            </Reveal>
          </div>
        </section>

        {/* Mobile Money */}
        <section className="px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal>
              <div className="glass-card flex flex-col items-center gap-10 rounded-[40px] p-10 text-center sm:p-12">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-content sm:text-3xl">
                    Paiements locaux simplifiés
                  </h2>
                  <p className="mx-auto mt-4 max-w-2xl text-content-muted">
                    Encaissez vos clients directement depuis OculoSaaS grâce aux paiements Mobile
                    Money les plus utilisés en Afrique de l’Ouest.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
                  {PAYMENTS.map((p) => (
                    <div key={p.label} className="flex flex-col items-center gap-2">
                      <div
                        className="grid h-16 w-16 place-items-center rounded-2xl text-base font-extrabold shadow-card"
                        style={{ background: p.bg, color: p.fg }}
                      >
                        {p.short}
                      </div>
                      <span className="text-xs font-medium uppercase tracking-tight text-content-muted">
                        {p.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Sécurité */}
        <section id="securite" className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-14 text-center">
              <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
                Infrastructure de confiance
              </span>
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">
                Une sécurité sérieuse
              </h2>
            </Reveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY.map((s, i) => (
                <Reveal key={s.title} delay={i * 100} className="h-full">
                  <div
                    className={clsx(
                      'glass-card glass-hover h-full rounded-2xl border-l-4 p-8',
                      s.tone === 'accent'
                        ? 'border-l-accent/50'
                        : s.tone === 'cyan'
                          ? 'border-l-cyan/50'
                          : 'border-l-primary/50',
                    )}
                  >
                    <s.icon className={clsx('mb-4 h-8 w-8', TONE_TEXT[s.tone])} />
                    <h4 className="mb-2 font-bold text-content">{s.title}</h4>
                    <p className="text-sm text-content-muted">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-14 text-center">
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">
                Une offre adaptée à votre taille
              </h2>
              <p className="mt-4 text-content-muted">
                Simple, transparent, sans frais cachés. Activation immédiate après paiement.
              </p>
            </Reveal>
            <div className="grid items-stretch gap-6 md:grid-cols-3">
              {PLAN_CATALOG.map((plan, i) => {
                const highlighted = plan.code === 'STANDARD';
                return (
                  <Reveal key={plan.code} delay={i * 120} className="h-full">
                    <div
                      className={clsx(
                        'glass-card relative flex h-full flex-col gap-6 rounded-3xl p-8',
                        highlighted
                          ? 'neon-border z-10 lg:scale-[1.04]'
                          : 'glass-hover',
                      )}
                    >
                      {highlighted && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-4 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-card-lg">
                          Le plus populaire
                        </span>
                      )}
                      <div
                        className={clsx(
                          'text-sm font-semibold uppercase tracking-wide',
                          highlighted ? 'text-primary' : 'text-content-muted',
                        )}
                      >
                        {plan.name}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-4xl font-extrabold text-content">
                          {formatPrice(plan.priceMonthly)}
                        </span>
                        <span className="text-content-muted">FCFA/mois</span>
                      </div>
                      <p className="min-h-[40px] text-sm text-content-muted">{plan.description}</p>
                      <div className="h-px w-full bg-line" />
                      <ul className="flex flex-1 flex-col gap-3">
                        {plan.features.map((f) => (
                          <li
                            key={f}
                            className={clsx(
                              'flex items-start gap-3 text-sm',
                              highlighted ? 'text-content' : 'text-content-muted',
                            )}
                          >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Link
                        to={`/signup?plan=${plan.code}`}
                        className={clsx(
                          'w-full rounded-xl py-4 text-center',
                          highlighted ? 'btn-primary neon-glow' : 'btn-outline',
                        )}
                      >
                        {highlighted ? 'Démarrer maintenant' : `Choisir ${plan.name}`}
                      </Link>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Témoignages */}
        <section className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-14 text-center">
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">
                Ils nous font confiance
              </h2>
            </Reveal>
            <div className="grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <Reveal key={t.name} delay={i * 120} className="h-full">
                  <div className="glass-card flex h-full flex-col rounded-3xl p-8">
                    <div className="mb-6 flex gap-1 text-primary">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="mb-8 flex-1 italic text-content/80">“{t.text}”</p>
                    <div className="flex items-center gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand font-bold text-white">
                        {t.initials}
                      </div>
                      <div>
                        <div className="font-bold text-content">{t.name}</div>
                        <div className="text-xs uppercase text-content-muted">{t.role}</div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="relative overflow-hidden px-4 py-28 sm:px-8">
          <div className="glow-blob absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-primary/20" />
          <Reveal className="mx-auto max-w-[900px] text-center">
            <h2 className="mb-8 font-display text-4xl font-extrabold text-content sm:text-5xl">
              Transformez votre établissement avec <span className="text-gradient">OculoSaaS</span>.
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-lg text-content-muted">
              Rejoignez la gestion connectée de l’optique et de la clinique. Activation immédiate
              après paiement, sans engagement.
            </p>
            <Link
              to="/signup"
              className="btn-primary neon-glow rounded-2xl px-12 py-5 text-lg transition hover:-translate-y-0.5"
            >
              Utiliser le logiciel <ArrowRight className="h-5 w-5" />
            </Link>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line bg-bg-subtle py-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 sm:px-8 md:grid-cols-4">
          <div className="flex flex-col gap-5">
            <Logo />
            <p className="text-sm text-content-muted">
              La gestion tout-en-un au service de la santé visuelle en Afrique de l’Ouest.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="mb-1 font-bold text-content">Produit</h5>
            <a href="#fonctionnalites" className="text-sm text-content-muted hover:text-primary">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="text-sm text-content-muted hover:text-primary">
              Tarifs
            </a>
            <a href="#apercu" className="text-sm text-content-muted hover:text-primary">
              Aperçu
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="mb-1 font-bold text-content">Compte</h5>
            <Link to="/login" className="text-sm text-content-muted hover:text-primary">
              Se connecter
            </Link>
            <Link to="/signup" className="text-sm text-content-muted hover:text-primary">
              Créer un compte
            </Link>
            <a href="#securite" className="text-sm text-content-muted hover:text-primary">
              Sécurité
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="mb-1 font-bold text-content">Assistance</h5>
            <a
              href="mailto:support@oculosaas.com"
              className="text-sm text-content-muted hover:text-primary"
            >
              Contact
            </a>
            <a href="#faq" className="text-sm text-content-muted hover:text-primary">
              FAQ
            </a>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-[1280px] border-t border-line px-4 pt-8 text-center sm:px-8">
          <p className="text-sm text-content-muted">
            © {year} OculoSaaS. Excellence en ophtalmologie. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
