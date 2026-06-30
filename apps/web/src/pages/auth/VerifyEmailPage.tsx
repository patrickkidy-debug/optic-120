import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { verifyEmail } from '../../features/auth/api';
import { apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { AuthLayout } from './AuthLayout';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setStatus('error');
      setError('Lien invalide.');
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus('done');
        // Met à jour le profil en mémoire si l'utilisateur est connecté.
        const u = useAuthStore.getState().user;
        if (u) useAuthStore.getState().setUser({ ...u, emailVerified: true });
      })
      .catch((err) => {
        setStatus('error');
        setError(apiErrorMessage(err, 'Lien de confirmation invalide ou expiré'));
      });
  }, [token]);

  return (
    <AuthLayout title="Confirmation de l'email" subtitle="Vérification de votre adresse">
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-content-muted">Confirmation en cours…</p>
        </div>
      )}
      {status === 'done' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="font-display text-lg font-bold text-content">Adresse confirmée ✅</p>
          <p className="text-sm text-content-muted">Votre adresse email est bien vérifiée.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <XCircle className="h-12 w-12 text-danger" />
          <p className="text-sm text-danger">{error}</p>
          <p className="text-sm text-content-muted">
            Le lien a peut-être expiré. Connectez-vous puis renvoyez l'email de confirmation.
          </p>
        </div>
      )}
      <p className="mt-6 text-center text-sm text-content-muted">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Aller à la connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
