import type { QueryClient } from '@tanstack/react-query';

/**
 * Source unique des familles de requêtes à réactualiser après une mutation.
 *
 * Avant, chaque page recopiait sa propre liste de clés : la page Ventes en
 * invalidait onze, la modale d'anomalie quatre (aucune commune), la page
 * Dépenses deux. Résultat, une correction appliquée depuis Anomalies mettait
 * bien la vente à jour en base mais laissait la liste des ventes et le tableau
 * de bord servir leur cache (`staleTime` de 30 s — voir queryClient.ts), d'où
 * le « parfois ça ne se met pas à jour ».
 *
 * Règle : une mutation ne cite plus de clés, elle déclare ce qu'elle a touché.
 * Toute nouvelle vue financière s'ajoute ICI et devient automatiquement
 * cohérente partout.
 */

/** Vues d'une vente : liste, détail, créances, rapports, stock consommé. */
const SALES_KEYS = [
  ['sales'],
  ['sale'],
  ['sales-report'],
  ['receivables'],
  ['stock'],
  ['pos-stock'],
] as const;

/** Vues chiffrées : tableau de bord, finance, caisse, dépenses, versements. */
const FINANCIAL_KEYS = [
  ['dashboard'],
  ['admin-dashboard'],
  ['finance-summary'],
  ['forecast'],
  ['cash-summary'],
  ['expenses'],
  ['cash-transfers'],
  ['insurer-upcoming'],
] as const;

/** Vues du module Anomalies. */
const ANOMALY_KEYS = [
  ['anomalies'],
  ['anomaly'],
  ['anomalies-dashboard'],
  ['anomalies-journal'],
] as const;

function invalidate(qc: QueryClient, keys: ReadonlyArray<readonly string[]>): void {
  for (const queryKey of keys) qc.invalidateQueries({ queryKey: [...queryKey] });
}

/** Une vente a changé (création, modification, annulation, retour, conversion). */
export function invalidateSalesViews(qc: QueryClient): void {
  invalidate(qc, SALES_KEYS);
  // Une vente qui bouge déplace toujours un chiffre : encaissements, créances,
  // CA du tableau de bord. Les deux familles vont donc de pair.
  invalidate(qc, FINANCIAL_KEYS);
}

/** Un montant a changé sans qu'une vente soit touchée (dépense, versement). */
export function invalidateFinancialViews(qc: QueryClient): void {
  invalidate(qc, FINANCIAL_KEYS);
}

/** Une anomalie a changé d'état (déclarée, approuvée, rejetée, annulée). */
export function invalidateAnomalyViews(qc: QueryClient): void {
  invalidate(qc, ANOMALY_KEYS);
}

/**
 * Une correction d'anomalie a été appliquée : elle a modifié une donnée métier
 * réelle (vente, stock, produit, client, caisse, paiement, assurance). On ne
 * cherche pas à deviner laquelle — tout ce qui affiche un chiffre est réactualisé.
 */
export function invalidateAfterCorrection(qc: QueryClient): void {
  invalidateAnomalyViews(qc);
  invalidateSalesViews(qc);
  invalidate(qc, [['products'], ['customers'], ['lens-orders'], ['repairs'], ['insurance-claims'], ['insurance-refunds']]);
}
