import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Check,
  ArrowRight,
  Menu,
  X,
  Star,
  Lock,
  CloudUpload,
  Database,
  Gauge,
  FolderX,
  EyeOff,
  Hourglass,
  PackageSearch,
  FlaskConical,
  MessageCircle,
  ScanFace,
  Truck,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import {
  AnimatePresence,
  animate,
  motion,
  useInView as useMotionInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { StorySection, useScrollRoot } from './landing/Story';
import { AllFeatures } from './landing/AllFeatures';
import { AdvisorLauncher } from '../features/advisor/AdvisorLauncher';
import { PLAN_CATALOG, BILLING_CYCLE_MONTHS, BILLING_CYCLE_DISCOUNT, type BillingCycle } from '@oculo/shared-types';
import { Logo } from '../components/Logo';
import { LanguagePicker } from '../components/LanguagePicker';
import { displayLocale } from '../lib/format';
import { tr } from '../lib/tr';
import { FluidScene } from '../components/FluidScene';
import { reopenConsent } from '../lib/consent';

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
  { href: '#fonctionnalites', key: 'landing.navFeatures' },
  { href: '#apercu', key: 'landing.navPreview' },
  { href: '#securite', key: 'landing.navSecurity' },
  { href: '#tarifs', key: 'landing.navPricing' },
];

const PROBLEMS = [
  { icon: FolderX, key: 'prob1', tone: 'accent' as const },
  { icon: EyeOff, key: 'prob2', tone: 'primary' as const },
  { icon: Hourglass, key: 'prob3', tone: 'cyan' as const },
];

/**
 * Visite produit : vraies captures du logiciel (public/images/landing, WebP).
 * Dimensions déclarées pour réserver la place avant chargement (pas de CLS).
 */
const TOUR = [
  { key: 'track', icon: PackageSearch, kind: 'browser', url: 'oculosaas.com/optique/oculotrack', img: '/images/landing/oculotrack.webp', w: 1400, h: 840 },
  { key: 'lab', icon: FlaskConical, kind: 'phones', img: '/images/landing/portail.webp', img2: '/images/landing/portail-montage.webp', w: 520, h: 1040 },
  { key: 'client', icon: MessageCircle, kind: 'phone', img: '/images/landing/suivi-client.webp', w: 520, h: 1040 },
  { key: 'measure', icon: ScanFace, kind: 'browser', url: 'oculosaas.com/optique/mesures', img: '/images/landing/assistant.webp', w: 1400, h: 840 },
  { key: 'suppliers', icon: Truck, kind: 'browser', url: 'oculosaas.com/fournisseurs', img: '/images/landing/fournisseur-whatsapp.webp', w: 1100, h: 717 },
] as const;

const FAQ = ['1', '2', '3', '4', '5', '6'] as const;
const TOUR_DELAY = 6500;

const PAYMENTS = [
  { label: 'Wave', short: 'Wave', bg: '#1DC3F5', fg: '#00263A' },
  { label: 'Orange Money', short: 'OM', bg: '#FF6600', fg: '#ffffff' },
  { label: 'MTN MoMo', short: 'MTN', bg: '#FFCC00', fg: '#111111' },
  { label: 'M-Pesa', short: 'M-P', bg: '#E30613', fg: '#ffffff' },
  { label: 'Airtel Money', short: 'AM', bg: '#ED1C24', fg: '#ffffff' },
  { label: 'Multicaixa', short: 'MCX', bg: '#0B3D91', fg: '#ffffff' },
  { label: 'Vinti4', short: 'V4', bg: '#0F7B3E', fg: '#ffffff' },
  { label: 'Moov Money', get short() { return tr('ui.LandingPage.moov'); }, bg: '#0A56A5', fg: '#ffffff' },
  { label: 'Free Money', get short() { return tr('ui.LandingPage.free'); }, bg: '#E4032E', fg: '#ffffff' },
];

const SECURITY = [
  { icon: Lock, key: 'sec1', tone: 'primary' as const },
  { icon: CloudUpload, key: 'sec2', tone: 'cyan' as const },
  { icon: Database, key: 'sec3', tone: 'accent' as const },
  { icon: Gauge, key: 'sec4', tone: 'primary' as const },
];

const STATS = ['stat1', 'stat2', 'stat3'] as const;

