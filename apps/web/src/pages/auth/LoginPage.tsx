import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginInput } from '@oculo/shared-types';
import { login } from '../../features/auth/api';
import { apiErrorMessage } from '../../lib/api';
import { AuthLayout } from './AuthLayout';
import { Button, Field } from '../../components/ui';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError('');
    try {
      await login(values);
      navigate('/dashboard');
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Connexion impossible'));
    }
  }

  return (
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label={t('auth.identifier')}>
          <input className="input" autoFocus placeholder="awa@visionplus.sn" {...register('identifier')} />
          {errors.identifier && <p className="mt-1 text-xs text-danger">{errors.identifier.message}</p>}
        </Field>
        <Field label={t('auth.password')}>
          <input className="input" type="password" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
        </Field>

        {serverError && (
          <div className="rounded-xl bg-[color:var(--danger)]/12 px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">
            {t('auth.forgot')}
          </Link>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full">
          {t('auth.login')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-content-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" className="font-semibold text-primary hover:underline">
          {t('auth.createOrg')}
        </Link>
      </p>
    </AuthLayout>
  );
}
