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
