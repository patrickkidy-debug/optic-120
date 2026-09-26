import axios from 'axios';
import type { SyncOpKind, SyncPushInput, SyncOpResult } from '@oculo/shared-types';
import { api, refreshSession } from '../api';
import { useAuthStore } from '../../store/auth';
import { closeOfflineDb, currentOfflineDb, deleteOfflineDb, openOfflineDb } from './db';
import { getDeviceId } from './device';
import { startNetworkWatch, useNetworkStore } from './network';
import { counts, enqueue } from './outbox';
import { createSyncEngine, refreshCounters, type PushOutcome } from './sync';

/**
 * Point d'entrée du hors-ligne pour le reste de l'application.
 *
 * Tout écran qui veut enregistrer une action synchronisable passe par
 * `recordOperation` : l'action est acquise localement tout de suite, puis
 * partira dès que possible. Aucun écran ne parle directement à /sync.
 */

async function push(body: SyncPushInput): Promise<PushOutcome> {
  try {
    const { data } = await api.post<{ results: SyncOpResult[]; serverTime: string }>('/sync/push', body, {
      timeout: 30_000,
      // Le moteur gère lui-même la reprise, avec recul progressif : les
      // quatre relances automatiques du client HTTP le retarderaient d'une
      // minute pour rien.
      _noRetry: true,
    } as never);
    return { kind: 'ok', results: data.results, serverTime: data.serverTime };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (!e.response || e.code === 'ECONNABORTED') return { kind: 'offline' };
      if (e.response.status === 401) return { kind: 'unauthorized' };
      const msg = (e.response.data as { error?: { message?: string } })?.error?.message;
      return { kind: 'error', message: msg ?? `Erreur serveur (${e.response.status})` };
    }
    return { kind: 'error', message: 'Erreur inconnue' };
  }
}

const engine = createSyncEngine({
  getDb: currentOfflineDb,
  push,
  // Un jeton est nécessaire : en session hors ligne (profil local seul), on
  // attend que la session soit revalidée avant d'envoyer quoi que ce soit.
  isOnline: () => useNetworkStore.getState().online && !!useAuthStore.getState().accessToken,
  deviceId: getDeviceId,
});

export const syncNow = engine.syncNow;

/**
 * Enregistre une action à synchroniser. Réussit hors ligne : c'est le but.
 * Tente un envoi immédiat si le réseau est là.
 */
export async function recordOperation(op: {
  kind: SyncOpKind;
  payload: Record<string, unknown>;
  entityId?: string;
}) {
  const db = currentOfflineDb();
  const user = useAuthStore.getState().user;
  if (!db || !user) throw new Error('Aucune session ouverte sur cet appareil');
  const row = await enqueue(db, { ...op, userId: user.id });
  await refreshCounters(db);
  void syncNow();
  return row;
}

let started = false;
let revalidating: Promise<unknown> | null = null;

/** À appeler une fois au démarrage de l'application. */
export function startOffline(): void {
  if (started) return;
  started = true;
  startNetworkWatch();

  // Base locale ouverte dès qu'une session existe (en ligne ou hors ligne).
  const onUser = () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      closeOfflineDb();
      return;
    }
    const db = openOfflineDb(user.tenantId, user.id);
    void refreshCounters(db).then(() => void syncNow());
  };
  let lastUserKey: string | null = null;
  useAuthStore.subscribe((s) => {
    const key = s.user ? `${s.user.tenantId}:${s.user.id}` : null;
    if (key !== lastUserKey) {
      lastUserKey = key;
      onUser();
    }
    // Jeton obtenu (retour du réseau, reconnexion) : on envoie.
    if (s.accessToken) void syncNow();
  });
  onUser();

  // Retour du réseau : on revalide d'abord la session si elle ne tenait que sur
  // le profil local, puis on envoie.
  let wasOnline = useNetworkStore.getState().online;
  useNetworkStore.subscribe((s) => {
    if (s.online && !wasOnline) {
      const auth = useAuthStore.getState();
      if (auth.user && !auth.accessToken && !revalidating) {
        revalidating = refreshSession().finally(() => {
          revalidating = null;
        });
      } else {
        void syncNow();
      }
    }
    wasOnline = s.online;
  });

  // Filet : une opération en recul doit repartir même sans événement réseau.
  setInterval(() => {
    const db = currentOfflineDb();
    if (!db) return;
    void counts(db).then((c) => {
      if (c.pending > 0) void syncNow();
    });
  }, 30_000);
}

/**
 * Déconnexion : les données locales de cet utilisateur sont effacées de
 * l'appareil — sauf s'il reste des actions non envoyées. Dans ce cas elles sont
 * GARDÉES (effacer, c'est perdre des ventes) et partiront à la prochaine
 * connexion de cette même personne. Personne d'autre n'y accède : chaque
 * utilisateur a sa propre base.
 *
 * @returns le nombre d'actions conservées en attente (0 si la base a été effacée).
 */
export async function wipeLocalDataOnLogout(): Promise<number> {
  const user = useAuthStore.getState().user;
  const db = currentOfflineDb();
  if (!user || !db) return 0;
  const { pending } = await counts(db);
  if (pending > 0) {
    closeOfflineDb();
    return pending;
  }
  await deleteOfflineDb(user.tenantId, user.id);
  return 0;
}

export { useNetworkStore } from './network';
export { useSyncStore } from './sync';
