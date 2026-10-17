/**
 * Consentement cookies (RGPD / CNIL). Seuls les cookies publicitaires (Meta
 * Pixel) sont soumis à consentement ; les cookies de session sont nécessaires.
 * Le choix est mémorisé 6 mois puis redemandé.
 */
const KEY = 'oculo_consent';
const MAX_AGE = 182 * 24 * 60 * 60 * 1000;
const EVENT = 'oculo:consent';

declare global {
  interface Window {
    __loadMetaPixel?: () => void;
  }
}

export interface Consent {
  marketing: boolean;
  at: number;
}

export function getConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Consent | null;
    return c && Date.now() - c.at < MAX_AGE ? c : null;
  } catch {
    return null;
  }
}

export function hasMarketingConsent(): boolean {
  return getConsent()?.marketing === true;
}

export function setConsent(marketing: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ marketing, at: Date.now() }));
  } catch {
    /* stockage indisponible : le choix vaut pour cette visite */
  }
  if (marketing) window.__loadMetaPixel?.();
  window.dispatchEvent(new Event(EVENT));
}

/** Rouvre la bannière (lien « Gérer les cookies »). */
export function reopenConsent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onConsentChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
