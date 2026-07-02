import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signupSchema, type SignupInput } from '@oculo/shared-types';
import { signup } from '../../features/auth/api';
import { useGoogleAuthFlow } from '../../features/auth/useGoogleAuthFlow';
import { apiErrorMessage } from '../../lib/api';
import { trackPixelEvent } from '../../lib/pixel';
import { AuthLayout } from './AuthLayout';
import { Button, Field } from '../../components/ui';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

const VALID_PLANS: SignupInput['plan'][] = ['STARTER', 'STANDARD', 'GROWTH'];

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Offre présélectionnée depuis la landing — Starter par défaut. L'inscription
  // mène DIRECTEMENT au dashboard : l'utilisateur profite de 2 h d'accès complet
  // (essai gratuit) avant d'être redirigé vers le paiement de l'abonnement.
  const rawPlan = params.get('plan');
  const plan: SignupInput['plan'] = (VALID_PLANS as string[]).includes(rawPlan ?? '')
    ? (rawPlan as SignupInput['plan'])
    : 'STARTER';
  const redirectTo = '/dashboard';
  const google = useGoogleAuthFlow(redirectTo, plan);
  const [tenantName, setTenantName] = useState('');
  const [branchName, setBranchName] = useState('Magasin principal');
  const [googleCode, setGoogleCode] = useState('');
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
      const user = await signup({ ...values, plan });
      // eventID identique au eventId envoyé côté serveur (Conversions API) → déduplication Meta.
      trackPixelEvent('CompleteRegistration', { content_name: plan, status: true }, `registration_${user.id}`);
      // Accès immédiat au dashboard : 2 h d'essai gratuit sans interruption, puis
      // blocage + écran de paiement (offre Standard mise en avant) à l'expiration.
      navigate(redirectTo);
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Création impossible'));
    }
  }

  // Inscription Google : compte inexistant → on demande juste le nom de l'établissement.
  if (google.step.kind === 'needsSignup') {
    return (
      <AuthLayout title="Finalisez votre inscription" subtitle={`Bienvenue ${google.step.firstName} — encore une étape`}>
        <form
          onSubmit={(e) => { e.preventDefault(); void google.completeSignup(tenantName, branchName); }}
          className="space-y-4"
        >
          <Field label="Email Google">
            <input className="input" value={google.step.email} disabled />
          </Field>
          <Field label="Nom de l'établissement">
            <input className="input" autoFocus value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Clinique Vision Plus" />
          </Field>
          <Field label="Magasin principal">
            <input className="input" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
          </Field>
          {google.error && <p className="text-sm text-danger">{google.error}</p>}
          <Button type="submit" loading={google.loading} disabled={tenantName.trim().length < 2} className="w-full">
            Créer mon compte
          </Button>
          <button type="button" onClick={google.reset} className="w-full text-center text-sm text-content-muted hover:text-content">
            ← Retour
          </button>
        </form>
      </AuthLayout>
    );
  }

  // Compte Google déjà existant et protégé par 2FA.
  if (google.step.kind === 'twoFactor') {
    return (
      <AuthLayout title="Vérification en deux étapes" subtitle="Saisissez le code de votre application d'authentification">
        <form onSubmit={(e) => { e.preventDefault(); void google.verifyTwoFactor(googleCode); }} className="space-y-4">
          <Field label="Code à 6 chiffres">
            <input
              className="input text-center text-2xl tracking-[0.4em]"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="······"
              value={googleCode}
              onChange={(e) => setGoogleCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          {google.error && <p className="text-sm text-danger">{google.error}</p>}
          <Button type="submit" loading={google.loading} disabled={googleCode.length !== 6} className="w-full">
            Vérifier
          </Button>
          <button type="button" onClick={google.reset} className="w-full text-center text-sm text-content-muted hover:text-content">
            ← Retour
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <GoogleSignInButton text="signup_with" onCredential={(idToken) => void google.handleCredential(idToken)} />
      {google.error && <p className="mt-3 text-center text-sm text-danger">{google.error}</p>}
      <div className="my-5 flex items-center gap-3 text-xs text-content-faint">
        <div className="h-px flex-1 bg-line" /> ou <div className="h-px flex-1 bg-line" />
      </div>
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
