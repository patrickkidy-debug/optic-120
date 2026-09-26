import type { Prisma } from '@prisma/client';

/**
 * Écritures de stock ATOMIQUES.
 *
 * Toutes les écritures de quantité passent par ici. L'ancienne forme lisait la
 * ligne puis écrivait `quantity: item.quantity - n` : deux requêtes
 * simultanées lisaient la même valeur, et la seconde écrasait la première.
 * Stock 10, une vente de 1 et une vente de 2 en même temps : 8 ou 9 au lieu
 * de 7. Le défaut existait en ligne ; la synchronisation hors-ligne, qui
 * renvoie des ventes par paquets depuis plusieurs appareils, le rend fréquent.
 *
 * Ici, le calcul est fait par Postgres dans l'UPDATE lui-même
 * (`quantity = quantity - n`), sous le verrou de ligne : aucune mise à jour ne
 * peut en effacer une autre, quel que soit l'ordre d'arrivée.
 */

type Tx = Prisma.TransactionClient;

/**
 * Retire `qty` du stock si, et seulement si, la quantité disponible suffit.
 * La vérification et le retrait forment une seule instruction : aucune autre
 * vente ne peut s'intercaler entre les deux.
 *
 * @returns false si le stock est insuffisant — rien n'a alors été modifié.
 */
export async function decrementStockIfAvailable(
  tx: Tx,
  stockItemId: string,
  qty: number,
): Promise<boolean> {
  const res = await tx.stockItem.updateMany({
    where: { id: stockItemId, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });
  return res.count === 1;
}

/**
 * Ajoute (ou retire, si négatif) `delta` sans condition : retours, annulations,
 * réceptions, et ventes hors-ligne déjà réalisées physiquement.
 */
export async function adjustStockBy(tx: Tx, stockItemId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  await tx.stockItem.update({
    where: { id: stockItemId },
    data: { quantity: { increment: delta } },
  });
}
