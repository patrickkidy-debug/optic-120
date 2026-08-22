export interface ExportRow {
  sku: string;
  name: string;
  category: string;
  brand?: string | null;
  /** Absent quand la source n'a pas le prix d'achat (ex. export depuis la page Stock). */
  buyPrice?: number | null;
  sellPrice: number;
  stock?: number | null;
}

const HEADERS = ['Référence', 'Nom', 'Catégorie', 'Marque', "Prix d'achat", 'Prix de vente', 'Stock'];

function toTableRows(rows: ExportRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.sku,
    r.name,
    r.category,
    r.brand ?? '',
    r.buyPrice ?? '',
    r.sellPrice,
    r.stock ?? '',
  ]);
}

/**
 * Génère un vrai classeur .xlsx et déclenche le téléchargement. La lib SheetJS
 * (~300 kB) est chargée à la demande : elle ne pèse pas sur le premier rendu
 * des pages Catalogue/Stock, qui s'ouvrent bien plus souvent qu'on exporte.
 */
export async function exportProductsExcel(rows: ExportRow[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const data = [HEADERS, ...toTableRows(rows)];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Produits');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Catalogue imprimable : même technique que les factures/ordonnances (fenêtre + window.print). */
export function exportProductsPdf(rows: ExportRow[], title: string): void {
  const tableRows = toTableRows(rows)
    .map(
      (r) =>
        `<tr>${r.map((c, i) => `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:${i >= 4 ? 'right' : 'left'};">${c}</td>`).join('')}</tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      p { font-size: 12px; color: #6b7280; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
      th { text-align: left; padding: 6px 10px; border-bottom: 2px solid #111827; font-size: 11px; text-transform: uppercase; }
      th:nth-child(n+5) { text-align: right; }
    </style>
  </head><body>
    <h1>${title}</h1>
    <p>${rows.length} article(s) — généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    <table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert("Veuillez autoriser les fenêtres pop-up pour générer le PDF.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}
