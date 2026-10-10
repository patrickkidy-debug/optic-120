import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Camera, Check, FlaskConical, MessageCircle, QrCode, ScanFace, Store, Truck, Wrench } from 'lucide-react';
import clsx from 'clsx';

/* ============================================================
 * « Le voyage d'une paire de lunettes » : récit au défilement.
 * Grand écran : scène collante (sticky) pilotée par la position de
 * défilement — le colis suit le trajet magasin → labo → magasin.
 * Mobile et « animations réduites » : frise verticale statique.
 * ============================================================ */

/**
 * Élément qui défile réellement : #root (html et body sont à hauteur fixe,
 * cf. styles/index.css). Les animations liées au défilement s'y branchent.
 */
export function useScrollRoot(): RefObject<HTMLElement> {
  return useRef<HTMLElement>(typeof document === 'undefined' ? null : document.getElementById('root'));
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

const CHAPTERS = [
  { key: 'c1', icon: ScanFace },
  { key: 'c2', icon: QrCode },
  { key: 'c3', icon: Truck },
  { key: 'c4', icon: FlaskConical },
  { key: 'c5', icon: Wrench },
  { key: 'c6', icon: MessageCircle },
] as const;

/* Trajet dans un repère 600 × 600 : aller (magasin → labo) puis retour. */
const STORE = { x: 110, y: 470 };
const LAB = { x: 490, y: 130 };
const GO = 'M110 470 C 230 470 230 330 320 300 S 450 160 490 130';
const BACK = 'M490 130 C 560 260 470 430 300 470 S 160 480 110 470';

const ease = [0.16, 0.84, 0.3, 1] as const;

/** Petit cadre de téléphone autour d'une capture réelle. */
function MiniPhone({ src, className, children }: { src: string; className?: string; children?: ReactNode }) {
  return (
    <div className={clsx('relative rounded-[26px] bg-[#0f172a] p-1.5 shadow-card-lg', className)}>
      <img src={src} width={520} height={1040} alt="" loading="lazy" decoding="async" className="block h-auto w-full rounded-[20px]" />
      {children}
    </div>
  );
}

/** Nombre qui s'anime jusqu'à sa valeur (décimales à la française selon la langue). */
function Counter({ to, decimals = 0, suffix = '' }: { to: number; decimals?: number; suffix?: string }) {
  const { i18n } = useTranslation();
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 1.1, ease, onUpdate: setV });
    return () => c.stop();
  }, [to]);
  return (
    <span className="tabular-nums">
      {v.toLocaleString(i18n.language, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** QR décoratif (motif déterministe) — le vrai QR ne porte qu'un code opaque. */
function FakeQr() {
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    let seed = 7;
    for (let y = 0; y < 13; y++)
      for (let x = 0; x < 13; x++) {
        seed = (seed * 9301 + 49297) % 233280;
        const finder = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8);
        if (!finder && seed / 233280 > 0.52) out.push([x, y]);
      }
    return out;
  }, []);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={3.4} height={3.4} rx={0.6} fill="none" stroke="currentColor" strokeWidth={0.8} />
      <rect x={x + 1} y={y + 1} width={1.4} height={1.4} rx={0.3} fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox="-0.5 -0.5 14 14" className="h-24 w-24 text-content" aria-hidden>
      {finder(0, 0)}
      {finder(9.1, 0)}
      {finder(0, 9.1)}
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x + 0.1} y={y + 0.1} width={0.8} height={0.8} rx={0.15} fill="currentColor" />
      ))}
    </svg>
  );
}

/* ---------------- Visuels de chaque chapitre ---------------- */

function VisualMeasure() {
  const { t } = useTranslation();
  return (
    <div className="w-[270px] rounded-3xl border border-line bg-surface p-5 shadow-card-lg">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-content">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10">
          <ScanFace className="h-4 w-4 text-primary" aria-hidden />
        </span>
        {t('landing.story.vMeasure')}
      </div>
      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-content-muted">{t('landing.story.vPd')}</dt>
          <dd className="font-bold text-content">
            <Counter to={31.5} decimals={1} /> / <Counter to={32} decimals={1} suffix=" mm" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-content-muted">{t('landing.story.vHeight')}</dt>
          <dd className="font-bold text-content">
            <Counter to={22} decimals={1} suffix=" mm" />
          </dd>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between">
            <dt className="text-content-muted">{t('landing.story.vReliability')}</dt>
            <dd className="font-bold text-success">
              <Counter to={92} suffix=" %" />
            </dd>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-success"
              initial={{ width: 0 }}
              animate={{ width: '92%' }}
              transition={{ duration: 1.1, ease }}
            />
          </div>
        </div>
      </dl>
    </div>
  );
}

