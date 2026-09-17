/**
 * Numérotation des pièces (devis, ventes, avoirs, anomalies, prises en charge,
 * commandes de verres, SAV) — une seule définition pour tous les modules.
 *
 * Règle : le numéro suit le PLUS GRAND déjà émis pour ce préfixe, jamais un
 * COUNT().
 *
 * Un COUNT() suppose une suite sans trou. C'est faux dès qu'une ligne change de
 * numéro ou disparaît du périmètre compté : convertir un devis renomme la ligne
 * (DEV-… devient VEN-…), donc le nombre de devis baisse d'une unité alors que
 * les numéros DEV déjà imprimés restent attribués. count+1 retombe alors sur un
 * numéro existant, la création échoue, et elle échoue DÉFINITIVEMENT puisque
 * chaque nouvelle tentative recalcule le même compte — « son numéro vient
 * d'être attribué à un autre document » sur une pièce créée seule, sans la
 * moindre concurrence.
 *
 * Ceci traite la cause structurelle. La concurrence (deux caissiers au même
 * instant) est traitée séparément par un verrou consultatif Postgres dans la
 * transaction appelante ; les deux sont nécessaires et ne se remplacent pas.
 */

/** Préfixe complet d'une série annuelle, ex. « DEV-2026- ». */
export function numberSeriesPrefix(prefix: string, year: number): string {
  return `${prefix}-${year}-`;
}

/**
 * Numéro suivant d'une série, à partir du dernier numéro émis (ordre
 * décroissant sur la colonne `number`, filtré sur `numberSeriesPrefix`).
 * `lastNumber` vaut null quand la série est vide : la numérotation démarre à 1.
 *
 * Le tri alphabétique convient parce que la partie séquentielle est cadrée à
 * `width` chiffres : « 000010 » se classe bien après « 000009 ».
 */
export function nextSeriesNumber(
  prefix: string,
  year: number,
  lastNumber: string | null | undefined,
  width = 6,
): string {
  const series = numberSeriesPrefix(prefix, year);
  const parsed = lastNumber ? Number.parseInt(lastNumber.slice(series.length), 10) : Number.NaN;
  const next = Number.isFinite(parsed) && parsed > 0 ? parsed + 1 : 1;
  return `${series}${String(next).padStart(width, '0')}`;
}
