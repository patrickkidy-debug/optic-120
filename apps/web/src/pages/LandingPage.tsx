import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  Globe,
  HeartPulse,
  Star,
  Quote,
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

/** Photo d'ambiance (Unsplash) posée en CSS background du CTA final : si l'URL
 *  échoue, le dégradé en dessous reste visible (aucune icône cassée). */
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
    text: 'Inscrivez votre établissement en 2 minutes et choisissez votre offre.',
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
  { value: '3', label: 'offres adaptées à votre taille' },
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
    q: 'Quelle offre choisir pour démarrer ?',
    a: 'L’offre Starter (7 500 FCFA/mois) couvre déjà toutes les fonctionnalités essentielles jusqu’à 2 magasins. Vous pouvez évoluer vers Standard ou Growth à tout moment.',
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

/* Établissements & témoignages — exemples illustratifs (à remplacer par de vrais clients). */
const TRUST = [
  'Vision Plus',
  'Optique Horizon',
  'Clinique de l’Œil',
  'Centre Ophtalmo Teranga',
  'Optic Sénégal',
  'Clinique Regard Neuf',
];

const TESTIMONIALS = [
  {
    name: 'Dr. Aminata Sow',
    role: 'Clinique de l’Œil — Dakar',
    initials: 'AS',
    text: 'OculoSaaS a transformé notre organisation : rendez-vous, dossiers patients et caisse réunis au même endroit. Un gain de temps énorme au quotidien.',
  },
  {
    name: 'Mamadou Diallo',
    role: 'Optique Horizon — Abidjan',
    initials: 'MD',
    text: 'Encaisser par Wave et Orange Money directement à la caisse, c’est exactement ce qu’il nous fallait. Mes clients adorent la simplicité.',
  },
  {
    name: 'Fatou Ndiaye',
    role: 'Vision Plus — Thiès',
    initials: 'FN',
    text: 'Je pilote mes 3 magasins depuis mon téléphone. Les rapports me montrent enfin clairement où je gagne de l’argent.',
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
      // Déclenche quand l'élément est ~12% remonté dans la fenêtre : sur grand
      // écran, les sections s'animent progressivement au défilement.
      { threshold: 0.1, rootMargin: '0px 0px -12% 0px' },
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

/** Mot final du titre qui défile en boucle (texte animé). */
function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <span key={i} className="word-in text-gradient animate-gradient">
      {words[i]}
    </span>
  );
}

/**
 * Présentation animée (motion design) sous le CTA principal. On intègre
 * directement la présentation HTML/CSS animée (`/promo-complete.html`) via une
 * iframe : les scènes s'enchaînent automatiquement avec leurs animations, le
 * son est joué par la présentation elle-même. Plus net et plus stylé qu'un MP4.
 */
function DemoVideo() {
  return (
    <div className="relative mx-auto mt-10 aspect-video max-w-3xl overflow-hidden rounded-2xl border border-line shadow-card-lg">
      <iframe
        title="Présentation animée OculoSaaS"
        src="/promo-complete.html?embed=1"
        className="h-full w-full bg-black"
        loading="lazy"
        allow="autoplay; fullscreen"
        style={{ border: 0 }}
      />
    </div>
  );
}

