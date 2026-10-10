import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeftRight,
  BarChart3,
  Barcode,
  BellRing,
  Boxes,
  Cake,
  CalendarDays,
  ClipboardList,
  Coins,
  Contact,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Glasses,
  Layers,
  LayoutDashboard,
  LineChart,
  Link2,
  ListChecks,
  Lock,
  PackageSearch,
  Printer,
  ReceiptText,
  Ruler,
  ScanLine,
  Scissors,
  ScrollText,
  ShieldCheck,
  ShieldHalf,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Store,
  Truck,
  UserCog,
  Users,
  Wallet,
  WifiOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useScrollRoot } from './Story';

/* ============================================================
 * « Tout ce que vous pouvez faire » : explorateur de tous les
 * modules du logiciel, par domaine. Contenu vérifié dans le code
 * (une fonctionnalité = un écran ou une action réelle).
 * ============================================================ */

type Feature = { key: string; icon: LucideIcon; isNew?: boolean };
type Category = { key: string; icon: LucideIcon; tone: string; items: Feature[] };

const CATEGORIES: Category[] = [
  {
    key: 'sell',
    icon: ShoppingCart,
    tone: 'from-violet-500 to-fuchsia-500',
    items: [
      { key: 'pos', icon: ShoppingCart },
      { key: 'quotes', icon: FileText },
      { key: 'sales', icon: ReceiptText },
      { key: 'cash', icon: Lock },
      { key: 'docs', icon: Printer },
      { key: 'insurancePos', icon: ShieldCheck },
    ],
  },
  {
    key: 'stock',
    icon: Boxes,
    tone: 'from-orange-500 to-amber-500',
    items: [
      { key: 'catalog', icon: Glasses },
      { key: 'import', icon: FileSpreadsheet },
      { key: 'stock', icon: Boxes },
      { key: 'transfer', icon: ArrowLeftRight },
      { key: 'inventory', icon: ScanLine },
      { key: 'labels', icon: Barcode },
    ],
  },
  {
    key: 'clients',
    icon: Contact,
    tone: 'from-pink-500 to-rose-500',
    items: [
      { key: 'file', icon: Contact },
      { key: 'measure', icon: Ruler, isNew: true },
      { key: 'renewals', icon: BellRing },
      { key: 'birthdays', icon: Cake },
      { key: 'tracking', icon: Link2, isNew: true },
      { key: 'clientsIo', icon: Users },
    ],
  },
  {
    key: 'workshop',
    icon: FlaskConical,
    tone: 'from-cyan-600 to-sky-500',
    items: [
      { key: 'lensOrders', icon: Layers },
      { key: 'labSheet', icon: ClipboardList },
      { key: 'oculotrack', icon: PackageSearch, isNew: true },
      { key: 'portal', icon: FlaskConical, isNew: true },
      { key: 'repairs', icon: Wrench },
      { key: 'suppliers', icon: Truck, isNew: true },
    ],
  },
  {
    key: 'clinic',
    icon: Stethoscope,
    tone: 'from-emerald-600 to-teal-500',
    items: [
      { key: 'patients', icon: Users },
      { key: 'consult', icon: Stethoscope },
      { key: 'appts', icon: CalendarDays },
      { key: 'surgery', icon: Scissors },
      { key: 'clinicDash', icon: LayoutDashboard },
    ],
  },
  {
    key: 'manage',
    icon: LineChart,
    tone: 'from-indigo-500 to-violet-500',
    items: [
      { key: 'dashboard', icon: LineChart },
      { key: 'reports', icon: BarChart3 },
      { key: 'receivables', icon: Coins },
      { key: 'finance', icon: Wallet },
      { key: 'expenses', icon: ArrowDownUp },
      { key: 'insurance', icon: ShieldCheck },
      { key: 'hr', icon: UserCog },
    ],
  },
  {
    key: 'team',
    icon: ShieldHalf,
    tone: 'from-slate-700 to-slate-500',
    items: [
      { key: 'roles', icon: ShieldHalf },
      { key: 'branches', icon: Store },
      { key: 'audit', icon: ScrollText },
      { key: 'anomalies', icon: AlertTriangle },
      { key: 'offline', icon: WifiOff },
      { key: 'apps', icon: Smartphone },
      { key: 'setup', icon: ListChecks },
    ],
  },
];

const ALL = CATEGORIES.flatMap((c) => c.items);
const DELAY = 7000;

