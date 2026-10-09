import { api } from '../../../lib/api';

export interface ImportPreviewRow {
  sku: string;
  name: string;
  category: string;
  brand: string;
  buyPrice: number;
  sellPrice: number;
  stock: number | null;
  status: 'create' | 'update' | 'error';
  error?: string;
  existingProductId?: string;
}

export type ImportField = 'sku' | 'name' | 'category' | 'brand' | 'buyPrice' | 'sellPrice' | 'stock';

/** Colonnes du fichier et association détectée (champ → indice de colonne). */
export interface ImportColumns {
  headers: string[];
  mapping: Partial<Record<ImportField, number>>;
}

/**
 * Aperçu d'import. `mapping` force l'association de certaines colonnes
 * (choix de l'utilisateur) ; -1 = ignorer le champ.
 */
export async function previewProductImport(
  file: File,
  mapping?: Partial<Record<ImportField, number>>,
): Promise<{ rows: ImportPreviewRow[]; columns: ImportColumns }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ rows: ImportPreviewRow[]; columns?: ImportColumns }>('/products/import/preview', form, {
    params: mapping ? { mapping: JSON.stringify(mapping) } : undefined,
  });
  return { rows: data.rows, columns: data.columns ?? { headers: [], mapping: {} } };
}

export async function commitProductImport(
  branchId: string,
  rows: ImportPreviewRow[],
): Promise<{ created: number; updated: number; errors: string[] }> {
  const { data } = await api.post('/products/import/commit', { branchId, rows });
  return data;
}
