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
  /** Information non bloquante (ex. référence en double renommée). */
  note?: string;
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
  fileName?: string,
): Promise<{ created: number; updated: number; errors: string[] }> {
  const { data } = await api.post('/products/import/commit', { branchId, rows, fileName });
  return data;
}

/** Import encore présent au catalogue (fichier, date, nombre de produits). */
export interface ImportBatch {
  id: string;
  file: string | null;
  importedAt: string;
  count: number;
  categories: Record<string, number>;
  sample: string[];
  legacy: boolean;
}

export async function listImportBatches(): Promise<ImportBatch[]> {
  const { data } = await api.get<{ batches: ImportBatch[] }>('/products/import/batches');
  return data.batches;
}

export async function deleteImportBatch(id: string): Promise<{ deleted: number; deactivated: number }> {
  const { data } = await api.delete(`/products/import/batches/${encodeURIComponent(id)}`);
  return data;
}
