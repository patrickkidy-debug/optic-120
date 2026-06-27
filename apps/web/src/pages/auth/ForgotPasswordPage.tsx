import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../../features/auth/api';
import { AuthLayout } from './AuthLayout';
import { Button, Field } from '../../components/ui';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {sent ? (
        <div className="rounded-xl bg-[color:var(--success)]/12 px-4 py-3 text-sm text-success">
          {t('auth.resetSent')}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t('auth.email')}>
            <input
              className="input"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            {t('auth.sendLink')}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-content-muted">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          {t('common.back')} — {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
