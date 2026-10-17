import { type ReactNode } from 'react';
import { ShieldCheck, Smartphone, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo';
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
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-hero p-12 lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--gradient-brand)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-12 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />
        <Logo />
        <div className="relative">
          {illustration && <div className="mb-6 w-56">{illustration}</div>}
          <h1 className="font-display text-4xl font-extrabold leading-tight text-content">
            {t('auth.panelTitleA')} <span className="text-gradient">{t('auth.panelTitleAccent')}</span>
            <br />
            {t('auth.panelTitleB')}
          </h1>
          <p className="mt-4 max-w-md text-content-muted">
            {t('auth.panelSubtitle')}
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.key} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="text-sm text-content">{t(f.key)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-content-faint">{tr('ui.AuthLayout.n2026OculosaasAfrique')}</p>
      </div>

      <div className="flex min-h-screen flex-col bg-bg lg:items-center lg:justify-center lg:p-6">
        {/* Mobile (et app Android, webview du même site) : le panneau de gauche
            est masqué faute de place. Il est remplacé par un bandeau compact
            aux couleurs de la marque, sur lequel la carte du formulaire vient
            se poser. */}
        <AuthMobileHero variant={illustration ? 'signup' : 'login'} />

        <div className="relative -mt-8 flex flex-1 justify-center rounded-t-[28px] bg-bg px-5 pb-8 pt-7 shadow-[0_-16px_40px_rgba(76,29,149,0.12)] lg:mt-0 lg:flex-none lg:rounded-none lg:p-0 lg:shadow-none">
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="font-display text-2xl font-bold text-content">{title}</h2>
            <p className="mt-1 text-sm text-content-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
            <p className="mt-8 text-center text-[11px] text-content-faint lg:hidden">{tr('ui.AuthLayout.n2026OculosaasAfrique')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
