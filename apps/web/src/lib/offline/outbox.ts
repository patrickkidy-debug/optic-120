import type { SyncOpKind } from '@oculo/shared-types';
import { generateId } from './device';
import type { OfflineDb, OutboxOp } from './db';

/**
 * File des opérations à envoyer au serveur.
 *
 * Une action enregistrée ici est DÉJÀ acquise pour l'utilisateur : elle est
 * écrite dans IndexedDB, survit à la fermeture de l'onglet, au redémarrage de
 * la tablette ou à une coupure de courant. Elle n'en sort que de deux façons :
 * confirmée par le serveur (retirée), ou refusée par lui (gardée, avec son
 * motif, pour le gérant). Jamais par une simple erreur réseau.
 */

/** Recul entre deux tentatives : 5 s, 10 s, 20 s… plafonné à 5 min. */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 5 * 60_000);
  // ±20 % d'aléa : plusieurs appareils revenus en ligne en même temps ne
  // frappent pas le serveur à la même milliseconde.
  return Math.round(base * (0.8 + random() * 0.4));
}

export async function enqueue(
  db: OfflineDb,
  op: { kind: SyncOpKind; payload: Record<string, unknown>; entityId?: string; userId: string },
): Promise<OutboxOp> {
  const row: OutboxOp = {
    opId: generateId(),
    kind: op.kind,
    entityId: op.entityId,
    payload: op.payload,
    createdAt: new Date().toISOString(),
    userId: op.userId,
    status: 'PENDING',
    attempts: 0,
    nextAttemptAt: 0,
  };
  row.seq = await db.outbox.add(row);
  return row;
}

/**
 * Opérations à envoyer maintenant, dans l'ordre d'enregistrement.
 *
 * S'arrête à la première opération qui n'est pas encore due : les suivantes
 * peuvent en dépendre (une vente après une entrée de stock), les envoyer avant
 * inverserait l'ordre réel.
 */
export async function dueOperations(db: OfflineDb, limit: number, now = Date.now()): Promise<OutboxOp[]> {
  const ordered = await db.outbox.orderBy('seq').toArray();
  const due: OutboxOp[] = [];
  for (const op of ordered) {
    if (op.status === 'REJECTED') continue;
    if (op.nextAttemptAt > now) break;
    due.push(op);
    if (due.length >= limit) break;
  }
  return due;
}

export async function markSyncing(db: OfflineDb, opIds: string[]): Promise<void> {
  await db.outbox.where('opId').anyOf(opIds).modify({ status: 'SYNCING' });
}

/** Confirmée par le serveur : l'opération quitte la file. */
export async function markApplied(db: OfflineDb, opId: string): Promise<void> {
  await db.outbox.where('opId').equals(opId).delete();
}

/** Refus définitif : gardée, avec son motif, pour être montrée au gérant. */
export async function markRejected(db: OfflineDb, opId: string, error: string): Promise<void> {
  await db.outbox.where('opId').equals(opId).modify({ status: 'REJECTED', lastError: error });
}

/** Échec transitoire : on réessaiera plus tard, sans limite de tentatives. */
export async function markRetry(db: OfflineDb, opId: string, error: string, now = Date.now()): Promise<void> {
  await db.outbox
    .where('opId')
    .equals(opId)
    .modify((op) => {
      op.status = 'PENDING';
      op.attempts += 1;
      op.lastError = error;
      op.nextAttemptAt = now + backoffMs(op.attempts);
    });
}

/**
 * Remet en attente les opérations restées « en cours d'envoi » : l'onglet a pu
 * être fermé au milieu d'un envoi. Sans cela, elles resteraient bloquées à
 * jamais. Le serveur étant idempotent, les renvoyer est sans risque.
 */
export async function recoverInterrupted(db: OfflineDb): Promise<number> {
  return db.outbox.where('status').equals('SYNCING').modify({ status: 'PENDING', nextAttemptAt: 0 });
}

export async function counts(db: OfflineDb): Promise<{ pending: number; rejected: number }> {
  const [rejected, total] = await Promise.all([
    db.outbox.where('status').equals('REJECTED').count(),
    db.outbox.count(),
  ]);
  return { pending: total - rejected, rejected };
}

export async function rejectedOperations(db: OfflineDb): Promise<OutboxOp[]> {
  return db.outbox.where('status').equals('REJECTED').reverse().sortBy('seq');
}

/** Le gérant a pris connaissance d'un refus : il peut le retirer de la liste. */
export async function dismissRejected(db: OfflineDb, opId: string): Promise<void> {
  await db.outbox.where('opId').equals(opId).and((op) => op.status === 'REJECTED').delete();
}
