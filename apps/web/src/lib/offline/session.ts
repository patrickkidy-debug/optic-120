import type { AuthUser } from '@oculo/shared-types';

/**
 * Profil de la dernière session, pour travailler SANS réseau.
 *
 * La session normale se reconstruit au démarrage en appelant /auth/refresh.
 * Sans Internet, cet appel échoue et l'utilisateur était déconnecté : un
 * opticien qui rechargeait la page en pleine coupure perdait l'accès au
 * logiciel. On garde donc le profil (identité, établissement, droits) du
 * dernier utilisateur connecté sur cet appareil.
 *
 * Ce profil ne contient AUCUN jeton : il permet d'afficher l'application et de
 * travailler localement, jamais d'appeler l'API. Au retour du réseau, la
 * session est revalidée par le serveur ; un compte désactivé ou un droit retiré
 * entre-temps est alors appliqué, et les opérations faites hors ligne passent
 * par les mêmes contrôles de droits que les autres.
 *
 * Durée limitée : au-delà, une connexion est exigée, pour qu'un appareil perdu
 * ne donne pas un accès local indéfini.
 */

const KEY = 'oculo_offline_session';
export const OFFLINE_SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

interface Stored {
  user: AuthUser;
  savedAt: number;
}

export function saveOfflineSession(user: AuthUser): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ user, savedAt: Date.now() } satisfies Stored));
  } catch {
    /* Stockage refusé : pas de travail hors ligne après rechargement. */
  }
}

export function readOfflineSession(now = Date.now()): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (!stored?.user?.id || now - stored.savedAt > OFFLINE_SESSION_MAX_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return stored.user;
  } catch {
    return null;
  }
}

export function clearOfflineSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien à effacer */
  }
}
