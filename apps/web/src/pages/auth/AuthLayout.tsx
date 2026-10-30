import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Glasses, PackageCheck, ShieldCheck, ShoppingCart, Smartphone, Store } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from '../../components/Logo';
import { LanguagePicker } from '../../components/LanguagePicker';
import { Mascot } from '../../components/brand/Mascot';
import { tr } from '../../lib/tr';
import { EyeChartScene, MirrorScene, PhotoBackdrop, SpeechBubble } from './AuthScenes';

// Atouts de la plateforme, en cartes larges aux teintes de la marque :
// une série pour la connexion, une autre pour la création de compte.
const FEATURES = {
  login: [
    { icon: Smartphone, title: 'auth.arcade.loginFeat1', desc: 'auth.panelFeat1', bg: '#ede9fe', tile: '#ddd6fe', shadow: '#7c3aed' },
    { icon: Store, title: 'auth.arcade.loginFeat2', desc: 'auth.panelFeat2', bg: '#fce7f3', tile: '#fbcfe8', shadow: '#ec4899' },
    { icon: ShieldCheck, title: 'auth.arcade.loginFeat3', desc: 'auth.panelFeat3', bg: '#ffedd5', tile: '#fed7aa', shadow: '#f97316' },
  ],
  signup: [
    { icon: ShoppingCart, title: 'auth.arcade.signupFeat1', desc: 'auth.arcade.signupFeat1Desc', bg: '#fce7f3', tile: '#fbcfe8', shadow: '#ec4899' },
    { icon: Glasses, title: 'auth.arcade.signupFeat2', desc: 'auth.arcade.signupFeat2Desc', bg: '#e0e7ff', tile: '#c7d2fe', shadow: '#7c3aed' },
    { icon: PackageCheck, title: 'auth.arcade.signupFeat3', desc: 'auth.arcade.signupFeat3Desc', bg: '#ffedd5', tile: '#fed7aa', shadow: '#f97316' },
  ],
};

// Pastilles « optiques » qui flottent autour de la scène.
const CHIPS = {
  login: ['auth.arcade.chipL1', 'auth.arcade.chipL2', 'auth.arcade.chipL3'],
  signup: ['auth.arcade.chipS1', 'auth.arcade.chipS2', 'auth.arcade.chipS3'],
};
const CHIP_STYLE = [
  { pos: '-left-2 top-[8%]', bg: '#ddd6fe', shadow: '#7c3aed', delay: 0 },
  { pos: '-right-2 top-[38%]', bg: '#fbcfe8', shadow: '#ec4899', delay: 0.8 },
  { pos: 'left-[30%] -bottom-3', bg: '#fed7aa', shadow: '#f97316', delay: 1.6 },
];

/**
 * Agrandit la scène d'un seul bloc (×1,6 tablette, ×1,45 ordinateur) : les
 * proportions restent celles du téléphone, la baguette vise donc toujours
 * la bonne ligne. Halo, sol lumineux et pastilles flottantes en décor.
 */
function ScaledScene({ height, chips, children }: { height: number; chips: string[]; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div
      className="relative mx-auto w-full max-w-[350px] [--k:1.6] md:h-[calc(var(--h)*var(--k))] md:w-[calc(350px*var(--k))] md:max-w-none xl:[--k:1.35]"
      style={{ '--h': `${height}px` } as CSSProperties}
    >
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.35),transparent_65%)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-2 left-1/2 -z-10 h-6 w-[85%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(236,72,153,0.45),transparent_70%)] blur-md" />
      <div className="md:absolute md:left-0 md:top-0 md:w-[350px] md:origin-top-left md:[transform:scale(var(--k))]">{children}</div>
      {chips.map((c, i) => (
        <motion.span
          key={c}
          aria-hidden
          className={clsx('absolute hidden whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold text-[#120a2b] md:block', CHIP_STYLE[i].pos)}
          style={{ background: CHIP_STYLE[i].bg, boxShadow: `3px 3px 0 ${CHIP_STYLE[i].shadow}` }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3.2, delay: CHIP_STYLE[i].delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {t(c)}
        </motion.span>
      ))}
    </div>
  );
}

/** Progression de l'inscription, présentée comme des niveaux de jeu. */
export type AuthLevel = { current: number; total: number; label: string };

/** Grande monture dessinée en filigrane. */
function GlassesOutline({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="-50 0 450 180" className={className} fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round">
      <rect x="10" y="30" width="160" height="130" rx="58" />
      <rect x="230" y="30" width="160" height="130" rx="58" />
      <path d="M170 72 q30 -26 60 0" />
      <path d="M10 70 L-40 40" />
    </svg>
  );
}

