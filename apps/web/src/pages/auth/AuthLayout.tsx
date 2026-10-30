import { type ReactNode } from 'react';
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

          <h1 className="mt-8 max-w-[640px] font-arcade text-[28px] leading-[1.02] sm:text-[38px] xl:mt-14 xl:text-[48px]">{heading}</h1>
          <p className="mt-3 max-w-[520px] text-sm text-white/75 sm:text-base xl:mt-5 xl:text-lg">
            {t(kind === 'signup' ? 'auth.arcade.signupTagline' : 'auth.arcade.loginTagline')}
          </p>

          {/* Téléphone / tablette : la scène seule, centrée */}
          <div className="mx-auto mt-6 w-full max-w-[540px] xl:hidden">{sceneNode(false)}</div>

          {/* Ordinateur : atouts à gauche, scène à droite */}
          <div className="mt-10 hidden flex-1 items-end gap-4 xl:flex">
            <ul className="flex w-[300px] shrink-0 flex-col gap-4">
              {FEATURES[kind].map((f) => (
                <li
                  key={f.title}
                  className="flex items-center gap-4 rounded-[22px] px-4 py-3.5 text-[#120a2b]"
                  style={{ background: f.bg, boxShadow: `5px 5px 0 ${f.shadow}` }}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: f.tile }}>
                    <f.icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-extrabold">{t(f.title)}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-[#120a2b]/70">{t(f.desc)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="min-w-0 flex-1">{sceneNode(true)}</div>
          </div>
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