function VisualOrder() {
  const { t } = useTranslation();
  return (
    <div className="flex w-[290px] items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card-lg">
      <motion.div initial={{ rotate: -8, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
        <FakeQr />
      </motion.div>
      <div className="min-w-0">
        <div className="font-mono text-sm font-bold text-content">OT-2026-000003</div>
        <div className="mt-1 text-sm font-semibold text-primary">{t('landing.story.vOrder')}</div>
        <div className="mt-2 text-xs leading-snug text-content-muted">{t('landing.story.vNoData')}</div>
      </div>
    </div>
  );
}

function VisualTransit() {
  const { t } = useTranslation();
  return (
    <div className="w-[280px] rounded-3xl border border-line bg-surface p-5 shadow-card-lg">
      <div className="flex items-center gap-3">
        <motion.span
          className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10"
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Truck className="h-5 w-5 text-accent" aria-hidden />
        </motion.span>
        <div>
          <div className="text-sm font-bold text-content">{t('landing.story.vTransit')}</div>
          <div className="text-xs text-content-muted">{t('landing.story.vTransitSub')}</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-accent/30 via-accent to-accent/30"
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

function VisualLabScan() {
  return (
    <MiniPhone src="/images/landing/portail.webp" className="w-[190px] overflow-hidden">
      <motion.div
        className="pointer-events-none absolute inset-x-1.5 h-1 rounded-full bg-primary shadow-[0_0_18px_4px_rgba(124,58,237,0.55)]"
        initial={{ top: '12%' }}
        animate={{ top: ['12%', '88%', '12%'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </MiniPhone>
  );
}

function VisualFitting() {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <MiniPhone src="/images/landing/portail-montage.webp" className="w-[190px]" />
      <motion.div
        className="absolute -left-24 top-10 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-card-lg"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 18 }}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-success/15">
          <Check className="h-4 w-4 text-success" aria-hidden />
        </span>
        <span className="text-sm font-bold text-content">{t('landing.story.vDone')}</span>
      </motion.div>
      <motion.div
        className="absolute -left-16 top-28 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-card-lg"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 18 }}
      >
        <Camera className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-xs font-semibold text-content">{t('landing.story.vPhoto')}</span>
      </motion.div>
    </div>
  );
}

function VisualCustomer() {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <MiniPhone src="/images/landing/suivi-client.webp" className="w-[190px]" />
      <motion.div
        className="absolute -left-28 top-6 w-[210px] rounded-2xl lg:-left-40 lg:w-[230px] rounded-tr-sm bg-[#dcf8c6] px-3.5 py-2.5 text-[13px] leading-snug text-[#111b21] shadow-card-lg"
        initial={{ scale: 0.5, opacity: 0, x: 30 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 240, damping: 18 }}
      >
        {t('landing.story.vWa')}
        <span className="mt-1 block truncate font-semibold text-[#027eb5]">oculosaas.com/track/…</span>
        <span className="mt-1 block text-right text-[10px] text-[#667781]">10:00 ✓✓</span>
      </motion.div>
    </div>
  );
}

const VISUALS = [VisualMeasure, VisualOrder, VisualTransit, VisualLabScan, VisualFitting, VisualCustomer];
/* Côté magasin (en haut à gauche) pour les étapes 1-3, côté labo / client sinon. */
const VISUAL_POS = [
  'left-[6%] top-[8%]',
  'left-[6%] top-[8%]',
  'left-[6%] top-[8%]',
  'right-[8%] bottom-[6%]',
  'right-[8%] bottom-[6%]',
  'right-[8%] bottom-[6%]',
];

/* ---------------- Grand écran : scène collante ---------------- */

function useRoutePoint(travel: MotionValue<number>) {
  const go = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);
  const x = useMotionValue(STORE.x);
  const y = useMotionValue(STORE.y);
  const place = (t: number) => {
    const path = t <= 0.5 ? go.current : back.current;
    if (!path) return;
    const k = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
    const p = path.getPointAtLength(path.getTotalLength() * Math.min(1, Math.max(0, k)));
    x.set(p.x);
    y.set(p.y);
  };
  useMotionValueEvent(travel, 'change', place);
  useEffect(() => place(travel.get()), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { go, back, x, y };
}

function StoryStage({ active, travel }: { active: number; travel: MotionValue<number> }) {
  const { t } = useTranslation();
  const { go, back, x, y } = useRoutePoint(travel);
  const left = useTransform(x, (v) => `${v / 6}%`);
  const top = useTransform(y, (v) => `${v / 6}%`);
  const goLen = useTransform(travel, [0, 0.5], [0, 1]);
  const backLen = useTransform(travel, [0.5, 1], [0, 1]);
  const Visual = VISUALS[active];
  const atStore = active <= 2 || active === 5;
  const atLab = active === 3 || active === 4;
  const Icon = CHAPTERS[active].icon;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[600px] overflow-hidden rounded-[40px] border border-line bg-surface/70 shadow-card-lg backdrop-blur">
      <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="story-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="rgba(15,23,42,0.08)" />
          </pattern>
          <linearGradient id="story-route" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="55%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <rect width="600" height="600" fill="url(#story-dots)" />
        <path d={GO} fill="none" stroke="rgba(15,23,42,0.12)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
        <path d={BACK} fill="none" stroke="rgba(15,23,42,0.12)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
        <motion.path ref={go} d={GO} fill="none" stroke="url(#story-route)" strokeWidth="5" strokeLinecap="round" style={{ pathLength: goLen }} />
        <motion.path ref={back} d={BACK} fill="none" stroke="url(#story-route)" strokeWidth="5" strokeLinecap="round" style={{ pathLength: backLen }} />
      </svg>

      {/* Étapes fixes : magasin et laboratoire */}
      {[
        { at: STORE, on: atStore, icon: Store, label: t('landing.story.store'), above: false },
        // Étiquette du labo au-dessus : en dessous, le trajet la traverse.
        { at: LAB, on: atLab, icon: FlaskConical, label: t('landing.story.lab'), above: true },
      ].map((n) => (
        <div
          key={n.label}
          className={clsx('absolute flex -translate-x-1/2 flex-col items-center', n.above ? 'flex-col-reverse' : '')}
          style={{ left: `${n.at.x / 6}%`, top: `${n.at.y / 6}%`, translate: n.above ? '0 calc(-100% + 32px)' : '0 -32px' }}
        >
          <motion.div
            className="relative grid h-16 w-16 place-items-center rounded-2xl border bg-surface shadow-card"
            animate={{
              scale: n.on ? 1.08 : 1,
              borderColor: n.on ? 'rgba(124,58,237,0.5)' : 'rgba(15,23,42,0.08)',
            }}
            transition={{ duration: 0.4 }}
          >
            {n.on && (
              <motion.span
                className="absolute inset-0 rounded-2xl bg-primary/20"
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <n.icon className={clsx('h-7 w-7', n.on ? 'text-primary' : 'text-content-muted')} aria-hidden />
          </motion.div>
          <div className="my-2 text-center text-xs font-bold uppercase tracking-wider text-content-muted">{n.label}</div>
        </div>
      ))}

      {/* Le colis : suit le trajet au rythme du défilement */}
      <motion.div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left, top }}>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-[0_10px_30px_-6px_rgba(124,58,237,0.7)] ring-4 ring-white">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={active}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              transition={{ duration: 0.22 }}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Visuel du chapitre en cours */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          className={clsx('absolute z-20', VISUAL_POS[active])}
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.18 } }}
          transition={{ duration: 0.45, ease }}
        >
          <Visual />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StoryScrolly() {
  const { t } = useTranslation();
  const target = useRef<HTMLDivElement>(null);
  const root = useScrollRoot();
  const { scrollYProgress } = useScroll({ target, container: root, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.35 });
  const travel = useTransform(progress, [0, 2 / 6, 3 / 6, 5 / 6, 1], [0, 0, 0.5, 0.5, 1]);
  const bar = useTransform(progress, [0, 1], [0, 1]);
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(5, Math.max(0, Math.floor(v * 6)))));

  /** Clic sur une étape : défile jusqu'au milieu de son chapitre. */
  function jump(i: number) {
    const el = target.current;
    const sc = root.current;
    if (!el || !sc) return;
    const start = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    const span = el.offsetHeight - sc.clientHeight;
    sc.scrollTo({ top: start + span * ((i + 0.5) / 6), behavior: 'smooth' });
  }

  const ch = CHAPTERS[active];
  return (
    <div ref={target} className="relative" style={{ height: `${CHAPTERS.length * 85 + 100}vh` }}>
      <div className="sticky top-0 flex h-[100dvh] items-center pt-16">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-14 px-8">
          <div>
            {/* Frise des 6 étapes, remplie au fil du défilement */}
            <div className="relative mb-12">
              <div className="absolute left-5 right-5 top-5 h-[3px] rounded-full bg-line" />
              <motion.div
                className="absolute left-5 right-5 top-5 h-[3px] origin-left rounded-full bg-brand"
                style={{ scaleX: bar }}
              />
              <ol className="relative flex justify-between">
                {CHAPTERS.map((c, i) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => jump(i)}
                      aria-label={`${t('landing.story.step')} ${i + 1} : ${t(`landing.story.${c.key}.title`)}`}
                      aria-current={i === active ? 'step' : undefined}
                      className={clsx(
                        'grid h-11 w-11 cursor-pointer place-items-center rounded-full border-2 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                        i <= active ? 'border-transparent bg-brand text-white' : 'border-line bg-surface text-content-muted hover:text-content',
                      )}
                    >
                      <c.icon className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            <div className="relative min-h-[300px]" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={ch.key}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.5, ease }}
                >
                  <div className="mb-3 flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-accent">
                    <span className="rounded-full bg-accent/10 px-3 py-1">
                      {t('landing.story.step')} {active + 1}/6
                    </span>
                    {t(`landing.story.${ch.key}.time`)}
                  </div>
                  <h3 className="text-balance font-display text-4xl font-extrabold leading-tight text-content xl:text-5xl">
                    {t(`landing.story.${ch.key}.title`)}
                  </h3>
                  <p className="mt-5 max-w-[480px] text-lg leading-relaxed text-content-muted">
                    {t(`landing.story.${ch.key}.text`)}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <StoryStage active={active} travel={travel} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Mobile / animations réduites : frise verticale ---------------- */

