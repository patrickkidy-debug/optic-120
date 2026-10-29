import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, FileText, Glasses, ScanFace, ShieldCheck, ShoppingCart, type LucideIcon } from 'lucide-react';
import { Mascot } from '../../components/brand/Mascot';
import { CenteringCard, RxCard } from './OpticTiles';

/** Fond de la bande sombre : nuit violette de la marque. */
export const NIGHT = '#120a2b';

/** Bande sombre (en-tête + hero) : textes clairs sur la nuit violette. */
export const DARK_BAND = {
  '--bg': NIGHT,
  '--bg-rgb': '18 10 43',
  '--surface-2-rgb': '38 28 72',
  '--text': '#ffffff',
  '--text-rgb': '255 255 255',
  '--text-muted': 'rgba(255,255,255,0.72)',
  '--text-muted-rgb': '214 208 232',
  '--border': 'rgba(255,255,255,0.14)',
  colorScheme: 'dark',
} as CSSProperties;

const BOLD_FONT = 'https://fonts.googleapis.com/css2?family=Bungee&display=swap';
const DISPLAY = { fontFamily: "'Bungee', 'Oxanium', sans-serif", letterSpacing: '-0.01em' } as CSSProperties;

// Vignettes du hero : quatre rubriques du métier d'opticien, en teintes de la marque.
// Montures et caisse sont de vraies captures recadrées ; ordonnance et centrage sont dessinés.
type Tile = {
  key: string;
  bg: string;
  icon: LucideIcon;
  rot: number;
  className: string;
  img?: { src: string; w: number; h: number; cls: string };
  body?: 'rx' | 'centering';
};
const TILES: Tile[] = [
  { key: 'frames', bg: '#fed7aa', icon: Glasses, rot: -1.5, className: 'col-span-2', img: { src: 'hero-montures', w: 1114, h: 225, cls: 'h-[96px] sm:h-[130px]' } },
  { key: 'pos', bg: '#fbcfe8', icon: ShoppingCart, rot: 2, className: 'row-span-2', img: { src: 'hero-caisse', w: 445, h: 570, cls: 'h-full min-h-[200px]' } },
  { key: 'rx', bg: '#ddd6fe', icon: FileText, rot: -2, className: '', body: 'rx' },
  { key: 'centering', bg: '#c7d2fe', icon: ScanFace, rot: 1.5, className: '', body: 'centering' },
];

const FACTS = ['stat1', 'stat2', 'stat3'] as const;
const TOASTS = ['heroToast1', 'heroToast2', 'heroToast3'] as const;
const SHADOWS = ['#7c3aed', '#ec4899', '#f97316'];

