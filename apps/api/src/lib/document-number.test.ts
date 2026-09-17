import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  maxSequence,
  nextCounterNumber,
  nextSeriesNumber,
  numberSeriesPrefix,
  seriesKey,
  type CounterClient,
} from './document-number.js';

describe('numberSeriesPrefix / seriesKey', () => {
  it('compose le préfixe et la clé de série', () => {
    expect(numberSeriesPrefix('DEV', 2026)).toBe('DEV-2026-');
    expect(seriesKey('DEV', 2026)).toBe('DEV-2026');
  });
});

describe('maxSequence', () => {
  it('renvoie 0 sur une série vide', () => {
    expect(maxSequence([], 'DEV', 2026)).toBe(0);
  });

  it('ignore les autres séries et les autres années', () => {
    const numbers = ['VEN-2026-000900', 'DEV-2025-000700', 'DEV-2026-000004'];
    expect(maxSequence(numbers, 'DEV', 2026)).toBe(4);
  });

  /**
   * La raison d'être d'un calcul numérique : un tri lexicographique classerait
   * « 1000000 » avant « 999999 » et repartirait donc d'un numéro déjà pris.
   */
  it('compare numériquement, pas alphabétiquement', () => {
    expect(maxSequence(['DEV-2026-999999', 'DEV-2026-1000000'], 'DEV', 2026)).toBe(1000000);
  });

  it('tolère des largeurs de remplissage hétérogènes', () => {
    expect(maxSequence(['DEV-2026-7', 'DEV-2026-000042'], 'DEV', 2026)).toBe(42);
  });

  it('ignore un suffixe illisible au lieu de fausser le maximum', () => {
    expect(maxSequence(['DEV-2026-XXXX', 'DEV-2026-000012'], 'DEV', 2026)).toBe(12);
  });
});

describe('formatNumber', () => {
  it('cadre la séquence à la largeur demandée', () => {
    expect(formatNumber('DEV', 2026, 5)).toBe('DEV-2026-000005');
    expect(formatNumber('PEC', 2026, 42, 5)).toBe('PEC-2026-00042');
  });

  it('ne tronque pas au débordement de largeur', () => {
    expect(formatNumber('PEC', 2026, 100000, 5)).toBe('PEC-2026-100000');
  });
});

/**
 * Compteur en mémoire, fidèle au contrat Prisma : `update` sur une ligne
 * absente lève P2025, `create` sur une clé existante lève P2002.
 */
function fakeDb(initial: Record<string, number> = {}) {
  const store = new Map(Object.entries(initial));
  const err = (code: string) => Object.assign(new Error(code), { code });
  const key = (a: { where: { tenantId_series: { tenantId: string; series: string } } }) =>
    `${a.where.tenantId_series.tenantId}:${a.where.tenantId_series.series}`;

  const db = {
    store,
    documentCounter: {
      create: async (args: never) => {
        const a = args as unknown as { data: { tenantId: string; series: string; value: number } };
        const k = `${a.data.tenantId}:${a.data.series}`;
        if (store.has(k)) throw err('P2002');
        store.set(k, a.data.value);
        return { value: a.data.value };
      },
      update: async (args: never) => {
        const k = key(args as never);
        if (!store.has(k)) throw err('P2025');
        const next = store.get(k)! + 1;
        store.set(k, next);
        return { value: next };
      },
    },
  };
  return db as typeof db & CounterClient;
}