function StoryItem({ index, children }: { index: number; children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  const root = useScrollRoot();
  const inView = useInView(ref, { root, once: true, margin: '0px 0px -15% 0px' });
  const reduce = useReducedMotion();
  return (
    <motion.li
      ref={ref}
      className="relative pl-16"
      initial={reduce ? false : { opacity: 0, y: 40 }}
      animate={inView || reduce ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, ease, delay: 0.05 * index }}
    >
      {children}
    </motion.li>
  );
}

function StoryList() {
  const { t } = useTranslation();
  const ref = useRef<HTMLOListElement>(null);
  const root = useScrollRoot();
  const { scrollYProgress } = useScroll({ target: ref, container: root, offset: ['start 70%', 'end 60%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  return (
    <div className="relative mx-auto mt-14 max-w-xl pb-8">
      <div className="absolute bottom-8 left-[21px] top-0 w-[3px] rounded-full bg-line" aria-hidden />
      <motion.div className="absolute bottom-8 left-[21px] top-0 w-[3px] origin-top rounded-full bg-brand" style={{ scaleY: fill }} aria-hidden />
      <ol ref={ref} className="relative flex flex-col gap-14">
      {CHAPTERS.map((c, i) => {
        const Visual = VISUALS[i];
        return (
          <StoryItem key={c.key} index={i}>
            <span className="absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full bg-brand text-white shadow-card">
              <c.icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="text-xs font-bold uppercase tracking-widest text-accent">{t(`landing.story.${c.key}.time`)}</div>
            <h3 className="mt-1 font-display text-2xl font-extrabold text-content">{t(`landing.story.${c.key}.title`)}</h3>
            <p className="mt-2 leading-relaxed text-content-muted">{t(`landing.story.${c.key}.text`)}</p>
            <div className={clsx('mt-5 flex', i >= 3 ? 'justify-end pr-2' : '')}>
              <Visual />
            </div>
          </StoryItem>
        );
      })}
      </ol>
    </div>
  );
}

export function StorySection() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const wide = useMediaQuery('(min-width: 1024px)');
  return (
    <section id="histoire" className="relative scroll-mt-20 px-4 pt-24 sm:px-8">
      <div className="mx-auto max-w-[1280px] text-center">
        <span className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          {t('landing.story.eyebrow')}
        </span>
        <h2 className="mx-auto max-w-3xl text-balance font-display text-3xl font-extrabold text-content sm:text-5xl">
          {t('landing.story.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-content-muted">{t('landing.story.subtitle')}</p>
      </div>
      {wide && !reduce ? <StoryScrolly /> : <StoryList />}
    </section>
  );
}
