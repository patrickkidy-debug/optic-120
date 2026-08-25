import { PARTNER_REF_STORAGE_KEY, PARTNER_VISITOR_STORAGE_KEY } from '@oculo/shared-types';
import { api } from './api';

interface StoredReferral {
  referralCode: string;
  expiresAt: string;
}

function getVisitorId(): string {
  let id = localStorage.getItem(PARTNER_VISITOR_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PARTNER_VISITOR_STORAGE_KEY, id);
  }
  return id;
}

/**
 * Capture le paramètre `?ref=CODE` d'un lien de parrainage OculoPartners, s'il
 * est présent, et enregistre le clic côté serveur (idempotent : rejouer cette
 * fonction sur un visiteur déjà attribué est sans effet). Ne bloque jamais le
 * rendu de la page — appelée en fire-and-forget au démarrage de l'app.
 */
export async function captureReferralFromUrl(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const referralCode = params.get('ref');
  if (!referralCode) return;

  const visitorId = getVisitorId();
  try {
    const { data } = await api.post<{ expiresAt: string }>('/partners/track', { referralCode, visitorId });
    const stored: StoredReferral = { referralCode, expiresAt: data.expiresAt };
    localStorage.setItem(PARTNER_REF_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Réseau indisponible ou code invalide : on ne bloque jamais la navigation.
  }
}

/** Attribution en cours (non expirée) à transmettre à l'inscription, s'il y en a une. */
export function getStoredReferral(): { referralCode: string; visitorId: string } | null {
  const raw = localStorage.getItem(PARTNER_REF_STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredReferral;
    if (new Date(stored.expiresAt).getTime() < Date.now()) return null;
    return { referralCode: stored.referralCode, visitorId: getVisitorId() };
  } catch {
    return null;
  }
}
