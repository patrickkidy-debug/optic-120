import type { QueryClient } from '@tanstack/react-query';

/**
 * Toutes les vues qui dépendent du catalogue ou des quantités en stock.
 * Après une création, une modification, un ajustement ou une suppression de
 * produit, elles doivent toutes repartir du serveur — sinon un produit
 * supprimé continue d'apparaître ailleurs (caisse, étiquettes, tableau de
 * bord, badge « stock faible »…).
 */
const PRODUCT_STOCK_KEYS = [
  'products',
  'products-labels',
  'product-sku-check',
  'stock',
  'pos-stock',
  'stock-movements',
  'lowStock',
  'dashboard',
  'admin-dashboard',
  'forecast',
];

/** Rafraîchit partout le catalogue et les quantités en stock. */
export function invalidateProductViews(qc: QueryClient): void {
  PRODUCT_STOCK_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
}
