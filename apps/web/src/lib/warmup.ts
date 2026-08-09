import { API_URL } from './api';

/**
 * Réveille l'API avant que l'utilisateur en ait besoin.
 *
 * L'hébergement de l'API met le service en veille après un moment sans trafic ;
 * il rejoue alors migrations et amorçage avant de répondre, ce qui peut prendre
 * une bonne minute. Résultat : la toute première requête — la connexion —
 * semblait bloquée. On lance donc un appel léger dès l'affichage de l'écran de
 * connexion : le réveil se fait pendant que l'utilisateur saisit son mot de
 * passe, et le formulaire répond ensuite normalement.
 *
 * Sans effet quand le service est déjà éveillé (réponse immédiate).
 */
let warming: Promise<void> | null = null;

export function warmUpApi(): void {
  if (warming) return;
  warming = fetch(`${API_URL}/health`, { method: 'GET', cache: 'no-store' })
    .then(() => undefined)
    .catch(() => undefined);
}

/** Vrai tant que l'API n'a pas encore répondu au réveil. */
export function isWarming(): boolean {
  return warming !== null;
}
