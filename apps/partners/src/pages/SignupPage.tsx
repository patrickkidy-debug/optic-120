import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { partnerSignupSchema, type PartnerSignupInput } from '@oculo/shared-types';
import { signupPartner } from '../lib/partnerApi';
import { usePartnerAuthStore } from '../store/auth';
import { apiErrorMessage } from '../lib/api';
import { Button, Field, PasswordInput } from '../components/ui';

export function SignupPage() {
  const navigate = useNavigate();
  const setAuth = usePartnerAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PartnerSignupInput>({ resolver: zodResolver(partnerSignupSchema) });

  async function onSubmit(values: PartnerSignupInput) {
    setServerError('');
    try {
      const { accessToken, partner } = await signupPartner(values);
      setAuth(accessToken, partner);
      navigate('/dashboard');
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Inscription impossible'));
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-8">
      <div className="card w-full max-w-md p-6">
        <h1 className="font-display text-xl font-bold text-content">Devenir partenaire OculoSaaS</h1>
        <p className="mt-1 text-sm text-content-muted">
          Recommandez OculoSaaS aux opticiens et gagnez une commission à chaque abonnement payant.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <input className="input" {...register('firstName')} />
              {errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}
            </Field>
            <Field label="Nom">
              <input className="input" {...register('lastName')} />
              {errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}
            </Field>
          </div>
          <Field label="Email">
            <input className="input" type="email" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </Field>
          <Field label="Numéro WhatsApp">
            <input className="input" placeholder="+225 07 00 00 00 00" {...register('whatsapp')} />
            {errors.whatsapp && <p className="mt-1 text-xs text-danger">{errors.whatsapp.message}</p>}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pays (code)">
              <input className="input" placeholder="CI" maxLength={2} {...register('countryCode')} />
            </Field>
            <Field label="Ville">
              <input className="input" {...register('city')} />
            </Field>
          </div>
          <Field label="Mot de passe">
            <PasswordInput {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
          </Field>
          <Field label="Moyen de paiement préféré (Mobile Money, virement…)">
            <input className="input" placeholder="ex. Wave" {...register('payoutMethod')} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-content-muted">
            <input type="checkbox" className="mt-1" {...register('acceptedTerms')} />
            <span>J'accepte les conditions du programme partenaire OculoPartners.</span>
          </label>
          {errors.acceptedTerms && <p className="text-xs text-danger">{errors.acceptedTerms.message}</p>}
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Créer mon compte partenaire
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-content-muted">
          Déjà partenaire ?{' '}
          <Link to="/login" className="font-semibold text-primary">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
