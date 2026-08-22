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

export async function previewProductImport(file: File): Promise<ImportPreviewRow[]> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ rows: ImportPreviewRow[] }>('/products/import/preview', form);
  return data.rows;
}

export async function commitProductImport(
  branchId: string,
  rows: ImportPreviewRow[],
): Promise<{ created: number; updated: number; errors: string[] }> {
  const { data } = await api.post('/products/import/commit', { branchId, rows });
  return data;
}