/** Bandeau défilant de tous les outils (décoratif : la liste lisible est plus bas). */
function Ribbon({ items, reverse }: { items: Feature[]; reverse?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="mq-wrap" aria-hidden>
      <div className={clsx('mq-track py-1.5', reverse && 'rev')} style={{ animationDuration: '70s' }}>
        {[...items, ...items].map((f, i) => (
          <span
            key={`${f.key}-${i}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-content shadow-card"
          >
            <f.icon className="h-4 w-4 text-primary" />
            {t(`landing.all.f.${f.key}.title`)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AllFeatures() {
  const { t } = useTranslation();
  const [cat, setCat] = useState(0);
  const [auto, setAuto] = useState(true);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const root = useScrollRoot();
  const visible = useInView(sectionRef, { root, amount: 0.3 });
  const reduce = useReducedMotion();
  const playing = auto && visible && !reduce;

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setCat((v) => (v + 1) % CATEGORIES.length), DELAY);
    return () => window.clearTimeout(id);
  }, [playing, cat]);

  function choose(i: number) {
    setAuto(false);
    setCat(i);
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (cat + (e.key === 'ArrowRight' ? 1 : CATEGORIES.length - 1)) % CATEGORIES.length;
    choose(next);
    tabs.current[next]?.focus();
  }

  const c = CATEGORIES[cat];
  const half = Math.ceil(ALL.length / 2);

  return (
    <section ref={sectionRef} id="fonctionnalites" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-[1280px] px-4 text-center sm:px-8">
        <span className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          {t('landing.all.eyebrow')}
        </span>
        <h2 className="mx-auto max-w-3xl text-balance font-display text-3xl font-extrabold text-content sm:text-5xl">
          {t('landing.all.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-content-muted">{t('landing.all.subtitle', { count: ALL.length })}</p>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <Ribbon items={ALL.slice(0, half)} />
        <Ribbon items={ALL.slice(half)} reverse />
      </div>

      <div className="mx-auto mt-14 max-w-[1280px] px-4 sm:px-8">
        <div
          role="tablist"
          aria-label={t('landing.all.title')}
          onKeyDown={onKeyDown}
          className="mb-10 flex flex-wrap justify-center gap-2"
        >
          {CATEGORIES.map((k, i) => (
            <button
              key={k.key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`all-tab-${k.key}`}
              aria-selected={i === cat}
              aria-controls="all-panel"
              tabIndex={i === cat ? 0 : -1}
              onClick={() => choose(i)}
              className={clsx(
                'relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                i === cat
                  ? 'border-transparent bg-brand text-white shadow-card'
                  : 'border-line bg-surface text-content-muted hover:border-primary/30 hover:text-content',
              )}
            >
              <k.icon className="h-4 w-4" aria-hidden />
              {t(`landing.all.cat.${k.key}.label`)}
              <span
                className={clsx(
                  'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                  i === cat ? 'bg-white/20 text-white' : 'bg-surface-2 text-content-muted',
                )}
              >
                {k.items.length}
              </span>
              {i === cat && playing && (
                <motion.span
                  key={cat}
                  className="absolute bottom-0 left-0 h-[3px] bg-white/70"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: DELAY / 1000, ease: 'linear' }}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>

        <div
          id="all-panel"
          role="tabpanel"
          aria-labelledby={`all-tab-${c.key}`}
          className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={c.key}
              initial={reduce ? false : { opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
              transition={{ duration: 0.4, ease: [0.16, 0.84, 0.3, 1] }}
              className="lg:pt-2"
            >
              <span className={clsx('grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-card-lg', c.tone)}>
                <c.icon className="h-8 w-8" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-3xl font-extrabold text-content">{t(`landing.all.cat.${c.key}.label`)}</h3>
              <p className="mt-3 text-lg leading-relaxed text-content-muted">{t(`landing.all.cat.${c.key}.lead`)}</p>
              <p className="mt-5 font-display text-5xl font-extrabold text-content">
                {c.items.length}
                <span className="ml-2 text-base font-semibold text-content-muted">{t('landing.all.tools')}</span>
              </p>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={c.key}
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: reduce ? 0 : 0.06 } },
                exit: { opacity: 0, transition: { duration: 0.15 } },
              }}
            >
              {c.items.map((f) => (
                <motion.li
                  key={f.key}
                  variants={{
                    hidden: reduce ? {} : { opacity: 0, y: 22, scale: 0.97 },
                    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 0.84, 0.3, 1] } },
                  }}
                  className="spotlight glass-card glass-hover relative flex h-full flex-col gap-3 rounded-3xl p-6"
                >
                  {f.isNew && (
                    <span className="absolute right-4 top-4 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent">
                      {t('landing.all.new')}
                    </span>
                  )}
                  <span className={clsx('grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white', c.tone)}>
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h4 className="font-display text-lg font-bold text-content">{t(`landing.all.f.${f.key}.title`)}</h4>
                  <p className="text-sm leading-relaxed text-content-muted">{t(`landing.all.f.${f.key}.text`)}</p>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
