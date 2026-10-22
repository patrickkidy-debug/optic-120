import { type ReactNode } from 'react';
import { ShieldCheck, Smartphone, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthMobileHero } from './AuthMobileHero';
import { tr } from '../../lib/tr';

const FEATURES = [
  { icon: Smartphone, key: 'auth.panelFeat1', chip: 'auth.chip1' },
  { icon: Store, key: 'auth.panelFeat2', chip: 'auth.chip2' },
  { icon: ShieldCheck, key: 'auth.panelFeat3', chip: 'auth.chip3' },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  illustration,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Visuel optionnel affiché au-dessus du titre du panneau — pensé pour l'inscription. */
  illustration?: ReactNode;
}) {
  const { t } = useTranslation();
  const variant = illustration ? 'signup' : 'login';
  // Écrans d'accès toujours en clair (classe .light), comme la landing page.
  return (
    <div className="light grid min-h-screen bg-bg text-content lg:grid-cols-2">
      {/* Grand écran (tablette paysage, ordinateur) : même composition que le
          mobile, en panneau pleine hauteur, avec les atouts de la plateforme. */}
      <div className="sticky top-0 hidden h-screen lg:block">
        <AuthMobileHero variant={variant} panel>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {FEATURES.map((f) => (
              <li key={f.key} className="flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3.5 py-2 text-sm text-content backdrop-blur-md">
                <f.icon className="h-4 w-4 text-primary" /> {t(f.key)}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-content-faint">{tr('ui.AuthLayout.n2026OculosaasAfrique')}</p>
        </AuthMobileHero>
      </div>

      <div className="auth-shell relative flex min-h-screen flex-col bg-bg lg:items-center lg:justify-center lg:overflow-hidden lg:p-10">
        {/* Grand écran : halos de la marque derrière la carte du formulaire. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-violet-600/20 blur-[110px]" />
          <div className="absolute -bottom-40 left-10 h-[380px] w-[380px] rounded-full bg-pink-500/15 blur-[110px]" />
          <div className="absolute bottom-10 right-10 h-[220px] w-[220px] rounded-full bg-orange-400/10 blur-[90px]" />
        </div>
        {/* Téléphone et tablette portrait : bandeau illustré, puis la carte du
            formulaire qui vient se poser dessus (centrée sur tablette). */}
        <div className="lg:hidden">
          <AuthMobileHero variant={variant} />
        </div>

        <div className="relative -mt-8 flex flex-1 justify-center rounded-t-[28px] bg-bg px-5 pb-8 pt-7 shadow-[0_-16px_40px_rgba(76,29,149,0.12)] md:mx-auto md:-mt-12 md:mb-12 md:w-full md:max-w-xl md:flex-none md:rounded-[28px] md:border md:px-10 md:pb-10 md:pt-9 md:shadow-[0_24px_60px_rgba(76,29,149,0.16)] lg:mx-0 lg:mb-0 lg:mt-0 lg:w-full lg:max-w-[480px] lg:flex-none lg:rounded-[28px] lg:border lg:border-line lg:bg-surface/70 lg:p-10 lg:shadow-[0_30px_80px_rgba(76,29,149,0.25)] lg:backdrop-blur-xl">
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="font-display text-2xl font-bold text-content md:text-3xl lg:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-content-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
            <p className="mt-8 text-center text-[11px] text-content-faint lg:hidden">{tr('ui.AuthLayout.n2026OculosaasAfrique')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
