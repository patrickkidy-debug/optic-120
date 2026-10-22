import { useEffect } from 'react';
import { useAuthStore } from '../../store/auth';

/**
 * Interface « Clair premium » (menu rétractable, rubriques plus épaisses) en
 * avant-première pour ces comptes, le temps de la valider avant de l'ouvrir à
 * tous. Ajoute la classe html.premium-ui qui porte les styles (index.css).
 */
const PREMIUM_PREVIEW_EMAILS = new Set(['patrickkidy@gmail.com']);

export function usePremiumUi(): boolean {
  const premium = useAuthStore((s) => PREMIUM_PREVIEW_EMAILS.has((s.user?.email ?? '').toLowerCase()));
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('premium-ui', premium);
    return () => root.classList.remove('premium-ui');
  }, [premium]);
  return premium;
}
