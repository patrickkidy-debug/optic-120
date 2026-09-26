/**
 * Identifiant stable de cet appareil (navigateur ou application installée).
 *
 * Joint à chaque opération synchronisée : il permet de savoir d'où vient une
 * vente, de diagnostiquer un appareil qui n'arrive pas à se synchroniser, et de
 * distinguer deux caisses d'un même magasin. Ce n'est PAS un secret : il ne
 * donne accès à rien, l'authentification reste le jeton de session.
 */

const KEY = 'oculo_device_id';
let cached: string | null = null;

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Repli pour les WebView anciennes : UUID v4 à partir de getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getDeviceId(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return (cached = stored);
    const id = newId();
    localStorage.setItem(KEY, id);
    return (cached = id);
  } catch {
    // Stockage refusé : un identifiant par session, la synchronisation marche
    // quand même (l'idempotence repose sur l'opId, pas sur l'appareil).
    return (cached = newId());
  }
}

export { newId as generateId };