/** Bandeau défilant en boucle (auto-scroll, pause au survol). */
function Marquee({
  items,
  reverse,
}: {
  items: { key: string; node: ReactNode }[];
  reverse?: boolean;
}) {
  return (
    <div className="mq-wrap">
      <div className={clsx('mq-track', reverse && 'rev')}>
        {items.map((it) => (
          <div key={it.key}>{it.node}</div>
        ))}
        {items.map((it) => (
          <div key={it.key + '-dup'} aria-hidden>
            {it.node}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fenêtre « mini-démo » (look capture d'écran animée). */
function MiniWindow({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="w-[340px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1222] shadow-card-lg">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate text-xs font-semibold text-white/80">{title}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-400">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE
        </span>
      </div>
      <div className="h-44 p-4">{children}</div>
    </div>
  );
}

const MINI_DEMOS: { key: string; title: string; node: ReactNode }[] = [
  {
    key: 'dash',
    title: 'Tableau de bord',
    node: (
      <MiniWindow title="Tableau de bord">
        <div className="flex h-full items-end gap-2">
          {[55, 35, 80, 50, 92, 68, 78].map((h, i) => (
            <div
              key={i}
              className="mini-bar flex-1 rounded-t"
              style={{ height: `${h}%`, background: 'linear-gradient(180deg,#8b5cf6,#ec4899)', animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </MiniWindow>
    ),
  },
  {
    key: 'rapports',
    title: 'Rapports',
    node: (
      <MiniWindow title="Rapports">
        <svg viewBox="0 0 300 150" className="h-full w-full" preserveAspectRatio="none">
          <polyline
            className="mini-line"
            points="0,120 50,90 100,105 150,60 200,75 250,35 300,50"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </MiniWindow>
    ),
  },
  {
    key: 'caisse',
    title: 'Caisse',
    node: (
      <MiniWindow title="Caisse & ventes">
        <div className="space-y-2 text-[11px] text-white/70">
          <div className="flex justify-between"><span>Monture RB5154</span><span>45 000</span></div>
          <div className="flex justify-between"><span>Verres anti-reflet</span><span>30 000</span></div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-extrabold text-white"><span>Total</span><span className="text-fuchsia-400">80 000 F</span></div>
          <div className="mt-1 rounded-lg py-2 text-center text-xs font-bold text-white" style={{ background: 'linear-gradient(120deg,#7c3aed,#ec4899)' }}>Encaisser · Wave</div>
        </div>
      </MiniWindow>
    ),
  },
  {
    key: 'stocks',
    title: 'Stocks',
    node: (
      <MiniWindow title="Stocks">
        <div className="space-y-3">
          {[['Montures', 78, '#8b5cf6'], ['Verres', 55, '#22d3ee'], ['Lentilles', 30, '#f97316'], ['Solution', 12, '#ec4899']].map(([l, w, c], i) => (
            <div key={i}>
              <div className="mb-1 flex justify-between text-[10px] text-white/60"><span>{l as string}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="mini-line h-full rounded-full" style={{ width: `${w}%`, background: c as string, animation: 'none' }} /></div>
            </div>
          ))}
        </div>
      </MiniWindow>
    ),
  },
  {
    key: 'paiements',
    title: 'Paiements',
    node: (
      <MiniWindow title="Paiements Mobile Money">
        <div className="flex flex-wrap gap-2">
          {[['Wave', '#1DC9FF', '#003049'], ['Orange Money', '#FF7900', '#fff'], ['Free Money', '#CD1A2B', '#fff'], ['Wizall', '#00A94F', '#fff']].map((p, i) => (
            <span key={i} className="rounded-lg px-3 py-2 text-xs font-extrabold" style={{ background: p[1], color: p[2] }}>{p[0]}</span>
          ))}
        </div>
      </MiniWindow>
    ),
  },
  {
    key: 'clinique',
    title: 'Clinique',
    node: (
      <MiniWindow title="Rendez-vous">
        <div className="space-y-2">
          {[['AD', 'Awa Diop', '09:00', '#22d3ee'], ['MK', 'Moussa Kane', '10:30', '#8b5cf6'], ['FN', 'Fatou Ndiaye', '14:00', '#f97316']].map((r, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: 'linear-gradient(120deg,#7c3aed,#ec4899)' }}>{r[0]}</span>
              <span className="text-[11px] text-white/80">{r[1]}</span>
              <span className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: r[3] as string, background: 'rgba(255,255,255,.08)' }}>{r[2]}</span>
            </div>
          ))}
        </div>
      </MiniWindow>
    ),
  },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-card">
        <Eye className="h-5 w-5 text-white" strokeWidth={2.6} />
      </div>
      <span className="font-display text-lg font-extrabold tracking-tight text-content">
        Oculo<span className="text-gradient animate-gradient">SaaS</span>
      </span>
    </div>
  );
}

/** Calque d'arrière-plan : photo floutée (optionnelle) + halos colorés animés.
 *  `offset` (parallaxe souris, -1..1) décale les halos selon leur profondeur. */
function BlurBackdrop({ image, offset }: { image?: string; offset?: { x: number; y: number } }) {
  const o = offset ?? { x: 0, y: 0 };
  const t = (depth: number) =>
    offset ? { transform: `translate(${o.x * depth}px, ${o.y * depth}px)`, transition: 'transform 0.3s ease-out' } : undefined;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {image && (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-[0.12] blur-2xl"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
      <div className="float-slow absolute -left-24 -top-24 h-80 w-80 rounded-full bg-violet-400/40 blur-3xl" style={t(40)} />
      <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" style={t(24)} />
      <div className="float-slow absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-cyan-300/40 blur-3xl" style={{ ...t(32), animationDelay: '1.5s' }} />
      <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl" style={t(18)} />
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroOffset, setHeroOffset] = useState({ x: 0, y: 0 });

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
              Utiliser le logiciel
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
                  Utiliser le logiciel
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section
          className="relative overflow-hidden"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHeroOffset({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
          }}
          onMouseLeave={() => setHeroOffset({ x: 0, y: 0 })}
        >
          <BlurBackdrop offset={heroOffset} />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <Reveal delay={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/70 px-4 py-1.5 text-xs font-semibold text-content-muted backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                La plateforme tout-en-un pour optiques &amp; cliniques
              </span>
            </Reveal>

            <Reveal delay={90}>
              <h1 className="title-float mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                Gérez votre optique &amp; clinique en toute{' '}
                <RotatingWord words={['simplicité', 'efficacité', 'sérénité', 'confiance']} />
              </h1>
            </Reveal>

            <Reveal delay={170}>
              <p className="mx-auto mt-5 max-w-2xl text-base text-content-muted sm:text-lg">
                Caisse, stocks, patients, paiements Mobile Money et rapports : tout ce qu’il faut pour
                piloter votre établissement, réuni dans une seule plateforme moderne pensée pour
                l’Afrique de l’Ouest.
              </p>
            </Reveal>

            <Reveal delay={250}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/signup" className="btn-primary w-full px-6 py-3 text-base transition hover:-translate-y-0.5 hover:shadow-card-lg sm:w-auto">
                  Utiliser le logiciel
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#tarifs" className="btn-outline w-full bg-white/70 px-6 py-3 text-base backdrop-blur transition hover:-translate-y-0.5 sm:w-auto">
                  Voir les tarifs
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-content-faint">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" /> Activation immédiate
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" /> Paiement Mobile Money sécurisé
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" /> Sans engagement
                </span>
              </p>
            </Reveal>

            {/* Vidéo de démonstration : autoplay silencieux, son activable */}
            <Reveal delay={360}>
              <DemoVideo />
            </Reveal>

            {/* Stats */}
            <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={400 + i * 90}>
                  <div className="rounded-2xl border border-line bg-white/70 px-4 py-5 shadow-card backdrop-blur transition hover:-translate-y-1 hover:shadow-card-lg">
                    <div className="font-display text-2xl font-extrabold text-content sm:text-3xl">
                      {s.value}
                    </div>
                    <div className="mt-1 text-xs text-content-muted">{s.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- L'application en action (carrousel mini-démos) ---------- */}
        <section className="py-12">
          <Reveal>
            <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.2em] text-content-faint">
              L’application en action
            </p>
          </Reveal>
          <Marquee items={MINI_DEMOS} reverse />
        </section>

        {/* ---------- Fonctionnalités ---------- */}
        <section id="fonctionnalites" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Tout votre métier, <span className="text-gradient animate-gradient">au même endroit</span>
            </h2>
            <p className="mt-4 text-content-muted">
              Des modules pensés pour les opticiens et ophtalmologues : de la vente au suivi médical,
              jusqu’à la comptabilité.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m, i) => (
              <Reveal key={m.title} delay={(i % 4) * 80} className="h-full">
                <div className="card group h-full p-5 transition duration-300 hover:-translate-y-1.5 hover:shadow-card-lg hover:border-primary/40">
                  <span
                    className={clsx(
                      'grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-card transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
                      m.color,
                    )}
                  >
                    <m.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-content-muted">{m.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- Comment ça marche ---------- */}
        <section id="etapes" className="relative overflow-hidden border-y border-line">
          <BlurBackdrop />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Opérationnel en <span className="text-gradient animate-gradient">quelques minutes</span>
              </h2>
              <p className="mt-4 text-content-muted">
                Pas de matériel, pas d’installation. Créez votre compte et commencez immédiatement.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 120} className="h-full">
                  <div className="relative card h-full bg-white/80 p-6 backdrop-blur transition duration-300 hover:-translate-y-1.5 hover:shadow-card-lg">
                    <span className="absolute -top-3 left-6 grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white shadow-card">
                      {i + 1}
                    </span>
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-card">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-content-muted">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Ils nous font confiance ---------- */}
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-content-faint">
            Ils nous font confiance
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {TRUST.map((name, i) => (
              <Reveal key={name} delay={i * 60}>
                <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-sm font-semibold text-content-muted backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-content">
                  <Eye className="h-4 w-4 text-primary" /> {name}
                </span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- Témoignages ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Ce qu’en disent <span className="text-gradient animate-gradient">nos clients</span>
            </h2>
          </div>
        </section>

        {/* Témoignages défilants en boucle */}
        <div className="-mt-4 pb-16">
          <Marquee
            items={TESTIMONIALS.map((t) => ({
              key: t.name,
              node: (
                <div className="card relative w-[360px] shrink-0 p-6">
                  <Quote className="absolute right-5 top-5 h-7 w-7 text-primary/20" />
                  <div className="flex gap-1 text-accent">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-content">“{t.text}”</p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                      {t.initials}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-content">{t.name}</div>
                      <div className="text-xs text-content-muted">{t.role}</div>
                    </div>
                  </div>
                </div>
              ),
            }))}
          />
        </div>

        {/* ---------- Fondateur ---------- */}
        <section className="border-y border-line bg-bg-subtle">
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[auto_1fr]">
            <Reveal className="mx-auto">
              <div className="float-slow grid h-40 w-40 place-items-center rounded-3xl bg-brand text-5xl font-extrabold text-white shadow-card-lg">
                EK
              </div>
            </Reveal>
            <Reveal delay={120}>
              <span className="kicker text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
                Le fondateur
              </span>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Eloge <span className="text-gradient animate-gradient">KONAN</span>
              </h2>
              <p className="text-sm font-semibold text-content-muted">Fondateur &amp; CEO d’OculoSaaS</p>
              <p className="mt-4 text-base leading-relaxed text-content-muted">
                Convaincu que la technologie doit servir les professionnels de santé d’Afrique de
                l’Ouest, Eloge KONAN a créé OculoSaaS pour donner aux opticiens et ophtalmologues un
                outil moderne, simple et abordable — du petit magasin à la clinique multi-sites.
              </p>
              <p className="mt-4 border-l-2 border-primary pl-4 text-base italic text-content">
                « Mon objectif est simple : faire gagner du temps aux professionnels de la vue, pour
                qu’ils se concentrent sur l’essentiel — leurs patients. »
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- Tarifs ---------- */}
        <section id="tarifs" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Des tarifs <span className="text-gradient animate-gradient">clairs et accessibles</span>
            </h2>
            <p className="mt-4 text-content-muted">
              Choisissez l’offre adaptée à votre établissement. Changez de formule à tout moment,
              sans frais cachés.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
            {PLAN_CATALOG.map((plan, i) => {
              const highlighted = plan.code === 'STANDARD';
              return (
                <Reveal key={plan.code} delay={i * 120} className="h-full">
                <div
                  className={clsx(
                    'relative flex h-full flex-col rounded-2xl border bg-surface p-6 shadow-card transition duration-300',
                    highlighted
                      ? 'border-2 border-primary bg-gradient-to-b from-primary-soft to-surface shadow-card-lg lg:-translate-y-3 lg:scale-[1.04] hover:-translate-y-4'
                      : 'hover:-translate-y-1.5 hover:shadow-card-lg',
                  )}
                >
                  {highlighted && (
                    <span className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-card-lg">
                      ⭐ LE PLUS POPULAIRE
                    </span>
                  )}

                  <h3 className="font-display text-xl font-extrabold">{plan.name}</h3>
                  {highlighted && (
                    <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                      ⭐ Recommandé pour les opticiens
                    </p>
                  )}
                  <p className="mt-1.5 min-h-[40px] text-sm text-content-muted">
                    {plan.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-extrabold">
                      {formatPrice(plan.priceMonthly)}
                    </span>
                    <span className="text-sm text-content-muted">FCFA / mois</span>
                  </div>
                  {highlighted && (
                    <p className="mt-1.5 text-xs font-semibold text-primary">Soit ~400 FCFA / jour</p>
                  )}

                  <Link
                    to={`/signup?plan=${plan.code}`}
                    className={clsx(
                      'mt-6 w-full',
                      highlighted ? 'btn-primary shadow-glow' : 'btn-outline',
                    )}
                  >
                    {highlighted ? '🚀 Choisir Standard' : `Choisir ${plan.name}`}
                  </Link>

                  <ul className="mt-6 space-y-3 border-t border-line pt-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-content-muted">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {highlighted && (
                    <p className="mt-5 rounded-xl bg-success/10 px-3 py-2 text-center text-xs font-semibold text-success">
                      Plus de 90&nbsp;% des établissements actifs choisissent cette offre.
                    </p>
                  )}
                </div>
                </Reveal>
              );
            })}
          </div>

          {/* Retour sur investissement */}
          <Reveal delay={140} className="mt-10">
            <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-hero p-6 text-center sm:p-8">
              <p className="font-display text-xl font-extrabold sm:text-2xl">
                Pour seulement <span className="text-gradient">400 FCFA par jour</span>, gérez votre
                établissement comme une grande chaîne d’optique.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-surface/70 p-4 backdrop-blur">
                  <p className="text-sm text-content-muted">
                    Moins cher qu’<b className="text-content">une seule monture vendue</b> — l’abonnement
                    se rentabilise dès la première vente du mois.
                  </p>
                </div>
                <div className="rounded-xl bg-surface/70 p-4 backdrop-blur">
                  <p className="text-sm text-content-muted">
                    Des <b className="text-content">heures économisées chaque mois</b> sur la caisse, les
                    stocks et les rapports, automatisés au lieu d’être faits à la main.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

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
                Activation immédiate après paiement, sans engagement.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="btn w-full bg-white px-6 py-3 text-base text-primary hover:bg-white/90 sm:w-auto"
                >
                  Utiliser le logiciel
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