/**
 * Écrans d'accès « Arcade Pro » : panneau sombre (nuit violette) à bord
 * diagonal avec l'accroche, les atouts et Oculo l'ourson opticien en scène
 * (examen de vue à la connexion, essayage au miroir à l'inscription) ;
 * panneau clair pour le formulaire, avec les étapes numérotées.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  say,
  level,
  scene,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Ce que dit Oculo dans sa bulle (par défaut : le sous-titre). */
  say?: string;
  level?: AuthLevel;
  /** Scène animée : examen de vue (connexion) ou essayage (création). */
  scene?: 'login' | 'signup';
}) {
  const { t } = useTranslation();
  const bubble = say ?? subtitle;
  const kind = scene ?? 'login';

  const heading =
    kind === 'signup' ? (
      <>
        {t('auth.arcade.signupHeroA')} <span className="text-gradient">{t('auth.arcade.signupHeroB')}</span>
      </>
    ) : (
      <>
        {tr('auth.heroTitleA')} <span className="text-gradient">{tr('auth.heroTitleB')}</span>
      </>
    );

  const sceneNode = (compact: boolean) =>
    scene === 'login' ? (
      <EyeChartScene compact={compact} />
    ) : scene === 'signup' ? (
      <MirrorScene say={bubble} compact={compact} />
    ) : (
      <div className="flex items-end gap-3">
        <Mascot className="w-[110px] shrink-0 sm:w-[150px]" />
        <div className="min-w-0 flex-1 pb-6">
          <SpeechBubble text={bubble} className="rounded-bl-sm" />
        </div>
      </div>
    );

  return (
    <div className="auth-shell min-h-screen bg-[#faf8ff] xl:grid xl:grid-cols-[1.3fr_1fr]">
      {/* Panneau sombre : accroche, atouts, scène du nounours */}
      <aside className="auth-panel dark relative isolate overflow-hidden bg-[#120a2b] text-white">
        <PhotoBackdrop />

        <div className="relative flex h-full flex-col px-5 pb-10 pt-5 sm:px-10 xl:pb-12 xl:pl-14 xl:pr-20 xl:pt-10">
          <div className="flex items-center justify-between">
            <Link to="/" aria-label="OculoSaaS">
              <Logo />
            </Link>
            <div className="xl:hidden">
              <LanguagePicker />
            </div>
          </div>

          <h1 className="mt-8 max-w-[640px] font-arcade text-[28px] leading-[1.02] sm:text-[38px] xl:mt-10 xl:text-[46px]">{heading}</h1>
          <p className="mt-3 max-w-[520px] text-sm text-white/75 sm:text-base xl:mt-5 xl:text-lg">
            {t(kind === 'signup' ? 'auth.arcade.signupTagline' : 'auth.arcade.loginTagline')}
          </p>

          {/* Scène du nounours, agrandie d'un bloc sur tablette et ordinateur */}
          <div className="flex flex-1 items-center justify-center py-6 md:py-10 xl:py-5">
            <ScaledScene height={scene === 'signup' ? 270 : 230} chips={CHIPS[kind]}>
              {sceneNode(true)}
            </ScaledScene>
          </div>

          {/* Atouts en cartes (tablette et ordinateur) */}
          <ul className="hidden grid-cols-3 gap-3 md:grid">
            {FEATURES[kind].map((f) => (
              <li
                key={f.title}
                className="flex flex-col rounded-[20px] p-4 text-[#120a2b]"
                style={{ background: f.bg, boxShadow: `5px 5px 0 ${f.shadow}` }}
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: f.tile }}>
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="mt-3 block text-sm font-extrabold">{t(f.title)}</span>
                <span className="mt-1 block text-[12px] leading-snug text-[#120a2b]/70">{t(f.desc)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Panneau clair : formulaire */}
      <main className="light relative isolate flex flex-col overflow-hidden bg-[#faf8ff] text-content">
        <GlassesOutline className="pointer-events-none absolute -bottom-10 -right-24 -z-10 w-[420px] rotate-[-10deg] text-[#7c3aed]/[0.07]" />
        <div className="hidden justify-end px-10 pt-8 xl:flex">
          <LanguagePicker />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[460px] animate-fade-in">
            {level && <Stepper level={level} />}
            {level && (
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-content-faint">
                {t('auth.arcade.level', { current: level.current, total: level.total })}
              </p>
            )}
            <h2 className="font-arcade text-[28px] leading-[1.05] text-[#120a2b] sm:text-[36px]">{title}</h2>
            <p className="mt-3 text-sm text-content-muted sm:text-base">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
        <p className="pb-6 text-center text-[11px] text-content-faint">{tr('ui.AuthLayout.n2026OculosaasAfrique')}</p>
      </main>
    </div>
  );
}

/** Étapes numérotées de l'inscription (cercles reliés par une ligne). */
function Stepper({ level }: { level: AuthLevel }) {
  const { t } = useTranslation();
  return (
    <ol className="relative isolate mb-8 grid" style={{ gridTemplateColumns: `repeat(${level.total}, 1fr)` }}>
      {Array.from({ length: level.total }, (_, i) => {
        const n = i + 1;
        const done = n < level.current;
        const active = n === level.current;
        return (
          <li key={n} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span className="absolute right-1/2 top-[18px] -z-10 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-[#e9e5f5]">
                <motion.span
                  className="block h-full bg-brand"
                  initial={false}
                  animate={{ width: n <= level.current ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </span>
            )}
            <span
              className={clsx(
                'grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold transition-all duration-300',
                active && 'bg-brand text-white shadow-[0_3px_0_#4c1d95]',
                done && 'bg-[#7c3aed] text-white',
                !active && !done && 'bg-[#ece8f7] text-[#8a80a8]',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </span>
            <span className={clsx('mt-2 text-[11px] sm:text-xs', active ? 'font-bold text-[#120a2b]' : 'text-content-faint')}>
              {t(`auth.arcade.step${n}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
