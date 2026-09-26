import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncOpResult, SyncPushInput } from '@oculo/shared-types';
import { OfflineDb, dbName } from './db';
import { backoffMs, counts, dueOperations, enqueue } from './outbox';
import { createSyncEngine, type PushOutcome } from './sync';

/**
 * Scénarios du cahier des charges (§25), côté appareil. Le serveur est
 * remplacé par un faux qui applique la même règle que le vrai : un opId déjà
 * traité renvoie le même résultat, sans nouvelle vente.
 */

const USER = 'user-1';
let db: OfflineDb;
let seq = 0;

beforeEach(async () => {
  db = new OfflineDb(`test-${++seq}`);
  await db.open();
});
afterEach(async () => {
  db.close();
});

/** Faux serveur idempotent : compte les ventes réellement créées. */
function fakeServer() {
  const applied = new Map<string, SyncOpResult>();
  let salesCreated = 0;
  return {
    get salesCreated() {
      return salesCreated;
    },
    applied,
    async handle(body: SyncPushInput): Promise<PushOutcome> {
      const results = body.operations.map((op) => {
        const known = applied.get(op.opId);
        if (known) return known;
        salesCreated += 1;
        const r: SyncOpResult = {
          opId: op.opId,
          outcome: 'APPLIED',
          result: { number: `VEN-2026-${String(salesCreated).padStart(6, '0')}` },
        };
        applied.set(op.opId, r);
        return r;
      });
      return { kind: 'ok', results, serverTime: new Date().toISOString() };
    },
  };
}

function engineWith(push: (b: SyncPushInput) => Promise<PushOutcome>, online = () => true) {
  return createSyncEngine({ getDb: () => db, push, isOnline: online, deviceId: () => 'device-test' });
}

const sale = (n = 1) => ({ kind: 'SALE_CREATE' as const, payload: { amount: 35000 * n }, userId: USER });

