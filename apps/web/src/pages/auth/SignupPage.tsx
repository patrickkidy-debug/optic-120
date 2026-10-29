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
import { getStoredReferral } from '../../lib/partnerReferral';
import { safeRedirect } from '../../lib/safeRedirect';
import { AuthLayout } from './AuthLayout';
import { Button, Field, PasswordInput } from '../../components/ui';
import { GoogleSignInButton, hasGoogleSignIn } from '../../components/GoogleSignInButton';
import { WhatsappField } from '../../components/WhatsappField';
import { trFr } from '../../lib/sharedLabels';
import { tr } from '../../lib/tr';

const VALID_PLANS: SignupInput['plan'][] = ['STARTER', 'STANDARD', 'GROWTH'];

// Inscription en 3 « niveaux » : établissement, vous, sécurité. Chaque niveau
// valide ses propres champs avant de passer au suivant.
const LEVELS: (keyof SignupInput)[][] = [
  ['tenantName', 'branchName'],
  ['adminFirstName', 'adminLastName', 'adminEmail', 'whatsapp'],
  ['adminPassword'],
];

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
  // Cycle de facturation choisi sur la landing (?cycle=QUARTERLY|SEMIANNUAL) :
  // mémorisé pour que la page Abonnement le retrouve plus tard (l'inscription
  // mène au dashboard, pas directement au paiement — voir 2h d'essai gratuit ci-dessous).
  const rawCycle = params.get('cycle');
  if (rawCycle === 'QUARTERLY' || rawCycle === 'SEMIANNUAL') sessionStorage.setItem('oculo-cycle', rawCycle);
  // Un prospect arrive souvent par un lien de prospection (vidéos de démo) :
  // apres inscription on le renvoie sur la page demandee, pas sur le dashboard.
  const nextParam = params.get('next');
  const redirectTo = safeRedirect(nextParam);
  const google = useGoogleAuthFlow(redirectTo, plan);
  const [tenantName, setTenantName] = useState('');
  const [branchName, setBranchName] = useState(tr('ui.SignupPage.magasinPrincipal'));
  const [googleWhatsapp, setGoogleWhatsapp] = useState('');
  const [googleCode, setGoogleCode] = useState('');
  const [serverError, setServerError] = useState('');
  const [level, setLevel] = useState(0);
  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { branchName: tr('ui.SignupPage.magasinPrincipal') },
  });

  async function onSubmit(values: SignupInput) {
    setServerError('');
    try {
      // OculoPartners : transmet l'attribution en cours (clic sur un lien de
      // parrainage), s'il y en a une valide. Le serveur ignore silencieusement
      // un code absent, expiré ou invalide.
      const referral = getStoredReferral();
      const user = await signup({ ...values, plan, ...referral });
      // eventID identique au eventId envoyé côté serveur (Conversions API) → déduplication Meta.
      trackPixelEvent('CompleteRegistration', { content_name: plan, status: true }, `registration_${user.id}`);
      // Accès immédiat au dashboard : 2 h d'essai gratuit sans interruption, puis
      // blocage + écran de paiement (offre Standard mise en avant) à l'expiration.
      // La visite guidée narrée démarre automatiquement (ProductTourProvider).
      navigate(redirectTo);
    } catch (e) {
      setServerError(apiErrorMessage(e, tr('ui.SignupPage.creationImpossible')));
    }
  }

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (level < LEVELS.length - 1) {
      if (await trigger(LEVELS[level])) setLevel(level + 1);
      return;
    }
    void handleSubmit(onSubmit)();
  }

  // Inscription Google : compte inexistant → on demande juste le nom de l'établissement.
  if (google.step.kind === 'needsSignup') {
    return (
      <AuthLayout title={t('auth.finishSignup')} subtitle={tr('ui.SignupPage.bienvenueFirstnameEncoreUneEtape', { firstName: google.step.firstName })}>
        <form
          onSubmit={(e) => { e.preventDefault(); void google.completeSignup(tenantName, branchName, googleWhatsapp); }}
          className="space-y-4"
        >
          <Field label={t('auth.googleEmail')}>
            <input className="input" value={google.step.email} disabled />
          </Field>
          <Field label={tr('ui.SignupPage.nomDeLEtablissement')}>
            <input className="input" autoFocus value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder={t('auth.placeholderOrg')} />
          </Field>
          <Field label={tr('ui.SignupPage.magasinPrincipal')}>
            <input className="input" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
          </Field>
          <Field label={t('auth.whatsapp')}>
            <WhatsappField value={googleWhatsapp} onChange={setGoogleWhatsapp} />
            <p className="mt-1 text-xs text-content-faint">{t('auth.whatsappHint')}</p>
          </Field>
          {google.error && <p className="text-sm text-danger">{google.error}</p>}
          <Button type="submit" loading={google.loading} disabled={tenantName.trim().length < 2 || googleWhatsapp.trim().length < 8} className="w-full">
            {tr('ui.SignupPage.creerMonCompte')}
          </Button>
          <button type="button" onClick={google.reset} className="w-full text-center text-sm text-content-muted hover:text-content">
            {tr('ui.SignupPage.retour')}
          </button>
        </form>
      </AuthLayout>
    );
  }

  // Compte Google déjà existant et protégé par 2FA.
  if (google.step.kind === 'twoFactor') {
    return (
      <AuthLayout title={t('auth.twoFactorTitle')} subtitle={t('auth.twoFactorSubtitle')}>
        <form onSubmit={(e) => { e.preventDefault(); void google.verifyTwoFactor(googleCode); }} className="space-y-4">
          <Field label={t('auth.sixDigitCode')}>
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
            {tr('ui.SignupPage.verifier')}
          </Button>
          <button type="button" onClick={google.reset} className="w-full text-center text-sm text-content-muted hover:text-content">
            {tr('ui.SignupPage.retour')}
          </button>
        </form>
      </AuthLayout>
    );
  }

  const step = (n: number) => (level === n ? 'space-y-4' : 'hidden');
  return (
    <AuthLayout
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      say={t(`auth.arcade.say${level + 1}`)}
      scene="signup"
      level={{ current: level + 1, total: LEVELS.length, label: t(`auth.arcade.step${level + 1}`) }}
    >
      {level === 0 && (
        <>
          <GoogleSignInButton text="signup_with" onCredential={(idToken) => void google.handleCredential(idToken)} />
          {google.error && <p className="mt-3 text-center text-sm text-danger">{google.error}</p>}
          {hasGoogleSignIn && (
            <div className="my-5 flex items-center gap-3 text-xs text-content-faint">
              <div className="h-px flex-1 bg-line" /> {tr('activationUi.or')} <div className="h-px flex-1 bg-line" />
            </div>
          )}
        </>
      )}
      <form onSubmit={(e) => void onFormSubmit(e)} className="space-y-4">
        <div className={step(0)}>
          <Field label={t('auth.tenantName')}>
            <input className="input" placeholder={t('auth.placeholderOrg')} {...register('tenantName')} />
            {errors.tenantName && <p className="mt-1 text-xs text-danger">{trFr(errors.tenantName.message)}</p>}
          </Field>
          <Field label={t('auth.branchName')}>
            <input className="input" {...register('branchName')} />
          </Field>
        </div>

        <div className={step(1)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('auth.firstName')}>
              <input className="input" autoComplete="given-name" {...register('adminFirstName')} />
              {errors.adminFirstName && (
                <p className="mt-1 text-xs text-danger">{trFr(errors.adminFirstName.message)}</p>
              )}
            </Field>
            <Field label={t('auth.lastName')}>
              <input className="input" autoComplete="family-name" {...register('adminLastName')} />
              {errors.adminLastName && (
                <p className="mt-1 text-xs text-danger">{trFr(errors.adminLastName.message)}</p>
              )}
            </Field>
          </div>
          <Field label={t('auth.email')}>
            <input className="input" type="email" autoComplete="username" autoCapitalize="none" placeholder={t('auth.placeholderEmail')} {...register('adminEmail')} />
            {errors.adminEmail && <p className="mt-1 text-xs text-danger">{trFr(errors.adminEmail.message)}</p>}
          </Field>
          <Field label={t('auth.whatsapp')}>
            <WhatsappField
              value=""
              onChange={(v) => setValue('whatsapp', v, { shouldValidate: isSubmitted })}
            />
            {errors.whatsapp ? (
              <p className="mt-1 text-xs text-danger">{trFr(errors.whatsapp.message)}</p>
            ) : (
              <p className="mt-1 text-xs text-content-faint">{t('auth.whatsappHint')}</p>
            )}
          </Field>
        </div>

        <div className={step(2)}>
          <Field label={t('auth.password')}>
            <PasswordInput autoComplete="new-password" placeholder={t('auth.placeholderPassword')} {...register('adminPassword')} />
            {errors.adminPassword && (
              <p className="mt-1 text-xs text-danger">{trFr(errors.adminPassword.message)}</p>
            )}
          </Field>
        </div>

        {serverError && (
          <div className="rounded-xl bg-[color:var(--danger)]/12 px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}

        <div className="flex gap-3">
          {level > 0 && (
            <button type="button" onClick={() => setLevel(level - 1)} className="btn-outline min-h-[52px] rounded-2xl px-5">
              {t('auth.arcade.back')}
            </button>
          )}
          <Button type="submit" loading={isSubmitting} className="flex-1">
            {level < LEVELS.length - 1 ? t('auth.arcade.next') : t('auth.signup')}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-content-muted">
        {t('auth.haveAccount')}{' '}
        {/* Reporte la destination : un prospect venu du lien d'activation qui a
            déjà un compte doit arriver sur le paiement, pas sur le dashboard. */}
        <Link
          to={nextParam ? `/login?next=${encodeURIComponent(redirectTo)}` : '/login'}
          className="font-semibold text-primary hover:underline"
        >
          {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