const TESTIMONIALS = [
  { name: 'Dr. Aminata Sow', role: "Clinique de l'Œil — Dakar", initials: 'AS', key: 'testi1' },
  { name: 'Mamadou Diallo', role: 'Optique Horizon — Abidjan', initials: 'MD', key: 'testi2' },
  { name: 'Fatou Ndiaye', role: 'Vision Plus — Thiès', initials: 'FN', key: 'testi3' },
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
  return new Intl.NumberFormat(displayLocale()).format(value);
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

/** Cadre de navigateur autour d'une vraie capture du logiciel. */
function BrowserFrame({
  src,
  w,
  h,
  alt,
  url,
  eager = false,
}: {
  src: string;
  w: number;
  h: number;
  alt: string;
  url: string;
  eager?: boolean;
}) {
  return (
    <div className="glass-card rounded-[28px] p-2.5 shadow-card-lg">
      <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/50" />
          <span className="ml-3 truncate rounded-md bg-surface-2 px-3 py-1 font-mono text-[11px] text-content-muted">
            {url}
          </span>
        </div>
        <img
          src={src}
          width={w}
          height={h}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          // React 18 ne connaît pas encore fetchPriority : attribut HTML en minuscules.
          {...{ fetchpriority: eager ? 'high' : 'auto' }}
          className="block h-auto w-full"
        />
      </div>
    </div>
  );
}

/** Cadre de téléphone autour d'une capture mobile (portail labo, suivi client). */
function PhoneFrame({ src, alt, className, eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={clsx('rounded-[34px] bg-[#0f172a] p-2 shadow-card-lg', className)}>
      <img
        src={src}
        width={520}
        height={1040}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full rounded-[27px]"
      />
    </div>
  );
}

/** Barre de lecture en haut de page (défilement de #root). */
function ScrollProgress() {
  const root = useScrollRoot();
  const { scrollYProgress } = useScroll({ container: root });
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30, mass: 0.3 });
  return <motion.div className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-brand" style={{ scaleX }} aria-hidden />;
}

/** Chiffre clé qui compte jusqu'à sa valeur à l'entrée dans l'écran (« 100 % », « 10+ »). */
function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const root = useScrollRoot();
  const inView = useMotionInView(ref, { root, once: true });
  const reduce = useReducedMotion();
  const m = /^(\d+)(\D.*)?$/.exec(value);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!m || !inView || reduce) return;
    const c = animate(0, Number(m[1]), { duration: 1.4, ease: [0.16, 0.84, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps
  // « 24/7 » n'est pas une quantité : affiché tel quel.
  if (!m || m[2]?.startsWith('/') || reduce) return <span ref={ref}>{value}</span>;
  return (
    <span ref={ref} className="tabular-nums">
      {n}
      {m[2] ?? ''}
    </span>
  );
}

const HERO_TOASTS = ['heroToast1', 'heroToast2', 'heroToast3'] as const;

/** Visuel du hero : tableau de bord OculoTrack + suivi client sur téléphone. */
function HeroVisual() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 18 });
  const phoneX = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), { stiffness: 120, damping: 18 });
  const [toast, setToast] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setToast((v) => (v + 1) % HERO_TOASTS.length), 2800);
    return () => window.clearInterval(id);
  }, [reduce]);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== 'mouse') return;
    const b = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - b.left) / b.width - 0.5);
    py.set((e.clientY - b.top) / b.height - 0.5);
  }

  return (
    <motion.div
      className="relative pb-16 sm:pb-10 lg:pl-6"
      style={{ rotateX, rotateY, transformPerspective: 1400 }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
      initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 0.84, 0.3, 1] }}
    >
      <BrowserFrame
        src="/images/landing/oculotrack.webp"
        w={1400}
        h={840}
        alt={t('landing.heroShotAlt')}
        url="oculosaas.com/optique/oculotrack"
        eager
      />
      <motion.div className="absolute -bottom-2 left-0 w-[31%] max-w-[180px] sm:-left-2 lg:-left-4" style={{ x: phoneX }}>
        <PhoneFrame src="/images/landing/suivi-client.webp" alt={t('landing.heroPhoneAlt')} className="float-slow" eager />
      </motion.div>
      {/* Notifications « en direct » : ce que le magasin reçoit au fil de la journée */}
      <div className="absolute -top-6 right-2 hidden h-[62px] w-[290px] sm:block" aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={toast}
            className="absolute right-0 top-0 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-card-lg backdrop-blur"
            initial={{ opacity: 0, y: -18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-success/15">
              <Check className="h-5 w-5 text-success" />
              <span className="live-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <div>
              <div className="whitespace-nowrap text-sm font-bold text-content">{t(`landing.${HERO_TOASTS[toast]}`)}</div>
              <div className="text-xs text-content-muted">OT-2026-000003 · {t('landing.heroToastSub')}</div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="glow-blob absolute left-1/2 top-1/2 -z-10 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 bg-primary/15" />
    </motion.div>
  );
}

