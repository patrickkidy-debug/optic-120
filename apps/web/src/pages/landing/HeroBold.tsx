import { useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { Devices } from './DeviceShowcase';

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

const FACTS = ['stat1', 'stat2', 'stat3'] as const;
const SHADOWS = ['#7c3aed', '#ec4899', '#f97316'];

export function HeroBold() {
  const { t } = useTranslation();

  // Police d'affichage chargée seulement sur la landing.
  useEffect(() => {
    if (document.querySelector(`link[href="${BOLD_FONT}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = BOLD_FONT;
    document.head.appendChild(l);
  }, []);

  return (
    <section style={{ ...DARK_BAND, background: NIGHT }} className="relative isolate overflow-hidden px-4 pb-14 pt-8 text-white sm:px-8 sm:pb-20 sm:pt-12 lg:pb-24 lg:pt-16">
      {/* Halos de la marque */}
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-[#7c3aed]/35 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-24 -z-10 h-[460px] w-[460px] rounded-full bg-[#ec4899]/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-180px] left-1/3 -z-10 h-[420px] w-[420px] rounded-full bg-[#f97316]/20 blur-[120px]" />

      <div className="mx-auto grid max-w-[1280px] items-center gap-8 sm:gap-14 xl:grid-cols-[0.95fr_1.05fr] xl:gap-8">
        {/* Texte */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-[#f0abfc]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/85">{t('landing.heroBadge')}</span>
          </span>
          <h1 className="mt-6 text-[38px] leading-[0.95] sm:text-[60px] lg:text-[68px] xl:text-[72px]" style={DISPLAY}>
            {t('landing.heroTitleA')}
            <br />
            <span className="text-gradient">{t('landing.heroTitleAccent')}</span>
          </h1>
          <p className="mt-4 max-w-[560px] text-xl font-semibold leading-snug sm:mt-6 sm:text-[28px]">
            <span className="text-gradient">{t('landing.heroTitleB')}</span>
          </p>
          <p className="mt-5 hidden max-w-[540px] text-base leading-relaxed text-white/70 sm:block sm:text-lg">{t('landing.heroSubtitle')}</p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
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

        {/* Visuel : le vrai logiciel sur ordinateur et téléphone, Oculo assis sur l'écran */}
        <div className="relative mx-auto w-full max-w-[640px]">
          <Devices />
        </div>
      </div>

      {/* Chiffres réels du produit */}
      <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-3 gap-2.5 sm:mt-16 sm:gap-5">
        {FACTS.map((k, i) => (
          <div
            key={k}
            className="rounded-2xl border border-white/20 px-3 py-3 sm:rounded-[22px] sm:px-6 sm:py-5"
            style={{ background: NIGHT, boxShadow: `6px 6px 0 ${SHADOWS[i]}` }}
          >
            <div className="text-xl sm:text-4xl" style={DISPLAY}>
              {t(`landing.${k}`)}
            </div>
            <div className="mt-1 text-[11px] font-medium leading-tight text-white/75 sm:mt-2 sm:text-sm">{t(`landing.${k}Label`)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
