import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signupSchema, type SignupInput } from '@oculo/shared-types';
import { signup } from '../../features/auth/api';
import { apiErrorMessage } from '../../lib/api';
import { AuthLayout } from './AuthLayout';
import { Button, Field } from '../../components/ui';

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get('plan'); // offre présélectionnée depuis la landing
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { branchName: 'Magasin principal' },
  });

  async function onSubmit(values: SignupInput) {
    setServerError('');
    try {
      await signup(values);
      // Si une offre a été choisie sur la landing, on dirige vers l'abonnement
      // (avec l'offre présélectionnée) ; sinon vers le tableau de bord.
      navigate(plan && plan !== 'TRIAL' ? `/parametres/abonnement?plan=${plan}` : '/dashboard');
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Création impossible'));
    }
  }

  return (
    <AuthLayout title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label={t('auth.tenantName')}>
          <input className="input" placeholder="Clinique Vision Plus" {...register('tenantName')} />
          {errors.tenantName && <p className="mt-1 text-xs text-danger">{errors.tenantName.message}</p>}
        </Field>
        <Field label={t('auth.branchName')}>
          <input className="input" {...register('branchName')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('auth.firstName')}>
            <input className="input" {...register('adminFirstName')} />
            {errors.adminFirstName && (
              <p className="mt-1 text-xs text-danger">{errors.adminFirstName.message}</p>
            )}
          </Field>
          <Field label={t('auth.lastName')}>
            <input className="input" {...register('adminLastName')} />
            {errors.adminLastName && (
              <p className="mt-1 text-xs text-danger">{errors.adminLastName.message}</p>
            )}
          </Field>
        </div>
        <Field label={t('auth.email')}>
          <input className="input" type="email" placeholder="vous@etablissement.sn" {...register('adminEmail')} />
          {errors.adminEmail && <p className="mt-1 text-xs text-danger">{errors.adminEmail.message}</p>}
        </Field>
        <Field label={t('auth.password')}>
          <input className="input" type="password" placeholder="Au moins 8 caractères" {...register('adminPassword')} />
          {errors.adminPassword && (
            <p className="mt-1 text-xs text-danger">{errors.adminPassword.message}</p>
          )}
        </Field>

        {serverError && (
          <div className="rounded-xl bg-[color:var(--danger)]/12 px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}

        <Button type="submit" loading={isSubmitting} className="w-full">
          {t('auth.signup')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-content-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
