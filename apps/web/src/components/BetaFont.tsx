import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Oxanium:wght@500;600;700;800&display=swap';

/** Comptes qui voient la police en avant-première (validation avant ouverture à tous). */
const FONT_PREVIEW_EMAILS = new Set(['patrickkidy@gmail.com']);

/**
 * Police « Oxanium » (logo, titres, gros chiffres) en avant-première : la
 * feuille n'est chargée que pour ces comptes, les autres gardent Manrope sans
 * téléchargement supplémentaire.
 */
export function BetaFont() {
  const beta = useAuthStore((s) => FONT_PREVIEW_EMAILS.has((s.user?.email ?? '').toLowerCase()));
  useEffect(() => {
    const root = document.documentElement;
    if (!beta) {
      root.classList.remove('beta-font');
      return;
    }
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    root.classList.add('beta-font');
    return () => root.classList.remove('beta-font');
  }, [beta]);
  return null;
}
