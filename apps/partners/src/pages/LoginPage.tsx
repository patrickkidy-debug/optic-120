import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { partnerLoginSchema, type PartnerLoginInput } from '@oculo/shared-types';
import { loginPartner } from '../lib/partnerApi';
import { usePartnerAuthStore } from '../store/auth';
import { apiErrorMessage } from '../lib/api';
import { Button, Field, PasswordInput } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = usePartnerAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PartnerLoginInput>({ resolver: zodResolver(partnerLoginSchema) });

  async function onSubmit(values: PartnerLoginInput) {
    setServerError('');
    try {
      const { accessToken, partner } = await loginPartner(values);
      setAuth(accessToken, partner);
      const next = params.get('next');
      navigate(next && next.startsWith('/') ? next : '/dashboard');
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Connexion impossible'));
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="font-display text-xl font-bold text-content">Espace partenaire</h1>
        <p className="mt-1 text-sm text-content-muted">Connectez-vous à votre compte OculoPartners.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <Field label="Email">
            <input className="input" type="email" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </Field>
          <Field label="Mot de passe">
            <PasswordInput {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
          </Field>
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Se connecter
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-content-muted">
          Pas encore partenaire ?{' '}
          <Link to="/inscription" className="font-semibold text-primary">
            Devenir partenaire
          </Link>
        </p>
      </div>
    </div>
  );
}
