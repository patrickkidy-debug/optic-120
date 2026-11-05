import { RX_IMPORT_COLUMNS } from '@oculo/shared-types';

/**
 * Lecture d'un catalogue fournisseur : CSV (« ; » ou « , », guillemets
 * acceptés) ou classeur Excel. Renvoie des objets dont les clés sont les
 * en-têtes du fichier, tels quels (la normalisation se fait ensuite).
 */
export async function readCatalogFile(file: File): Promise<Record<string, unknown>[]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  }
  return parseCsv((await file.text()).replace(/^﻿/, ''));
}

function parseCsv(text: string): Record<string, unknown>[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** Fichier modèle à remplir (séparateur « ; », décimales avec virgule, prix à la paire). */
export function downloadTemplate() {
  const lines = [
    RX_IMPORT_COLUMNS.join(';'),
    'U156-AR;Unifocal 1.56 antireflet;Stock;Unifocal;1,56;Organique;Antireflet;70;-4,00;+4,00;2,00;;;5000;Verre Clarté 1.56;15000',
    'P160-BLU;Progressif 1.60 lumière bleue;RX;Progressif;1,60;Organique;Filtre lumière bleue;70;-8,00;+6,00;4,00;0,75;3,50;44000;Progressif Écran Premium;115000',
    'B150-DUR;Bifocal 28 mm 1.50 durci;RX;Bifocal;1,50;Organique;Durci;70;-6,00;+6,00;2,00;1,00;3,00;12000;;',
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'modele-catalogue-oculorx.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
