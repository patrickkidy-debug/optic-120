import { useEffect } from 'react';

/**
 * Interface « Clair premium » (menu rétractable, rubriques plus épaisses),
 * désormais active pour tous les comptes. Ajoute la classe html.premium-ui qui
 * porte les styles (styles/index.css).
 */
export function usePremiumUi(): boolean {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('premium-ui');
    return () => root.classList.remove('premium-ui');
  }, []);
  return true;
}
