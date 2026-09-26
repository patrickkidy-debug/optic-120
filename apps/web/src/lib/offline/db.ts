import Dexie, { type Table } from 'dexie';
import type { SyncOpKind } from '@oculo/shared-types';

/**
 * Base locale de l'appareil (IndexedDB, via Dexie).
 *
 * UNE base par établissement ET par utilisateur : `oculo-<tenant>-<user>`.
 * Deux personnes qui partagent un ordinateur de magasin, ou un gérant qui
 * travaille pour deux enseignes, n'ont jamais leurs données locales dans le
 * même espace. L'interface n'ouvre que la base de la session en cours.
 *
 * Le schéma est versionné : les tables métier (clients, produits, stock…)
 * arrivent par des versions suivantes, que Dexie applique à l'ouverture sans
 * perdre la file d'opérations en attente.
 */

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'REJECTED';

export interface OutboxOp {
  /** Ordre d'enregistrement : le serveur applique les opérations dans cet ordre. */
  seq?: number;
  opId: string;
  kind: SyncOpKind;
  entityId?: string;
  payload: Record<string, unknown>;
  /** Instant de l'action sur l'appareil (ISO). */
  createdAt: string;
  userId: string;
  status: OutboxStatus;
  attempts: number;
  /** Prochaine tentative autorisée (ms epoch) — recul progressif après échec. */
  nextAttemptAt: number;
  lastError?: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class OfflineDb extends Dexie {
  outbox!: Table<OutboxOp, number>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      // ++seq : clé auto-incrémentée = ordre d'envoi. &opId : unique.
      outbox: '++seq, &opId, status, nextAttemptAt, kind',
      meta: 'key',
    });
  }
}

export function dbName(tenantId: string, userId: string): string {
  return `oculo-${tenantId}-${userId}`;
}

let current: { name: string; db: OfflineDb } | null = null;

/** Ouvre (ou réutilise) la base de la session. */
export function openOfflineDb(tenantId: string, userId: string): OfflineDb {
  const name = dbName(tenantId, userId);
  if (current?.name === name) return current.db;
  current?.db.close();
  current = { name, db: new OfflineDb(name) };
  return current.db;
}

/** Base de la session en cours, ou null hors session. */
export function currentOfflineDb(): OfflineDb | null {
  return current?.db ?? null;
}

export function closeOfflineDb(): void {
  current?.db.close();
  current = null;
}

/** Efface définitivement la base locale d'un utilisateur de cet appareil. */
export async function deleteOfflineDb(tenantId: string, userId: string): Promise<void> {
  const name = dbName(tenantId, userId);
  if (current?.name === name) closeOfflineDb();
  await Dexie.delete(name);
}

export async function getMeta<T>(db: OfflineDb, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: OfflineDb, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
