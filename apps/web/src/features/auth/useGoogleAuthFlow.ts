import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SignupInput } from '@oculo/shared-types';
import { googleLogin, googleSignup, loginTwoFactor } from './api';
import { apiErrorMessage } from '../../lib/api';

type GoogleStep =
  | { kind: 'idle' }
  | { kind: 'needsSignup'; idToken: string; email: string; firstName: string; lastName: string }
  | { kind: 'twoFactor'; challenge: string };

/**
 * Logique partagée « Se connecter avec Google » entre LoginPage et
 * SignupPage : login direct si le compte existe déjà, étape de complétion
 * (nom de l'établissement) si c'est une première connexion, ou défi 2FA.
 */
export function useGoogleAuthFlow(redirectTo: string, plan?: SignupInput['plan']) {
  const navigate = useNavigate();
  const [step, setStep] = useState<GoogleStep>({ kind: 'idle' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCredential(idToken: string) {
    setError('');
    setLoading(true);
    try {
      const res = await googleLogin(idToken);
      if ('needsSignup' in res) {
        setStep({ kind: 'needsSignup', idToken, email: res.email, firstName: res.firstName, lastName: res.lastName });
        return;
      }
      if ('twoFactorRequired' in res) {
        setStep({ kind: 'twoFactor', challenge: res.challenge });
        return;
      }
      navigate(redirectTo);
    } catch (e) {
      setError(apiErrorMessage(e, 'Connexion Google impossible'));
    } finally {
      setLoading(false);
    }
  }

  async function completeSignup(tenantName: string, branchName: string) {
    if (step.kind !== 'needsSignup') return;
    setError('');
    setLoading(true);
    try {
      await googleSignup({ idToken: step.idToken, tenantName, branchName, plan });
      navigate(redirectTo);
    } catch (e) {
      setError(apiErrorMessage(e, 'Inscription impossible'));
    } finally {
      setLoading(false);
    }
  }

  async function verifyTwoFactor(code: string) {
    if (step.kind !== 'twoFactor') return;
    setError('');
    setLoading(true);
    try {
      await loginTwoFactor(step.challenge, code);
      navigate(redirectTo);
    } catch (e) {
      setError(apiErrorMessage(e, 'Code invalide'));
    } finally {
      setLoading(false);
    }
  }

  return { step, error, loading, handleCredential, completeSignup, verifyTwoFactor, reset: () => setStep({ kind: 'idle' }) };
}
