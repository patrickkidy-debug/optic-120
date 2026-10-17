import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLoader } from '../../components/ui';
import { completeGoogleRedirect } from '../../features/auth/googleRedirect';

/** Retour de Google (connexion par redirection) : renvoie vers le formulaire d'origine. */
export function GoogleCallbackPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const returnTo = completeGoogleRedirect(window.location.hash);
    navigate(returnTo, { replace: true });
  }, [navigate]);
  return <PageLoader />;
}