describe('nextCounterNumber', () => {
  it('amorce la série sur le plus grand numéro déjà émis', async () => {
    const db = fakeDb();
    const number = await nextCounterNumber(db, 't1', 'DEV', 2026, async () => [
      'DEV-2026-000041',
      'DEV-2026-000042',
    ]);
    expect(number).toBe('DEV-2026-000043');
  });

  it('démarre à 1 quand aucune pièce n’existe', async () => {
    const db = fakeDb();
    expect(await nextCounterNumber(db, 't1', 'DEV', 2026, async () => [])).toBe('DEV-2026-000001');
  });

  /**
   * Le scénario qui bloquait les utilisateurs : après conversion d'un devis, la
   * série a un trou. Le compteur suit les numéros ÉMIS, pas le nombre de lignes
   * restantes, donc il ne retombe jamais sur un numéro déjà attribué.
   */
  it('ne recule pas quand une pièce a quitté la série', async () => {
    const emitted = ['DEV-2026-000001', 'DEV-2026-000002', 'DEV-2026-000003'];
    const afterConversion = emitted.filter((x) => x !== 'DEV-2026-000002');
    const db = fakeDb();
    const number = await nextCounterNumber(db, 't1', 'DEV', 2026, async () => afterConversion);
    expect(number).toBe('DEV-2026-000004');
    expect(emitted).not.toContain(number);
  });

  /**
   * La propriété qui manquait à « MAX() + 1 » : deux appels successifs ne
   * rendent JAMAIS la même valeur. Une collision résiduelle est donc résolue
   * par la tentative suivante, au lieu d'échouer indéfiniment.
   */
  it('rend des numéros strictement croissants, jamais deux fois le même', async () => {
    const db = fakeDb();
    const seen: string[] = [];
    for (let i = 0; i < 25; i++) {
      seen.push(await nextCounterNumber(db, 't1', 'DEV', 2026, async () => []));
    }
    expect(new Set(seen).size).toBe(25);
    expect(seen).toEqual([...seen].sort());
    expect(seen.at(-1)).toBe('DEV-2026-000025');
  });

  it('ne relit les numéros existants qu’à l’amorçage', async () => {
    const db = fakeDb();
    let reads = 0;
    const read = async () => {
      reads += 1;
      return ['DEV-2026-000010'];
    };
    await nextCounterNumber(db, 't1', 'DEV', 2026, read);
    await nextCounterNumber(db, 't1', 'DEV', 2026, read);
    await nextCounterNumber(db, 't1', 'DEV', 2026, read);
    expect(reads).toBe(1);
  });

  it('isole les séries entre établissements', async () => {
    const db = fakeDb();
    const a = await nextCounterNumber(db, 't1', 'DEV', 2026, async () => ['DEV-2026-000050']);
    const b = await nextCounterNumber(db, 't2', 'DEV', 2026, async () => []);
    expect(a).toBe('DEV-2026-000051');
    expect(b).toBe('DEV-2026-000001');
  });

  it('isole les séries entre types de pièce et entre années', async () => {
    const db = fakeDb();
    expect(await nextCounterNumber(db, 't1', 'DEV', 2026, async () => [])).toBe('DEV-2026-000001');
    expect(await nextCounterNumber(db, 't1', 'VEN', 2026, async () => [])).toBe('VEN-2026-000001');
    expect(await nextCounterNumber(db, 't1', 'DEV', 2027, async () => [])).toBe('DEV-2027-000001');
  });

  /**
   * Le vrai symptôme signalé : une création qui échoue APRÈS l'allocation.
   * Le compteur vivant hors de la transaction métier, la tentative suivante
   * obtient un numéro plus grand — sans quoi elle réobtiendrait le même et
   * l'utilisateur resterait bloqué indéfiniment.
   */
  it('avance même quand la création précédente a échoué', async () => {
    const db = fakeDb();
    const first = await nextCounterNumber(db, 't1', 'DEV', 2026, async () => []);
    // La vente échoue : rien n'est écrit dans Sale, mais le numéro est consommé.
    const second = await nextCounterNumber(db, 't1', 'DEV', 2026, async () => []);
    expect(first).toBe('DEV-2026-000001');
    expect(second).toBe('DEV-2026-000002');
  });

  /** Deux amorçages simultanés : le perdant repasse par l'incrément. */
  it('résout une course à l’amorçage sans rendre deux fois le même numéro', async () => {
    const db = fakeDb();
    const [a, b] = await Promise.all([
      nextCounterNumber(db, 't1', 'DEV', 2026, async () => ['DEV-2026-000009']),
      nextCounterNumber(db, 't1', 'DEV', 2026, async () => ['DEV-2026-000009']),
    ]);
    expect(a).not.toBe(b);
    expect([a, b].sort()).toEqual(['DEV-2026-000010', 'DEV-2026-000011']);
  });
});


describe('nextSeriesNumber', () => {
  it('suit le dernier numéro émis', () => {
    expect(nextSeriesNumber('ANO', 2026, 'ANO-2026-000004')).toBe('ANO-2026-000005');
  });

  it('démarre à 1 sur une série vide', () => {
    expect(nextSeriesNumber('ANO', 2026, null)).toBe('ANO-2026-000001');
  });

  it('respecte la largeur demandée', () => {
    expect(nextSeriesNumber('PEC', 2026, 'PEC-2026-00041', 5)).toBe('PEC-2026-00042');
  });
});
