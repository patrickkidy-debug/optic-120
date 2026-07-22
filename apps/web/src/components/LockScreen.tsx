import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { verifyPassword, logout } from '../features/auth/api';
import { tryLocalUnlock, setUnlockSecret } from '../lib/unlock';
import { Logo } from './Logo';
import { Button } from './ui';

export function LockScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      }
    } catch {
      setError('Erreur de vérification');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-hero p-4">
      <div className="card w-full max-w-sm p-6 text-center animate-fade-in">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-content">{t('auth.locked')}</h1>
        <p className="mt-1 text-sm text-content-muted">{t('auth.unlockSubtitle')}</p>
        {user && (
          <p className="mt-3 text-sm font-medium text-content">
            {user.firstName} {user.lastName}
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-4 space-y-3 text-left">
          <input
            type="password"
            className="input"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            {t('auth.unlock')}
          </Button>
        </form>
        <button onClick={() => void logout()} className="mt-3 text-sm text-content-muted hover:text-content">
          {t('auth.logout')}
        </button>
      </div>
    </div>
  );
}