/** Visite produit à onglets (clavier : flèches gauche/droite). */
function ProductTour() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  // Défilement automatique tant que le visiteur n'a pas choisi un onglet.
  const [auto, setAuto] = useState(true);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const root = useScrollRoot();
  const visible = useMotionInView(sectionRef, { root, amount: 0.35 });
  const reduce = useReducedMotion();
  const playing = auto && visible && !reduce;
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setActive((v) => (v + 1) % TOUR.length), TOUR_DELAY);
    return () => window.clearTimeout(id);
  }, [playing, active]);
  const item = TOUR[active];
  const alt = t(`landing.tour.${item.key}.alt`);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowRight' ? 1 : TOUR.length - 1)) % TOUR.length;
    setAuto(false);
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <section ref={sectionRef} id="apercu" className="scroll-mt-20 px-4 py-24 sm:px-8">
      <div className="mx-auto max-w-[1280px]">
        <Reveal className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            {t('landing.tour.eyebrow')}
          </span>
          <h2 className="mx-auto max-w-3xl text-balance font-display text-3xl font-extrabold text-content sm:text-4xl">
            {t('landing.tour.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-content-muted">{t('landing.tour.subtitle')}</p>
        </Reveal>

        <div
          role="tablist"
          aria-label={t('landing.tour.title')}
          onKeyDown={onKeyDown}
          className="mx-auto mb-12 flex max-w-5xl flex-wrap justify-center gap-2"
        >
          {TOUR.map((it, i) => (
            <button
              key={it.key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tour-tab-${it.key}`}
              aria-selected={i === active}
              aria-controls="tour-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => {
                setAuto(false);
                setActive(i);
              }}
              className={clsx(
                'relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                i === active
                  ? 'border-transparent bg-brand text-white shadow-card'
                  : 'border-line bg-surface text-content-muted hover:border-primary/30 hover:text-content',
              )}
            >
              <it.icon className="h-4 w-4" aria-hidden />
              {t(`landing.tour.${it.key}.label`)}
              {i === active && playing && (
                <motion.span
                  key={active}
                  className="absolute bottom-0 left-0 h-[3px] bg-white/70"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: TOUR_DELAY / 1000, ease: 'linear' }}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>

        <div
          key={item.key}
          id="tour-panel"
          role="tabpanel"
          aria-labelledby={`tour-tab-${item.key}`}
          className="tour-fade grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
        >
          <div className="order-2 lg:order-1">
            <h3 className="text-balance font-display text-2xl font-extrabold text-content sm:text-3xl">
              {t(`landing.tour.${item.key}.title`)}
            </h3>
            <p className="mt-4 text-lg leading-relaxed text-content-muted">{t(`landing.tour.${item.key}.text`)}</p>
            <ul className="mt-6 flex flex-col gap-3.5">
              {(['p1', 'p2', 'p3', 'p4'] as const).map((p) => (
                <li key={p} className="flex items-start gap-3 text-content">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10">
                    <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                  </span>
                  {t(`landing.tour.${item.key}.${p}`)}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative order-1 lg:order-2">
            {item.kind === 'browser' && (
              <BrowserFrame src={item.img} w={item.w} h={item.h} alt={alt} url={item.url} />
            )}
            {item.kind === 'phone' && (
              <PhoneFrame src={item.img} alt={alt} className="mx-auto w-[62%] max-w-[300px]" />
            )}
            {item.kind === 'phones' && (
              <div className="flex items-start justify-center gap-4 sm:gap-6">
                <PhoneFrame src={item.img} alt={alt} className="w-[46%] max-w-[270px]" />
                <PhoneFrame src={item.img2} alt="" className="mt-10 w-[46%] max-w-[270px]" />
              </div>
            )}
            <div className="glow-blob absolute left-1/2 top-1/2 -z-10 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 bg-accent/12" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const year = new Date().getFullYear();

  /** Halo qui suit le pointeur sur les cartes `.spotlight`. */
  function onSpotlight(e: PointerEvent<HTMLElement>) {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.spotlight');
    if (!card) return;
    const b = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - b.left}px`);
    card.style.setProperty('--my', `${e.clientY - b.top}px`);
  }

  return (
    // overflow-x-clip (et non hidden) : hidden crée un conteneur de défilement
    // qui empêche la scène collante du récit de rester à l'écran.
    <div style={LANDING_THEME} className="relative min-h-screen overflow-x-clip bg-bg text-content">
      <ScrollProgress />
      <AdvisorLauncher page="landing" />
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

      {/* Header — bascule desktop a 1024px (lg) et non 768px : a 768 les
          4 liens + selecteur + 2 boutons debordaient (779px de contenu pour
          704 disponibles), le logo touchait le premier lien et le bouton
          principal etait coupe. */}
      <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Logo />

          <div className="hidden items-center gap-6 lg:flex xl:gap-8">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="whitespace-nowrap text-sm text-content-muted transition-colors hover:text-primary"
              >
                {t(n.key)}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguagePicker />
            <Link to="/login" className="btn-ghost whitespace-nowrap">
              {t('landing.signIn')}
            </Link>
            <Link
              to="/signup"
              className="btn-primary neon-glow whitespace-nowrap rounded-full px-6"
            >
              {t('landing.useSoftware')}
            </Link>
          </div>

          {/* Sous 1024px : le selecteur reste accessible sans ouvrir le menu —
              un visiteur lusophone doit pouvoir changer de langue tout de suite. */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguagePicker />
            <button
              className="btn-ghost"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={tr('ui.LandingPage.menu')}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="border-t border-line bg-bg/95 px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm text-content-muted hover:bg-surface-2 hover:text-content"
                >
                  {t(n.key)}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-outline">
                  {t('landing.signIn')}
                </Link>
                <Link to="/signup" onClick={() => setMenuOpen(false)} className="btn-primary">
                  {t('landing.useSoftware')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10" onPointerMove={onSpotlight}>
        {/* Hero */}
        {/* Hero : contenu visible sans défilement, rendu immédiat (pas de
            fondu au scroll — celui-ci retarderait le LCP de la page). */}
        <section className="relative isolate overflow-hidden px-4 pb-24 pt-16 sm:px-8 lg:pt-24">
          {/* Décor « fluide technologique » : violet profond, formes liquides de la marque. */}
          <FluidScene layout="right" tone="light" className="-z-10" />
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="flex flex-col gap-6">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-4 py-1.5 backdrop-blur-md">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {t('landing.heroBadge')}
                  </span>
                </span>
                {/* text-balance : réparti les mots équitablement entre les
                    lignes du titre, pour éviter une dernière ligne orpheline. */}
                <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-content sm:text-5xl lg:text-6xl">
                  {t('landing.heroTitleA')}{' '}
                  <span className="text-gradient animate-gradient">{t('landing.heroTitleAccent')}</span>{' '}
                  {t('landing.heroTitleB')}
                </h1>
                <p className="max-w-[540px] text-lg leading-relaxed text-content-muted">
                  {t('landing.heroSubtitle')}
                </p>
                {/* Un seul CTA principal : chaque bouton en plus dilue la
                    conversion. L'app auto-guide désormais le prospect de A à Z
                    après l'inscription — plus besoin de proposer une démo ou
                    les tarifs en concurrence dès le premier écran. */}
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
                  <Link
                    to="/signup"
                    className="btn-primary neon-glow rounded-full px-8 py-4 text-base transition hover:-translate-y-0.5"
                  >
                    {t('landing.useSoftware')} <ArrowRight className="h-4 w-4" />
                  </Link>
                  {/* Badge de téléchargement façon store : bien visible à côté du CTA. */}
                  <a
                    href="/downloads/OculoSaaS.apk"
                    download
                    aria-label={t('landing.downloadAndroid')}
                    className="group inline-flex w-fit items-center gap-3 rounded-2xl bg-slate-900 py-2.5 pl-3.5 pr-5 text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)] ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-[#3ddc84]" fill="currentColor" aria-hidden="true">
                      <path d="M17.6 9.48l1.84-3.18a.5.5 0 0 0-.86-.5l-1.87 3.23A11.3 11.3 0 0 0 12 8.08c-1.7 0-3.3.36-4.71.95L5.42 5.8a.5.5 0 0 0-.86.5L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
                    </svg>
                    <span className="text-left leading-tight">
                      <span className="block text-[11px] font-medium opacity-75">{t('landing.androidSmall')}</span>
                      <span className="block text-base font-bold tracking-tight">{t('landing.androidBig')}</span>
                    </span>
                  </a>
                  <AdvisorLauncher page="landing" variant="inline" />
                </div>
                <div className="mt-8 flex flex-wrap gap-3 text-xs text-content-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" /> {t('landing.check1')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" /> {t('landing.check2')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" /> {t('landing.check3')}
                  </span>
                </div>
                <div className="mt-8 flex flex-wrap gap-8 border-t border-line pt-8">
                  {STATS.map((k) => (
                    <div key={k}>
                      <div className="font-display text-2xl font-extrabold text-content">
                        <CountUp value={t(`landing.${k}`)} />
                      </div>
                      <div className="text-sm text-content-muted">{t(`landing.${k}Label`)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <HeroVisual />
          </div>
        </section>

        {/* Problèmes actuels — mise en contexte avant la solution */}
        <section className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-14 text-center">
              <h2 className="mx-auto max-w-3xl font-display text-3xl font-extrabold text-content sm:text-4xl">
                {t('landing.probTitle')}
              </h2>
            </Reveal>
            <div className="grid gap-6 md:grid-cols-3">
              {PROBLEMS.map((p, i) => (
                <Reveal key={p.key} delay={i * 120} className="h-full">
                  <div className="spotlight glass-card glass-hover flex h-full flex-col gap-4 rounded-3xl p-8">
                    <div
                      className={clsx(
                        'grid h-14 w-14 place-items-center rounded-2xl border',
                        TONE_SOFT[p.tone],
                      )}
                    >
                      <p.icon className={clsx('h-7 w-7', TONE_TEXT[p.tone])} />
                    </div>
                    <h3 className="font-display text-lg font-bold text-content">{t(`landing.${p.key}`)}</h3>
                    <p className="text-sm text-content-muted">{t(`landing.${p.key}Text`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Récit au défilement : le voyage d'une paire de lunettes */}
        <StorySection />

        {/* Visite produit : vraies captures, une fonctionnalité par onglet */}
        <ProductTour />

        {/* Tout le logiciel, par domaine */}
        <AllFeatures />

        {/* Démo vidéo */}
        <section className="px-4 pb-8 pt-4 sm:px-8">
          <div className="mx-auto max-w-[1000px]">
            <Reveal className="mb-10 text-center">
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">
                {t('landing.demoTitle')}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-content-muted">{t('landing.demoSubtitle')}</p>
            </Reveal>
            <Reveal delay={100}>
              <div className="glass-card overflow-hidden rounded-[28px] p-2 shadow-card-lg">
                <video
                  className="aspect-video w-full rounded-[22px] bg-black"
                  controls
                  preload="none"
                  poster="/videos/demo-dashboard-poster.jpg"
                >
                  <source src="/videos/demo-dashboard.mp4" type="video/mp4" />
                </video>
              </div>
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
                    {t('landing.payTitle')}
                  </h2>
                  <p className="mx-auto mt-4 max-w-2xl text-content-muted">
                    {t('landing.paySubtitle')}
                  </p>
                </div>
                <div className="mq-wrap w-full">
                  <div className="mq-track py-2">
                  {[...PAYMENTS, ...PAYMENTS].map((p, i) => (
                    <div key={`${p.label}-${i}`} className="flex w-28 shrink-0 flex-col items-center gap-2" aria-hidden={i >= PAYMENTS.length || undefined}>
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
              </div>
            </Reveal>
          </div>
        </section>

        {/* Sécurité */}
        <section id="securite" className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-14 text-center">
              <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
                {t('landing.secEyebrow')}
              </span>
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">
                {t('landing.secTitle')}
              </h2>
            </Reveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY.map((s, i) => (
                <Reveal key={s.key} delay={i * 100} className="h-full">
                  <div
                    className={clsx(
                      'spotlight glass-card glass-hover h-full rounded-2xl border-l-4 p-8',
                      s.tone === 'accent'
                        ? 'border-l-accent/50'
                        : s.tone === 'cyan'
                          ? 'border-l-cyan/50'
                          : 'border-l-primary/50',
                    )}
                  >
                    <s.icon className={clsx('mb-4 h-8 w-8', TONE_TEXT[s.tone])} />
                    <h4 className="mb-2 font-bold text-content">{t(`landing.${s.key}`)}</h4>
                    <p className="text-sm text-content-muted">{t(`landing.${s.key}Text`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-8 text-center">
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">
                {t('landing.priceTitle')}
              </h2>
              <p className="mt-4 text-content-muted">
                {t('landing.priceSubtitle')}
              </p>
            </Reveal>

            {/* Sélecteur de cycle — très visible, au-dessus des cartes. */}
            <Reveal className="mb-12 flex justify-center">
              <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-card">
                <button
                  type="button"
                  onClick={() => setCycle('MONTHLY')}
                  className={clsx(
                    'rounded-xl px-6 py-3 text-sm font-bold transition',
                    cycle === 'MONTHLY' ? 'bg-brand text-white shadow-card' : 'text-content-muted hover:text-content',
                  )}
                >
                  {t('landing.cycleMonthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('QUARTERLY')}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition',
                    cycle === 'QUARTERLY' ? 'bg-brand text-white shadow-card' : 'text-content-muted hover:text-content',
                  )}
                >
                  {t('landing.cycleThreeMonths')}
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                      cycle === 'QUARTERLY' ? 'bg-white/20 text-white' : 'bg-success/15 text-success',
                    )}
                  >
                    −{Math.round(BILLING_CYCLE_DISCOUNT.QUARTERLY * 100)}%
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('SEMIANNUAL')}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition',
                    cycle === 'SEMIANNUAL' ? 'bg-brand text-white shadow-card' : 'text-content-muted hover:text-content',
                  )}
                >
                  {t('landing.cycleSixMonths')}
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                      cycle === 'SEMIANNUAL' ? 'bg-white/20 text-white' : 'bg-success/15 text-success',
                    )}
                  >
                    −{Math.round(BILLING_CYCLE_DISCOUNT.SEMIANNUAL * 100)}%
                  </span>
                </button>
              </div>
            </Reveal>

            <div className="grid items-stretch gap-6 md:grid-cols-3">
              {PLAN_CATALOG.map((plan, i) => {
                const highlighted = plan.code === 'STANDARD';
                const months = BILLING_CYCLE_MONTHS[cycle];
                const total = Math.round(plan.priceMonthly * months * (1 - BILLING_CYCLE_DISCOUNT[cycle]));
                const fullPrice = plan.priceMonthly * months;
                const savings = fullPrice - total;
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
                          {t('landing.mostPopular')}
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
                      {cycle === 'MONTHLY' ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-display text-4xl font-extrabold text-content">
                            {formatPrice(total)}
                          </span>
                          <span className="text-content-muted">FCFA{t('landing.perMonth')}</span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-display text-4xl font-extrabold text-content">
                              {formatPrice(total)}
                            </span>
                            <span className="text-content-muted">
                              FCFA {cycle === 'QUARTERLY' ? t('landing.forThreeMonths') : t('landing.forSixMonths')}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-content-muted">
                            ≈ {formatPrice(Math.round(total / months))} FCFA{t('landing.perMonth')}
                          </p>
                          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                            {t('landing.youSave')} {formatPrice(savings)} FCFA
                          </p>
                        </div>
                      )}
                      <p className="min-h-[40px] text-sm text-content-muted">
                        {t(`landing.plan${plan.code.charAt(0)}${plan.code.slice(1).toLowerCase()}Desc`)}
                      </p>
                      <div className="h-px w-full bg-line" />
                      <ul className="flex flex-1 flex-col gap-3">
                        {(t(`planFeatures.${plan.code}`, { returnObjects: true }) as string[]).map((f) => (
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
                        to={`/signup?plan=${plan.code}${cycle !== 'MONTHLY' ? `&cycle=${cycle}` : ''}`}
                        className={clsx(
                          'w-full rounded-xl py-4 text-center',
                          highlighted ? 'btn-primary neon-glow' : 'btn-outline',
                        )}
                      >
                        {highlighted ? t('landing.startNow') : `${t('landing.choose')} ${plan.name}`}
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
                {t('landing.testimonialsTitle')}
              </h2>
            </Reveal>
            <div className="grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((item, i) => (
                <Reveal key={item.name} delay={i * 120} className="h-full">
                  <div className="glass-card flex h-full flex-col rounded-3xl p-8">
                    <div className="mb-6 flex gap-1 text-primary">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="mb-8 flex-1 italic text-content/80">“{t(`landing.${item.key}`)}”</p>
                    <div className="flex items-center gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand font-bold text-white">
                        {item.initials}
                      </div>
                      <div>
                        <div className="font-bold text-content">{item.name}</div>
                        <div className="text-xs uppercase text-content-muted">{item.role}</div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-[860px]">
            <Reveal className="mb-12 text-center">
              <h2 className="font-display text-3xl font-extrabold text-content sm:text-4xl">{t('landing.faq.title')}</h2>
            </Reveal>
            <div className="flex flex-col gap-3">
              {FAQ.map((k) => (
                <details key={k} className="group glass-card rounded-2xl px-6">
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-bold text-content focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
                    {t(`landing.faq.q${k}`)}
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-content-muted transition-transform duration-200 group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="pb-5 leading-relaxed text-content-muted">{t(`landing.faq.a${k}`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="relative overflow-hidden px-4 py-28 sm:px-8">
          <div className="glow-blob absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-primary/20" />
          <Reveal className="mx-auto max-w-[900px] text-center">
            <h2 className="mb-8 font-display text-4xl font-extrabold text-content sm:text-5xl">
              {t('landing.ctaTitle')} <span className="text-gradient">OculoSaaS</span>.
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-lg text-content-muted">
              {t('landing.ctaSubtitle')}
            </p>
            <div className="flex justify-center">
              <Link
                to="/signup"
                className="btn-primary neon-glow rounded-full px-12 py-5 text-lg transition hover:-translate-y-0.5"
              >
                {t('landing.useSoftware')} <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line bg-bg-subtle py-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 sm:px-8 md:grid-cols-4">
          <div className="flex flex-col gap-5">
            <Logo />
            <p className="text-sm text-content-muted">
              {t('landing.footerTagline')}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="mb-1 font-bold text-content">{t('landing.footerProduct')}</h5>
            <a href="#fonctionnalites" className="text-sm text-content-muted hover:text-primary">
              {tr('ui.LandingPage.fonctionnalites')}
            </a>
            <a href="#tarifs" className="text-sm text-content-muted hover:text-primary">
              {tr('ui.LandingPage.tarifs')}
            </a>
            <a href="#apercu" className="text-sm text-content-muted hover:text-primary">
              {tr('ui.LandingPage.apercu')}
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="mb-1 font-bold text-content">{t('landing.footerAccount')}</h5>
            <Link to="/login" className="text-sm text-content-muted hover:text-primary">
              {t('landing.signIn')}
            </Link>
            <Link to="/signup" className="text-sm text-content-muted hover:text-primary">
              {t('landing.footerCreate')}
            </Link>
            <a href="#securite" className="text-sm text-content-muted hover:text-primary">
              {tr('ui.LandingPage.securite')}
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="mb-1 font-bold text-content">{t('landing.footerSupport')}</h5>
            <a
              href="mailto:support@oculosaas.com"
              className="text-sm text-content-muted hover:text-primary"
            >
              {t('landing.footerContact')}
            </a>
            <a href="#faq" className="text-sm text-content-muted hover:text-primary">
              FAQ
            </a>
            <Link to="/confidentialite" className="text-sm text-content-muted hover:text-primary">
              Confidentialité
            </Link>
            <Link to="/suppression-compte" className="text-sm text-content-muted hover:text-primary">
              Suppression du compte
            </Link>
            <button type="button" onClick={reopenConsent} className="text-left text-sm text-content-muted hover:text-primary">
              {tr('ui.CookieBanner.gerer')}
            </button>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-[1280px] border-t border-line px-4 pt-8 text-center sm:px-8">
          <p className="text-sm text-content-muted">
            © {year} OculoSaaS. {t('landing.footerExcellence')} {t('landing.footerRights')}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
