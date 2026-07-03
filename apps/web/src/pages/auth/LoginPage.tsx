import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginInput, type EstablishmentChoice } from '@oculo/shared-types';
import { login, loginTwoFactor, loginSelectTenant } from '../../features/auth/api';
import { useGoogleAuthFlow } from '../../features/auth/useGoogleAuthFlow';
import { apiErrorMessage } from '../../lib/api';
import { AuthLayout } from './AuthLayout';
import { Button, Field } from '../../components/ui';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { WhatsappField } from '../../components/WhatsappField';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [establishments, setEstablishments] = useState<EstablishmentChoice[] | null>(null);
  const [selectionToken, setSelectionToken] = useState('');
  const [selecting, setSelecting] = useState(false);
  const google = useGoogleAuthFlow('/dashboard');
  const [tenantName, setTenantName] = useState('');
  const [branchName, setBranchName] = useState('Magasin principal');
  const [googleWhatsapp, setGoogleWhatsapp] = useState('');
  const [googleCode, setGoogleCode] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError('');
    try {
      const res = await login(values);
      if ('chooseEstablishment' in res) {
        setEstablishments(res.chooseEstablishment);
        setSelectionToken(res.selectionToken);
        return;
      }
      if ('twoFactorRequired' in res) {
        setChallenge(res.challenge);
        return;
      }
      navigate('/dashboard');
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Connexion impossible'));
    }
  }

  async function onSelectEstablishment(tenantId: string) {
    setServerError('');
    setSelecting(true);
    try {
      const res = await loginSelectTenant(selectionToken, tenantId);
      if ('twoFactorRequired' in res) {
        setEstablishments(null);
        setChallenge(res.challenge);
        return;
      }
      navigate('/dashboard');
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Connexion impossible'));
    } finally {
      setSelecting(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setServerError('');
    setVerifying(true);
    try {
      await loginTwoFactor(challenge, code.trim());
      navigate('/dashboard');
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Code invalide'));
    } finally {
      setVerifying(false);
    }
  }

  // Étape intermédiaire (multi-établissement) : choix de l'établissement.
  if (establishments) {
    return (
      <AuthLayout
        title="Choisissez votre établissement"
        subtitle="Votre email gère plusieurs établissements"
      >
        <div className="space-y-3">
          {establishments.map((e) => (
            <button
              key={e.tenantId}
              type="button"
              disabled={selecting}
              onClick={() => void onSelectEstablishment(e.tenantId)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 text-left transition hover:border-primary hover:bg-surface-3 disabled:opacity-50"
            >
              <span className="font-semibold text-content">{e.tenantName}</span>
              <span className="text-content-muted">→</span>
            </button>
          ))}
          {serverError && (
            <div className="rounded-xl bg-[color:var(--danger)]/12 px-3 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setEstablishments(null);
              setSelectionToken('');
              setServerError('');
            }}
            className="w-full text-center text-sm text-content-muted hover:text-content"
          >
            ← Retour
          </button>
        </div>
      </AuthLayout>
    );
  }

  // Étape 2 : saisie du code de vérification (2FA).
  if (challenge) {
    return (
      <AuthLayout title="Vérification en deux étapes" subtitle="Saisissez le code de votre application d'authentification">
        <form onSubmit={onVerify} className="space-y-4">
          <Field label="Code à 6 chiffres">
            <input
              className="input text-center text-2xl tracking-[0.4em]"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          {serverError && (
            <div className="rounded-xl bg-[color:var(--danger)]/12 px-3 py-2 text-sm text-danger">{serverError}</div>
          )}
          <Button type="submit" loading={verifying} disabled={code.length !== 6} className="w-full">
            Vérifier
          </Button>
          <button
            type="button"
            onClick={() => { setChallenge(null); setCode(''); setServerError(''); }}
            className="w-full text-center text-sm text-content-muted hover:text-content"
          >
            ← Retour
          </button>
        </form>
      </AuthLayout>
    );
  }

  // Connexion Google : compte inexistant → on demande juste le nom de l'établissement.
  if (google.step.kind === 'needsSignup') {
    return (
      <AuthLayout title="Finalisez votre inscription" subtitle={`Bienvenue ${google.step.firstName} — encore une étape`}>
        <form
          onSubmit={(e) => { e.preventDefault(); void google.completeSignup(tenantName, branchName, googleWhatsapp); }}
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
          <Field label={t('auth.whatsapp')}>
            <WhatsappField value={googleWhatsapp} onChange={setGoogleWhatsapp} />
            <p className="mt-1 text-xs text-content-faint">{t('auth.whatsappHint')}</p>
          </Field>
          {google.error && <p className="text-sm text-danger">{google.error}</p>}
          <Button type="submit" loading={google.loading} disabled={tenantName.trim().length < 2 || googleWhatsapp.trim().length < 8} className="w-full">
            Créer mon compte
          </Button>
          <button type="button" onClick={google.reset} className="w-full text-center text-sm text-content-muted hover:text-content">
            ← Retour
          </button>
        </form>
      </AuthLayout>
    );
  }

  // Connexion Google : compte protégé par 2FA → même défi que la connexion classique.
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
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <GoogleSignInButton text="signin_with" onCredential={(idToken) => void google.handleCredential(idToken)} />
      {google.error && <p className="mt-3 text-center text-sm text-danger">{google.error}</p>}
      <div className="my-5 flex items-center gap-3 text-xs text-content-faint">
        <div className="h-px flex-1 bg-line" /> ou <div className="h-px flex-1 bg-line" />
      </div>
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