export function HeroBold() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [toast, setToast] = useState(0);

  // Police d'affichage chargée seulement sur la landing.
  useEffect(() => {
    if (document.querySelector(`link[href="${BOLD_FONT}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = BOLD_FONT;
    document.head.appendChild(l);
  }, []);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setToast((v) => (v + 1) % TOASTS.length), 2800);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <section style={{ ...DARK_BAND, background: NIGHT }} className="relative isolate overflow-hidden px-4 pb-20 pt-12 text-white sm:px-8 lg:pb-24 lg:pt-16">
      {/* Halos de la marque */}
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-[#7c3aed]/35 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-24 -z-10 h-[460px] w-[460px] rounded-full bg-[#ec4899]/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-180px] left-1/3 -z-10 h-[420px] w-[420px] rounded-full bg-[#f97316]/20 blur-[120px]" />

      <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[1.12fr_0.88fr] lg:gap-8">
        {/* Texte */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-[#f0abfc]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/85">{t('landing.heroBadge')}</span>
          </span>
          <h1 className="mt-6 text-[38px] leading-[0.95] sm:text-[60px] lg:text-[56px] xl:text-[72px]" style={DISPLAY}>
            {t('landing.heroTitleA')}
            <br />
            <span className="text-gradient">{t('landing.heroTitleAccent')}</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-2xl font-semibold leading-snug sm:text-[28px]">
            <span className="text-gradient">{t('landing.heroTitleB')}</span>
          </p>
          <p className="mt-5 max-w-[540px] text-base leading-relaxed text-white/70 sm:text-lg">{t('landing.heroSubtitle')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-4 text-base font-bold text-white shadow-[0_18px_40px_-14px_rgba(236,72,153,0.8)] transition hover:-translate-y-0.5"
            >
              {t('landing.useSoftware')} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="/downloads/OculoSaaS.apk"
              download
              aria-label={t('landing.downloadAndroid')}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-white/20 py-3 pl-4 pr-6 text-white transition hover:border-white/50 hover:bg-white/5"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-[#3ddc84]" fill="currentColor" aria-hidden="true">
                <path d="M17.6 9.48l1.84-3.18a.5.5 0 0 0-.86-.5l-1.87 3.23A11.3 11.3 0 0 0 12 8.08c-1.7 0-3.3.36-4.71.95L5.42 5.8a.5.5 0 0 0-.86.5L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
              </svg>
              <span className="text-left leading-tight">
                <span className="block text-[11px] font-medium text-white/60">{t('landing.androidSmall')}</span>
                <span className="block text-sm font-bold">{t('landing.androidBig')}</span>
              </span>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
            {(['check1', 'check2', 'check3'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#f0abfc]" /> {t(`landing.${k}`)}
              </span>
            ))}
          </div>
        </div>

        {/* Visuel : 4 rubriques du logiciel + Oculo, la mascotte */}
        <div className="relative mx-auto w-full max-w-[540px] pt-24 sm:pt-[132px]">
          <div className="relative grid grid-cols-2 gap-3 sm:gap-4">
            {TILES.map((tile, i) => (
              <motion.div
                key={tile.key}
                className={`relative flex flex-col ${tile.className}`}
                initial={{ opacity: 0, y: 24, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: tile.rot }}
                transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 160, damping: 18 }}
              >
                <motion.div
                  className="flex h-full flex-col rounded-[22px] p-1.5"
                  style={{ background: tile.bg, boxShadow: `5px 5px 0 ${SHADOWS[i % 3]}` }}
                  animate={reduce ? undefined : { y: [0, -6, 0] }}
                  transition={reduce ? undefined : { duration: 4.5 + i * 0.7, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                  whileHover={{ scale: 1.04, rotate: -tile.rot }}
                >
                  <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-[#120a2b]">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#120a2b]">
                      <tile.icon className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="truncate text-sm font-extrabold tracking-tight">{t(`landing.bold.tile.${tile.key}`)}</span>
                    <span className="ml-auto hidden truncate text-[11px] font-medium text-[#120a2b]/70 xl:inline">
                      {t(`landing.bold.tile.${tile.key}Hint`)}
                    </span>
                  </div>
                  <div className="min-h-[86px] flex-1 overflow-hidden rounded-[16px] bg-white sm:min-h-[112px]">
                    {tile.img && (
                      <img
                        src={`/images/landing/${tile.img.src}.webp`}
                        width={tile.img.w}
                        height={tile.img.h}
                        alt={t(`landing.bold.tile.${tile.key}`)}
                        fetchPriority={i === 0 ? 'high' : undefined}
                        className={`w-full object-cover object-left-top ${tile.img.cls}`}
                      />
                    )}
                    {tile.body === 'rx' && <RxCard />}
                    {tile.body === 'centering' && <CenteringCard />}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Oculo salue au-dessus des cartes, avec la notification « en direct » */}
          <Mascot className="absolute -right-2 -top-8 z-10 w-[112px] sm:-right-8 sm:-top-14 sm:w-[156px]" />
          <div className="absolute right-[100px] top-2 h-[60px] w-[240px] sm:right-[136px] sm:top-4" aria-hidden>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={toast}
                className="absolute right-0 top-0 flex items-center gap-3 rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-[#120a2b] shadow-[6px_6px_0_#7c3aed]"
                initial={{ opacity: 0, y: -14, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand">
                  <Check className="h-4 w-4 text-white" />
                </span>
                <span>
                  <span className="block whitespace-nowrap text-sm font-bold">{t(`landing.${TOASTS[toast]}`)}</span>
                  <span className="block text-xs text-[#120a2b]/60">{t('landing.heroToastSub')}</span>
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Chiffres réels du produit */}
      <div className="mx-auto mt-16 grid max-w-[1280px] gap-5 sm:grid-cols-3">
        {FACTS.map((k, i) => (
          <div
            key={k}
            className="rounded-[22px] border border-white/20 px-6 py-5"
            style={{ background: NIGHT, boxShadow: `6px 6px 0 ${SHADOWS[i]}` }}
          >
            <div className="text-4xl" style={DISPLAY}>
              {t(`landing.${k}`)}
            </div>
            <div className="mt-2 text-sm font-medium text-white/75">{t(`landing.${k}Label`)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
