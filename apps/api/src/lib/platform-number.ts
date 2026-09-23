import { prisma } from './prisma.js';
import { formatNumber, maxSequence, numberSeriesPrefix, seriesKey } from './document-number.js';

/**
 * Numérotation des pièces de l'ÉDITEUR : factures « FAC-2026-000001 » et avoirs
 * « AV-2026-000001 ».
 *
 * Pourquoi un compteur distinct de DocumentCounter : celui-ci est rattaché à un
 * établissement par clé étrangère, parce que chaque opticien numérote ses
 * propres devis et ventes. Les factures d'OculoSaaS forment au contraire UNE
 * seule suite, tous clients confondus — c'est cette suite qu'un comptable ou un
 * contrôleur lit. Réutiliser DocumentCounter aurait imposé de choisir un
 * établissement porteur arbitraire, ou de donner une suite par client.
 *
 * Les mêmes propriétés que la numérotation des ventes sont conservées, et pour
 * les mêmes raisons (voir l'en-tête de document-number.ts) :
 *   - l'incrément est un UPDATE atomique, donc deux requêtes simultanées
 *     obtiennent deux numéros différents sans verrou applicatif ;
 *   - il n'est jamais fait dans la transaction métier, sinon un échec de
 *     celle-ci annulerait l'incrément et la tentative suivante réobtiendrait le
 *     même numéro — la collision deviendrait permanente ;
 *   - la suite est croissante, pas continue. Un trou après un échec de création
 *     est sans conséquence.
 *
 * Les factures historiques de la série « ABN- » gardent leurs numéros : aucune
 * pièce déjà émise n'est renumérotée.
 */

export const INVOICE_PREFIX = 'FAC';
export const CREDIT_NOTE_PREFIX = 'AV';

function isMissingRow(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025';
}
function isDuplicateRow(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

async function bump(series: string): Promise<number> {
  const updated = await prisma.platformCounter.update({
    where: { series },
    data: { value: { increment: 1 } },
    select: { value: true },
  });
  return updated.value;
}

/**
 * Numéro suivant de la série plateforme.
 *
 * L'amorçage relit le plus grand numéro déjà émis dans la série — et non un
 * COUNT, ni un `ORDER BY number DESC` qui trie lexicographiquement. Il n'a lieu
 * qu'une fois par année civile, donc aucune migration de données n'est requise.
 */
export async function nextPlatformNumber(
  prefix: string = INVOICE_PREFIX,
  year: number = new Date().getFullYear(),
  width = 6,
): Promise<string> {
  const series = seriesKey(prefix, year);

  try {
    return formatNumber(prefix, year, await bump(series), width);
  } catch (e) {
    if (!isMissingRow(e)) throw e;
  }

  const rows = await prisma.subscriptionInvoice.findMany({
    where: { number: { startsWith: numberSeriesPrefix(prefix, year) } },
    select: { number: true },
  });
  const seed = maxSequence(
    rows.map((r) => r.number),
    prefix,
    year,
  );

  try {
    const created = await prisma.platformCounter.create({
      data: { series, value: seed + 1 },
      select: { value: true },
    });
    return formatNumber(prefix, year, created.value, width);
  } catch (e) {
    // Course à l'amorçage : la requête perdante reçoit une violation de clé
    // primaire et repasse par l'incrément, qui rend un numéro strictement
    // supérieur.
    if (!isDuplicateRow(e)) throw e;
    return formatNumber(prefix, year, await bump(series), width);
  }
}
