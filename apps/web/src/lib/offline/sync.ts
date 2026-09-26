import { create } from 'zustand';
import { SYNC_PUSH_MAX, type SyncOpResult, type SyncPushInput } from '@oculo/shared-types';
import type { OfflineDb, OutboxOp } from './db';
import { getMeta, setMeta } from './db';
import {
  counts,
  dueOperations,
  markApplied,
  markRejected,
  markRetry,
  markSyncing,
  recoverInterrupted,
} from './outbox';

/**
 * Moteur de synchronisation : vide la file d'opérations vers le serveur.
 *
 * Règles :
 *  - un seul envoi à la fois (dans l'onglet, et entre onglets quand le
 *    navigateur le permet) ;
 *  - envois dans l'ordre, par paquets ;
 *  - une panne réseau ne consomme pas l'opération : elle est remise en attente
 *    avec un recul progressif ;
 *  - un refus du serveur est gardé, pas effacé ;
 *  - une session expirée arrête l'envoi sans toucher aux opérations : elles
 *    partiront après reconnexion.
 */

export type SyncPhase = 'idle' | 'syncing';

interface SyncState {
  phase: SyncPhase;
  pending: number;
  rejected: number;
  lastSyncAt: string | null;
  /** Dernière erreur d'envoi, pour l'infobulle — pas pour une alerte. */
  lastError: string | null;
  set: (patch: Partial<Omit<SyncState, 'set'>>) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  phase: 'idle',
  pending: 0,
  rejected: 0,
  lastSyncAt: null,
  lastError: null,
  set: (patch) => set(patch),
}));

/** Résultat d'un envoi : réponse du serveur, ou raison pour laquelle il n'a pas eu lieu. */
export type PushOutcome =
  | { kind: 'ok'; results: SyncOpResult[]; serverTime?: string }
  | { kind: 'offline' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

export interface SyncDeps {
  getDb: () => OfflineDb | null;
  push: (body: SyncPushInput) => Promise<PushOutcome>;
  isOnline: () => boolean;
  deviceId: () => string;
  /** Appelé pour chaque opération confirmée (ex. reporter le numéro définitif). */
  onApplied?: (op: OutboxOp, result: Record<string, unknown>) => Promise<void> | void;
}

const LAST_SYNC_KEY = 'lastSyncAt';

export async function refreshCounters(db: OfflineDb): Promise<void> {
  const c = await counts(db);
  const lastSyncAt = (await getMeta<string>(db, LAST_SYNC_KEY)) ?? null;
  useSyncStore.getState().set({ pending: c.pending, rejected: c.rejected, lastSyncAt });
}

export function createSyncEngine(deps: SyncDeps) {
  let running: Promise<void> | null = null;

  async function drain(db: OfflineDb): Promise<void> {
    await recoverInterrupted(db);
    // Plafond de tours : une file énorme se vide en plusieurs passages plutôt
    // que de bloquer l'onglet indéfiniment.
    for (let round = 0; round < 20; round++) {
      if (!deps.isOnline()) return;
      const batch = await dueOperations(db, SYNC_PUSH_MAX);
      if (batch.length === 0) return;

      await markSyncing(db, batch.map((o) => o.opId));
      const outcome = await deps.push({
        deviceId: deps.deviceId(),
        operations: batch.map((o) => ({
          opId: o.opId,
          kind: o.kind,
          entityId: o.entityId,
          payload: o.payload,
          createdAt: o.createdAt,
        })),
      });

      if (outcome.kind !== 'ok') {
        const reason =
          outcome.kind === 'offline'
            ? 'Connexion perdue pendant l’envoi'
            : outcome.kind === 'unauthorized'
              ? 'Session à renouveler'
              : outcome.message;
        for (const op of batch) await markRetry(db, op.opId, reason);
        useSyncStore.getState().set({ lastError: reason });
        return;
      }

      const byId = new Map(outcome.results.map((r) => [r.opId, r]));
      let progressed = false;
      for (const op of batch) {
        const r = byId.get(op.opId);
        if (!r || r.outcome === 'RETRY') {
          await markRetry(db, op.opId, r?.error ?? 'Réponse incomplète du serveur');
        } else if (r.outcome === 'APPLIED') {
          await deps.onApplied?.(op, r.result ?? {});
          await markApplied(db, op.opId);
          progressed = true;
        } else {
          await markRejected(db, op.opId, r.error ?? 'Refusée par le serveur');
          progressed = true;
        }
      }
      await setMeta(db, LAST_SYNC_KEY, outcome.serverTime ?? new Date().toISOString());
      useSyncStore.getState().set({ lastError: null });
      await refreshCounters(db);
      // Rien n'a avancé (tout est « à réessayer ») : on attend le recul
      // plutôt que de boucler contre le serveur.
      if (!progressed) return;
    }
  }

  /**
   * Lance une synchronisation. Des appels rapprochés partagent le même envoi.
   * Ne lève jamais : un échec se lit dans le magasin d'état, pas en exception.
   */
  function syncNow(): Promise<void> {
    const db = deps.getDb();
    if (!db) return Promise.resolve();
    if (running) return running;

    const task = async () => {
      useSyncStore.getState().set({ phase: 'syncing' });
      try {
        await drain(db);
      } catch (e) {
        useSyncStore.getState().set({ lastError: e instanceof Error ? e.message : 'Erreur de synchronisation' });
      } finally {
        await refreshCounters(db).catch(() => undefined);
        useSyncStore.getState().set({ phase: 'idle' });
      }
    };

    // Plusieurs onglets ouverts sur le même appareil : un seul envoie. Le
    // serveur est idempotent de toute façon, mais autant ne pas doubler le
    // trafic d'une connexion mobile.
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    running = (locks ? locks.request('oculo-sync', task) : task()).finally(() => {
      running = null;
    }) as Promise<void>;
    return running;
  }

  return { syncNow };
}
