import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Globe, User } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import type { ThemeMode } from '../../lib/theme';
import i18n from '../../lib/i18n';
import { initials } from '../../lib/format';
import { PageHeader, Badge } from '../../components/ui';

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);

  const themes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'dark', label: t('settings.themeDark'), icon: Moon },
    { value: 'light', label: t('settings.themeLight'), icon: Sun },
    { value: 'auto', label: t('settings.themeAuto'), icon: Monitor },
  ];

  function changeLocale(l: string) {
    setLocale(l);
    void i18n.changeLanguage(l);
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('nav.profile')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-20 w-20 place-items-center rounded-2xl bg-brand text-2xl font-bold text-white">
              {initials(user?.firstName, user?.lastName)}
            </span>
            <h3 className="mt-3 font-display text-lg font-bold text-content">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="text-sm text-content-muted">{user?.email}</p>
            <div className="mt-2">
              <Badge tone="info">{user?.roleName}</Badge>
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex items-center gap-2 text-content-muted">
              <User className="h-4 w-4" /> {user?.username ?? user?.email}
            </div>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-1 font-display font-bold text-content">{t('settings.appearance')}</h3>
          <p className="mb-4 text-sm text-content-muted">{t('settings.theme')}</p>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((tm) => (
              <button
                key={tm.value}
                onClick={() => setTheme(tm.value)}
                className={`card flex flex-col items-center gap-2 p-4 transition ${
                  theme === tm.value ? 'border-primary shadow-glow' : 'hover:border-line-strong'
                }`}
              >
                <tm.icon className={`h-6 w-6 ${theme === tm.value ? 'text-primary' : 'text-content-muted'}`} />
                <span className="text-sm font-medium text-content">{tm.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">{t('settings.language')}</h3>
          </div>
          <div className="mt-3 flex gap-2">
            {[
              { code: 'fr', label: 'Français' },
              { code: 'en', label: 'English' },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => changeLocale(l.code)}
                className={`btn-outline ${locale === l.code ? 'border-primary text-primary' : ''}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