describe('Test 1 — en ligne, synchronisation normale', () => {
  it('la vente part et quitte la file', async () => {
    const server = fakeServer();
    await enqueue(db, sale());
    await engineWith((b) => server.handle(b)).syncNow();
    expect(server.salesCreated).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('Test 2 — hors ligne puis reconnexion', () => {
  it('la vente reste sur l’appareil, puis part au retour du réseau', async () => {
    const server = fakeServer();
    let online = false;
    const engine = engineWith((b) => server.handle(b), () => online);

    await enqueue(db, sale());
    await engine.syncNow();
    expect(server.salesCreated).toBe(0);
    expect((await counts(db)).pending).toBe(1);

    online = true;
    await engine.syncNow();
    expect(server.salesCreated).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('Test 3 — fermeture et réouverture', () => {
  it('les opérations survivent à la fermeture de l’application', async () => {
    await enqueue(db, sale());
    await enqueue(db, sale(2));
    const name = db.name;
    db.close();

    const reopened = new OfflineDb(name);
    await reopened.open();
    const ops = await reopened.outbox.orderBy('seq').toArray();
    expect(ops).toHaveLength(2);
    expect(ops.map((o) => o.payload.amount)).toEqual([35000, 70000]);
    reopened.close();
  });
});

describe('Test 4 — 10 ventes hors ligne', () => {
  it('toutes partent, dans l’ordre, sans doublon', async () => {
    const server = fakeServer();
    for (let i = 1; i <= 10; i++) await enqueue(db, sale(i));
    const sent: number[] = [];
    await engineWith(async (b) => {
      sent.push(...b.operations.map((o) => o.payload.amount as number));
      return server.handle(b);
    }).syncNow();
    expect(server.salesCreated).toBe(10);
    expect(sent).toEqual(Array.from({ length: 10 }, (_, i) => 35000 * (i + 1)));
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('Test 5 — connexion instable', () => {
  it('aucune vente perdue ni dupliquée malgré des coupures répétées', async () => {
    const server = fakeServer();
    for (let i = 1; i <= 25; i++) await enqueue(db, sale(i));

    let call = 0;
    // Un envoi sur deux échoue, et un sur trois échoue APRÈS que le serveur a
    // traité le lot (réponse perdue) — le cas le plus traître.
    const flaky = async (b: SyncPushInput): Promise<PushOutcome> => {
      call += 1;
      if (call % 2 === 0) return { kind: 'offline' };
      const res = await server.handle(b);
      if (call % 3 === 0) return { kind: 'offline' };
      return res;
    };
    const engine = engineWith(flaky);

    for (let i = 0; i < 60 && (await db.outbox.count()) > 0; i++) {
      // Le recul progressif est court-circuité : on rend les opérations dues.
      await db.outbox.toCollection().modify({ nextAttemptAt: 0 });
      await engine.syncNow();
    }
    expect(await db.outbox.count()).toBe(0);
    expect(server.salesCreated).toBe(25);
  });
});

describe('Test 7 — même opération envoyée deux fois', () => {
  it('le serveur ne crée qu’une vente', async () => {
    const server = fakeServer();
    const op = await enqueue(db, sale());
    const body: SyncPushInput = {
      deviceId: 'd',
      operations: [{ opId: op.opId, kind: op.kind, payload: op.payload, createdAt: op.createdAt }],
    };
    const a = await server.handle(body);
    const b = await server.handle(body);
    expect(server.salesCreated).toBe(1);
    expect(a).toEqual(b);
  });
});

describe('Test 10 — coupure pendant l’envoi', () => {
  it('une opération restée « en cours d’envoi » est reprise, sans doublon', async () => {
    const server = fakeServer();
    const op = await enqueue(db, sale());
    // L'onglet a été fermé en plein envoi, après traitement par le serveur.
    await server.handle({
      deviceId: 'd',
      operations: [{ opId: op.opId, kind: op.kind, payload: op.payload, createdAt: op.createdAt }],
    });
    await db.outbox.where('opId').equals(op.opId).modify({ status: 'SYNCING' });

    await engineWith((b) => server.handle(b)).syncNow();
    expect(await db.outbox.count()).toBe(0);
    expect(server.salesCreated).toBe(1);
  });
});

describe('refus du serveur', () => {
  it('une opération refusée est gardée avec son motif, les suivantes continuent', async () => {
    const first = await enqueue(db, sale());
    const second = await enqueue(db, sale(2));
    await engineWith(async (b) => ({
      kind: 'ok',
      results: b.operations.map((o) =>
        o.opId === first.opId
          ? { opId: o.opId, outcome: 'REJECTED' as const, error: 'Stock insuffisant pour « Monture X »' }
          : { opId: o.opId, outcome: 'APPLIED' as const, result: {} },
      ),
    })).syncNow();

    const left = await db.outbox.toArray();
    expect(left).toHaveLength(1);
    expect(left[0].opId).toBe(first.opId);
    expect(left[0].status).toBe('REJECTED');
    expect(left[0].lastError).toMatch(/Stock insuffisant/);
    expect(await db.outbox.where('opId').equals(second.opId).count()).toBe(0);
  });

  it('une session expirée n’efface rien : tout attend la reconnexion', async () => {
    await enqueue(db, sale());
    await engineWith(async () => ({ kind: 'unauthorized' })).syncNow();
    const [op] = await db.outbox.toArray();
    expect(op.status).toBe('PENDING');
    expect(op.attempts).toBe(1);
  });
});

describe('ordre et recul', () => {
  it('n’envoie pas une opération après une opération pas encore due', async () => {
    const a = await enqueue(db, sale());
    await enqueue(db, sale(2));
    await db.outbox.where('opId').equals(a.opId).modify({ nextAttemptAt: Date.now() + 60_000 });
    expect(await dueOperations(db, 50)).toHaveLength(0);
  });

  it('le recul grandit puis plafonne à 5 minutes', () => {
    const mid = () => 0.5;
    expect(backoffMs(1, mid)).toBe(5_000);
    expect(backoffMs(2, mid)).toBe(10_000);
    expect(backoffMs(20, mid)).toBe(300_000);
  });
});

describe('cloisonnement', () => {
  it('une base par établissement ET par utilisateur', () => {
    expect(dbName('t1', 'u1')).not.toBe(dbName('t1', 'u2'));
    expect(dbName('t1', 'u1')).not.toBe(dbName('t2', 'u1'));
  });
});

describe('session hors ligne', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rouvre la session sans réseau, pendant 7 jours au plus', async () => {
    const { saveOfflineSession, readOfflineSession, OFFLINE_SESSION_MAX_MS } = await import('./session');
    const user = { id: 'u1', tenantId: 't1' } as never;
    saveOfflineSession(user);
    expect(readOfflineSession()?.id).toBe('u1');
    expect(readOfflineSession(Date.now() + OFFLINE_SESSION_MAX_MS + 1)).toBeNull();
  });

  it('ne garde aucun jeton', async () => {
    const { saveOfflineSession } = await import('./session');
    saveOfflineSession({ id: 'u1', tenantId: 't1' } as never);
    const raw = [...store.values()].join('');
    expect(raw).not.toMatch(/token/i);
  });
});
