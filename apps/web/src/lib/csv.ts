type Cell = string | number | null | undefined;

/**
 * Convertit des lignes en CSV (séparateur « ; » pour Excel francophone) et
 * déclenche le téléchargement du fichier. Ajoute un BOM UTF-8 pour qu'Excel
 * affiche correctement les accents.
 */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const esc = (v: Cell) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const sep = ';';
  const lines = [headers.map(esc).join(sep), ...rows.map((r) => r.map(esc).join(sep))];
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
