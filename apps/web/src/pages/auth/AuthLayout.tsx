import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, Smartphone, Store } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { LanguagePicker } from '../../components/LanguagePicker';
import { Mascot } from '../../components/brand/Mascot';
import { tr } from '../../lib/tr';

// Atouts de la plateforme, en cartes « sticker » aux teintes de la marque.
const FEATURES = [
  { icon: Smartphone, key: 'auth.panelFeat1', bg: '#ddd6fe', shadow: '#7c3aed', rot: -2 },
  { icon: Store, key: 'auth.panelFeat2', bg: '#fbcfe8', shadow: '#ec4899', rot: 1.5 },
  { icon: ShieldCheck, key: 'auth.panelFeat3', bg: '#fed7aa', shadow: '#f97316', rot: -1 },
];

/** Progression de l'inscription, présentée comme des niveaux de jeu. */
export type AuthLevel = { current: number; total: number; label: string };

/**
 * Écrans d'accès « Arcade Pro » : nuit violette unie (sans décor de bulles),
 * Oculo la mascotte qui guide l'utilisateur, carte de formulaire « sticker ».
 * Toujours en sombre (classe .dark), comme la landing.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  say,
  level,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Ce que dit Oculo dans sa bulle (par défaut : le sous-titre). */
  say?: string;
  level?: AuthLevel;
}) {
  const { t } = useTranslation();
  const bubble = say ?? subtitle;
  return (
    <div className="dark auth-shell relative min-h-screen overflow-x-clip bg-bg text-content">
      {/* Grille fine, seul décor : sobre et « technologique » */}
      <div aria-hidden className="auth-grid pointer-events-none absolute inset-0" />

      <header className="relative z-10 mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" aria-label="OculoSaaS">
          <Logo />
        </Link>
        <LanguagePicker />
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1180px] items-center gap-8 px-5 pb-12 sm:px-8 lg:min-h-[calc(100vh-88px)] lg:grid-cols-[1fr_480px] lg:gap-16 lg:pb-16">
        <section>
          {/* Oculo + sa bulle */}
          <div className="flex items-end gap-3 lg:gap-5">
            <Mascot className="w-[88px] shrink-0 lg:w-[200px]" />
            <div className="min-w-0 flex-1 pb-6 lg:pb-16">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={bubble}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                  className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm font-semibold leading-snug text-[#120a2b] shadow-[5px_5px_0_#7c3aed] lg:max-w-[360px] lg:px-5 lg:py-4 lg:text-lg"
                >
                  {bubble}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Grand écran : accroche + atouts en stickers */}
          <div className="hidden lg:block">
            <h1 className="mt-8 font-arcade text-[40px] leading-[1] xl:text-[46px]">
              {tr('auth.heroTitleA')} <span className="text-gradient">{tr('auth.heroTitleB')}</span>
            </h1>
            <ul className="mt-8 flex flex-wrap gap-4">
              {FEATURES.map((f) => (
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
        <section className="auth-card w-full rounded-[28px] border-2 border-white/10 bg-surface p-6 sm:p-9">
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
