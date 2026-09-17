/**
 * Numérotation des pièces (devis, ventes, avoirs, anomalies, prises en charge,
 * commandes de verres, SAV, factures) — une seule définition pour tous les
 * modules.
 *
 * Historique du problème, parce qu'il a fallu trois passes pour le régler :
 *
 *  1. `COUNT() + 1` supposait une suite sans trou. Faux : convertir un devis
 *     renomme la ligne (DEV-… devient VEN-…), donc le nombre de devis baisse
 *     alors que les numéros DEV déjà imprimés restent attribués.
 *  2. `MAX() + 1` corrige ce cas précis, mais reste une LECTURE suivie d'une
 *     écriture. Si la lecture ne reflète pas la réalité — tri lexicographique
 *     face à des largeurs de remplissage hétérogènes, numéro illisible, série
 *     héritée d'un ancien format — la collision devient PERMANENTE : chaque
 *     nouvelle tentative relit la même chose et propose le même numéro déjà
 *     pris. L'utilisateur reste bloqué indéfiniment sur « son numéro vient
 *     d'être attribué à un autre document ».
 *  3. Un compteur persistant qui ne fait qu'avancer ne peut pas rendre deux
 *     fois la même valeur. Une éventuelle collision résiduelle (donnée héritée
 *     inattendue) est alors résolue par la tentative suivante, qui obtient un
 *     numéro STRICTEMENT plus grand. C'est la propriété qui manquait.
 *
 * Le verrou consultatif Postgres posé par l'appelant reste nécessaire : il
 * traite la concurrence, ce compteur traite la source du numéro.
 */

/** Préfixe complet d'une série annuelle, ex. « DEV-2026- ». */
export function numberSeriesPrefix(prefix: string, year: number): string {
  return `${prefix}-${year}-`;
}

/** Identifiant de série stocké dans DocumentCounter, ex. « DEV-2026 ». */
export function seriesKey(prefix: string, year: number): string {
  return `${prefix}-${year}`;
}

/**
 * Plus grand numéro d'une série, calculé NUMÉRIQUEMENT.
 *
 * Volontairement pas un `ORDER BY number DESC LIMIT 1` : ce tri est
 * lexicographique et ne donne le vrai maximum que si toutes les valeurs ont la
 * même largeur. « DEV-2026-1000000 » se classerait avant « DEV-2026-999999 »,
 * et un format hérité mélangé suffirait à fausser le résultat. Ne sert qu'une
 * fois par série, à l'amorçage du compteur.
 */
export function maxSequence(numbers: string[], prefix: string, year: number): number {
  const series = numberSeriesPrefix(prefix, year);
  let max = 0;
  for (const raw of numbers) {
    if (!raw.startsWith(series)) continue;
    const parsed = Number.parseInt(raw.slice(series.length), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return max;
}

export function formatNumber(prefix: string, year: number, sequence: number, width = 6): string {
  return `${numberSeriesPrefix(prefix, year)}${String(sequence).padStart(width, '0')}`;
}

/**
 * Sous-ensemble de client Prisma suffisant pour la numérotation. Les arguments
 * sont typés `never` en entrée pour que le client Prisma réel, dont les
 * signatures sont génériques et bien plus strictes, reste assignable.
 */
export interface CounterClient {
  documentCounter: {
    create: (args: never) => Promise<{ value: number }>;
    update: (args: never) => Promise<{ value: number }>;
  };
}

function isMissingRow(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025';
}
function isDuplicateRow(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

/**
 * Numéro suivant de la série.
 *
 * L'incrément est un UPDATE atomique : deux requêtes simultanées obtiennent
 * deux valeurs différentes sans verrou applicatif, Postgres sérialisant l'accès
 * à la ligne.
 *
 * `db` DOIT être un client HORS de la transaction métier. Si le compteur était
 * incrémenté dans la transaction de la vente, l'échec de celle-ci annulerait
 * aussi l'incrément : la tentative suivante réobtiendrait le même numéro et
 * l'utilisateur resterait bloqué — précisément le comportement qu'on élimine.
 * Le prix est un trou dans la numérotation quand une création échoue, ce qui
 * est sans conséquence : la loi exige une suite croissante, pas continue.
 *
 * `readExisting` ne sert qu'à l'amorçage — la première utilisation de la série
 * sur cet établissement — pour repartir du plus grand numéro déjà émis. Aucune
 * migration de données n'est donc nécessaire.
 */
export async function nextCounterNumber(
  db: CounterClient,
  tenantId: string,
  prefix: string,
  year: number,
  readExisting: () => Promise<string[]>,
  width = 6,
): Promise<string> {
  const series = seriesKey(prefix, year);
  const where = { tenantId_series: { tenantId, series } };

  try {
    const updated = await db.documentCounter.update({
      where,
      data: { value: { increment: 1 } },
      select: { value: true },
    } as never);
    return formatNumber(prefix, year, updated.value, width);
  } catch (e) {
    if (!isMissingRow(e)) throw e;
  }

  // Amorçage. Deux requêtes peuvent l'atteindre ensemble : celle qui perd la
  // course reçoit une violation de clé primaire et repasse par l'incrément.
  const seed = maxSequence(await readExisting(), prefix, year);
  try {
    const created = await db.documentCounter.create({
      data: { tenantId, series, value: seed + 1 },
      select: { value: true },
    } as never);
    return formatNumber(prefix, year, created.value, width);
  } catch (e) {
    if (!isDuplicateRow(e)) throw e;
    const updated = await db.documentCounter.update({
      where,
      data: { value: { increment: 1 } },
      select: { value: true },
    } as never);
    return formatNumber(prefix, year, updated.value, width);
  }
}

/**
 * Numéro suivant à partir du dernier émis — conservé pour les numérotations qui
 * n'ont pas encore de compteur persistant. Moins robuste : voir l'en-tête.
 */
export function nextSeriesNumber(
  prefix: string,
  year: number,
  lastNumber: string | null | undefined,
  width = 6,
): string {
  const parsed = lastNumber ? maxSequence([lastNumber], prefix, year) : 0;
  return formatNumber(prefix, year, parsed + 1, width);
}
