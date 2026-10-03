import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../features/auth/api';
import { apiErrorMessage } from '../../lib/api';
import { AuthLayout } from './AuthLayout';
import { Button, Field, PasswordInput } from '../../components/ui';
import { tr } from '../../lib/tr';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(apiErrorMessage(err, tr('ui.ResetPasswordPage.reinitialisationImpossible')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={tr('ui.ResetPasswordPage.nouveauMotDePasse')} subtitle={tr('ui.ResetPasswordPage.choisissezUnMotDePasse')}>
      {!token ? (
        <p className="text-sm text-danger">{tr('ui.ResetPasswordPage.lienInvalideOuExpire')}</p>
      ) : done ? (
        <div className="rounded-xl bg-[color:var(--success)]/12 px-4 py-3 text-sm text-success">
          {tr('ui.ResetPasswordPage.motDePasseMisA')}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={tr('ui.ResetPasswordPage.nouveauMotDePasse')}>
            <PasswordInput
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr('ui.ResetPasswordPage.auMoins8Caracteres')}
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            {tr('ui.ResetPasswordPage.mettreAJour')}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-content-muted">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          {tr('ui.ResetPasswordPage.retourALaConnexion')}
        </Link>
      </p>
    </AuthLayout>
  );
}
