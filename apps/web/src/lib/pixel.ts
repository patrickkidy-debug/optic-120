declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * L'app étant une SPA (React Router), seul le 1er chargement déclenche le
 * PageView du script de base posé dans index.html. Cette fonction déclenche
 * un PageView Meta Pixel à chaque changement de route côté client.
 */
export function trackPixelPageView(): void {
  window.fbq?.('track', 'PageView');
}

/**
 * Déclenche un événement standard Meta Pixel (CompleteRegistration,
 * InitiateCheckout, Purchase…). `params` suit les paramètres standard Meta
 * (value, currency, content_name…) pour permettre l'optimisation des
 * campagnes publicitaires sur ces conversions.
 *
 * `eventId`, quand fourni, doit être identique à celui envoyé en parallèle à
 * la Meta Conversions API (serveur) pour le même évènement, afin que Meta
 * déduplique les deux signaux au lieu de compter la conversion deux fois.
 */
export function trackPixelEvent(name: string, params?: Record<string, unknown>, eventId?: string): void {
  if (eventId) {
    window.fbq?.('track', name, params, { eventID: eventId });
  } else {
    window.fbq?.('track', name, params);
  }
}
