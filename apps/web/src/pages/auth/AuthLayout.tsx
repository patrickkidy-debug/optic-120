import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Glasses, PackageCheck, ShieldCheck, ShoppingCart, Smartphone, Store } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { LanguagePicker } from '../../components/LanguagePicker';
import { Mascot } from '../../components/brand/Mascot';
import { tr } from '../../lib/tr';
import { EyeChartScene, MirrorScene, OpticalDisplayBackdrop, SpeechBubble } from './AuthScenes';

// Atouts de la plateforme, en cartes « sticker » aux teintes de la marque :
// une série pour la connexion, une autre pour la création de compte.
const FEATURES = {
  login: [
    { icon: Smartphone, key: 'auth.panelFeat1', bg: '#ddd6fe', shadow: '#7c3aed', rot: -2 },
    { icon: Store, key: 'auth.panelFeat2', bg: '#fbcfe8', shadow: '#ec4899', rot: 1.5 },
    { icon: ShieldCheck, key: 'auth.panelFeat3', bg: '#fed7aa', shadow: '#f97316', rot: -1 },
  ],
  signup: [
    { icon: ShoppingCart, key: 'auth.arcade.signupFeat1', bg: '#fbcfe8', shadow: '#ec4899', rot: 1.5 },
    { icon: Glasses, key: 'auth.arcade.signupFeat2', bg: '#c7d2fe', shadow: '#7c3aed', rot: -2 },
    { icon: PackageCheck, key: 'auth.arcade.signupFeat3', bg: '#fed7aa', shadow: '#f97316', rot: 1 },
  ],
};

/** Progression de l'inscription, présentée comme des niveaux de jeu. */
export type AuthLevel = { current: number; total: number; label: string };

/**
 * Écrans d'accès « Arcade Pro » : nuit violette, présentoir de lunettes en
 * fond, Oculo l'ourson opticien qui guide l'utilisateur (examen de vue à la
 * connexion, essayage devant le miroir à l'inscription), carte « sticker ».
 * Toujours en sombre (classe .dark), comme la landing.
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
  return (
    <div className="dark auth-shell relative min-h-screen overflow-x-clip bg-bg text-content">
      {/* Grille fine + présentoir de lunettes en fondu */}
      <div aria-hidden className="auth-grid pointer-events-none absolute inset-0" />
      <OpticalDisplayBackdrop />

      <header className="relative z-10 mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" aria-label="OculoSaaS">
          <Logo />
        </Link>
        <LanguagePicker />
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1180px] items-center gap-8 px-5 pb-12 sm:px-8 xl:min-h-[calc(100vh-88px)] xl:grid-cols-[1fr_480px] xl:gap-16 xl:pb-16">
        <section className="mx-auto w-full max-w-[540px] xl:mx-0 xl:max-w-none">
          {scene === 'login' ? (
            <EyeChartScene />
          ) : scene === 'signup' ? (
            <MirrorScene say={bubble} />
          ) : (
            <div className="flex items-end gap-3 xl:gap-5">
              <Mascot className="w-[96px] shrink-0 sm:w-[140px] xl:w-[200px]" />
              <div className="min-w-0 flex-1 pb-6 xl:pb-16">
                <SpeechBubble text={bubble} className="rounded-bl-sm xl:max-w-[360px]" />
              </div>
            </div>
          )}

          {/* Grand écran : accroche + atouts en stickers */}
          <div className="hidden xl:block">
            <h1 className="mt-10 font-arcade text-[40px] leading-[1] xl:text-[46px]">
              {kind === 'signup' ? (
                <>
                  {t('auth.arcade.signupHeroA')} <span className="text-gradient">{t('auth.arcade.signupHeroB')}</span>
                </>
              ) : (
                <>
                  {tr('auth.heroTitleA')} <span className="text-gradient">{tr('auth.heroTitleB')}</span>
                </>
              )}
            </h1>
            <ul className="mt-8 flex flex-wrap gap-4">
              {FEATURES[kind].map((f) => (
                <li
                  key={f.key}
                  className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold text-[#120a2b]"
                  style={{ background: f.bg, boxShadow: `5px 5px 0 ${f.shadow}`, transform: `rotate(${f.rot}deg)` }}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#120a2b]">
                    <f.icon className="h-4 w-4 text-white" />
                  </span>
                  {t(f.key)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Carte du formulaire */}
        <section className="auth-card mx-auto w-full max-w-[560px] rounded-[28px] border-2 border-white/10 bg-surface p-6 sm:p-9">
          {level && <LevelBar level={level} />}
          <h2 className="font-arcade text-[26px] leading-tight sm:text-[30px]">{title}</h2>
          <p className="mt-2 text-sm text-content-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>
      </main>
      <p className="relative z-10 pb-6 text-center text-[11px] text-content-faint">{tr('ui.AuthLayout.n2026OculosaasAfrique')}</p>
    </div>
  );
}

function LevelBar({ level }: { level: AuthLevel }) {
  const { t } = useTranslation();
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[#c4b5fd]">
          {t('auth.arcade.level', { current: level.current, total: level.total })}
        </span>
        <span className="text-content-muted">{level.label}</span>
      </div>
      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${level.total}, 1fr)` }}>
        {Array.from({ length: level.total }, (_, i) => (
          <div key={i} className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-brand"
              initial={false}
              animate={{ width: i < level.current ? '100%' : '0%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
