import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowBigUp, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { verifyPassword, logout } from '../features/auth/api';
import { tryLocalUnlock, setUnlockSecret } from '../lib/unlock';
import { Mascot } from './brand/Mascot';
import { Button, PasswordInput } from './ui';
import { tr } from '../lib/tr';
import { apiErrorMessage } from '../lib/api';
import { displayLocale } from '../lib/format';

/** Heure et date du jour, rafraîchies chaque minute (comme un écran de veille). */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Recalage sur la minute pile, puis toutes les 60 s.
    const first = window.setTimeout(
      () => {
        setNow(new Date());
        interval = window.setInterval(() => setNow(new Date()), 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    let interval = 0;
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

export function LockScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const now = useClock();
  const locale = displayLocale();

  // Petite secousse de la carte quand le mot de passe est refusé.
  function shake() {
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove('lock-shake');
    void el.offsetWidth; // relance l'animation
    el.classList.add('lock-shake');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      // Déverrouillage local instantané si un vérificateur existe (session
      // ouverte dans cet onglet) ; sinon repli sur le serveur (session restaurée).
      const local = await tryLocalUnlock(password);
      const ok = local === null ? await verifyPassword(password) : local;
      if (ok) {
        if (local === null) await setUnlockSecret(password); // prochains déverrouillages instantanés
        useAuthStore.getState().setLocked(false);
        setPassword('');
      } else {
        setError(t('auth.password') + ' incorrect');
        shake();
      }
    } catch (err) {
      // Message du serveur quand il y en a un (ex. trop d'essais), sinon générique.
      setError(apiErrorMessage(err, tr('ui.LockScreen.erreurDeVerification')));
      shake();
    } finally {
      setLoading(false);
    }
  }

  // Touche « Verr. Maj » active : cause fréquente d'un mot de passe refusé.
  function checkCaps(e: KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
  }

  const initials = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '';
  const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const rawDate = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  // Majuscule au seul premier mot (« Jeudi 19 novembre ») : `capitalize` mettait aussi le mois.
  const date = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  // z-[95] : au-dessus des bandeaux, fenêtres et annonces, sous les notifications.
  return (
    <div className="lock-bg fixed inset-0 z-[95] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-4 py-10">
        {/* Boutique */}
        {user && (
          <div className="mb-6 flex max-w-full items-center gap-2 rounded-full border bg-surface/70 px-3 py-1.5 text-sm font-semibold text-content-muted backdrop-blur">
            {user.tenantLogoUrl ? (
              <img src={user.tenantLogoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            )}
            <span className="truncate">{user.tenantName}</span>
          </div>
        )}

        {/* Horloge */}
        <p className="font-display text-6xl font-bold leading-none tracking-tight text-content tabular-nums sm:text-7xl">
          {time}
        </p>
        <p className="mt-2 text-base font-medium text-content-muted">{date}</p>

        {/* Carte de déverrouillage */}
        <div ref={cardRef} className="card relative mt-16 w-full animate-fade-in px-6 pb-6 pt-14 text-center sm:px-8">
          {/* Mascotte assise sur le bord de la carte */}
          <Mascot pose="sit" className="pointer-events-none absolute -right-3 -top-[92px] hidden w-[86px] sm:block" />

          {/* Avatar */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-full p-[3px]" style={{ background: 'var(--gradient-brand)' }}>
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-4 border-[rgb(var(--surface-rgb))] bg-surface-2 text-2xl font-bold text-content">
                {user?.photoUrl ? <img src={user.photoUrl} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-4 border-[rgb(var(--surface-rgb))] bg-primary text-white">
              <Lock className="h-3.5 w-3.5" />
            </span>
          </div>

          {user && (
            <>
              <p className="font-display text-xl font-bold text-content">
                {user.firstName} {user.lastName}
              </p>
              <p className="mt-0.5 truncate text-sm text-content-muted">{user.roleName}</p>
            </>
          )}

          <h1 id="lock-title" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Lock className="h-3.5 w-3.5" />
            {t('auth.locked')}
          </h1>
          <p className="mt-2 text-sm text-content-muted">{t('auth.unlockSubtitle')}</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3 text-left">
            <PasswordInput
              autoComplete="current-password"
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={checkCaps}
              onKeyUp={checkCaps}
              aria-invalid={Boolean(error)}
              className={`h-12 ${error ? 'border-danger' : ''}`}
              autoFocus
            />
            {capsLock && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                <ArrowBigUp className="h-4 w-4" />
                {t('auth.capsLockOn')}
              </p>
            )}
            {error && (
              <p className="flex items-start gap-1.5 text-sm font-medium text-danger" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <Button type="submit" loading={loading} disabled={!password} className="h-12 w-full text-base">
              {!loading && <LockOpen className="h-4 w-4" />}
              {t('auth.unlock')}
            </Button>
          </form>

          <p className="mt-4 text-sm text-content-muted">
            {t('auth.lockNotYou')}{' '}
            <button type="button" onClick={() => void logout()} className="font-semibold text-primary hover:underline">
              {t('auth.lockSwitchAccount')}
            </button>
          </p>
        </div>

        <p className="mt-6 flex items-center gap-1.5 text-center text-xs text-content-faint">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {t('auth.lockFooter')}
        </p>
      </div>
    </div>
  );
}
