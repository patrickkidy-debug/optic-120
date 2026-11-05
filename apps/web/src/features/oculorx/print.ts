import { RX_FRAME_LABELS, RX_GEOMETRY_LABELS, rxDiopter, type RxFrameType, type RxGeometry } from '@oculo/shared-types';
import type { RxOrder, RxStatement } from './api';
import { formatCurrency, formatDate } from '../../lib/format';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function openPrint(title: string, body: string) {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return alert('Autorisez les fenêtres pop-up pour imprimer.');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:A4;margin:14mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Segoe UI',Arial,sans-serif;color:#1e1b2e;font-size:12px;background:#fff}
h1{font-size:18px;margin:0}.muted{color:#6b6585}.band{height:5px;border-radius:5px;background:#120a2b;margin-bottom:14px}
.head{display:flex;justify-content:space-between;gap:20px;margin-bottom:16px}.box{border:1px solid #e7e3f3;border-radius:10px;padding:10px 12px}
table{width:100%;border-collapse:collapse}th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8a84a3;text-align:left;border-bottom:1.5px solid #1e1b2e;padding:6px}
td{padding:6px;border-bottom:1px solid #eee}.num{text-align:right;font-family:Consolas,monospace;white-space:nowrap}
.tot td{border:0;padding:4px 6px}.tot .big td{font-weight:800;font-size:14px;border-top:1.5px solid #1e1b2e;padding-top:8px}
.mono{font-family:Consolas,monospace}</style></head><body>${body}
<script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`);
  w.document.close();
}

/** Bon de commande imprimable (ou à enregistrer en PDF) pour le fournisseur. */
export function printOrderSheet(o: RxOrder, store: { name: string; phone?: string | null }) {
  const eye = (label: string, e: RxOrder['od']) =>
    `<tr><td><b>${label}</b></td><td class="num">${rxDiopter(e.sph)}</td><td class="num">${rxDiopter(e.cyl)}</td><td class="num">${e.axis != null ? `${e.axis}°` : '—'}</td></tr>`;
  const options = [o.mounted && 'Taillé-monté', o.urgent && 'URGENT'].filter(Boolean).join(' · ') || '—';
  openPrint(`Bon de commande ${o.number}`, `<div class="band"></div>
<div class="head"><div><h1>Bon de commande ${esc(o.number)}</h1><p class="muted">${esc(formatDate(o.createdAt))}</p></div>
<div style="text-align:right"><b>${esc(store.name)}</b>${store.phone ? `<br><span class="muted">${esc(store.phone)}</span>` : ''}<br>→ <b>${esc(o.supplier.name)}</b></div></div>
<div class="box" style="margin-bottom:12px"><b>Verre :</b> <span class="mono">${esc(o.lens.reference)}</span> — ${esc(o.lens.designation)}
<span class="muted">(${esc(RX_GEOMETRY_LABELS[o.lens.geometry as RxGeometry] ?? o.lens.geometry)}${o.lens.lensIndex ? `, indice ${esc(String(o.lens.lensIndex).replace('.', ','))}` : ''}${o.lens.treatment ? `, ${esc(o.lens.treatment)}` : ''})</span></div>
<div class="box" style="margin-bottom:12px"><b>Patient :</b> ${esc(o.patientName)}${o.fileNumber ? ` · dossier ${esc(o.fileNumber)}` : ''}</div>
<table style="margin-bottom:12px"><thead><tr><th></th><th class="num">Sphère</th><th class="num">Cylindre</th><th class="num">Axe</th></tr></thead><tbody>${eye('OD', o.od)}${eye('OG', o.og)}</tbody></table>
<div class="box"><b>Addition :</b> ${rxDiopter(o.addition)} &nbsp; <b>EP :</b> ${o.pd ?? '—'} mm &nbsp; <b>Hauteur :</b> ${o.height ?? '—'} mm<br>
<b>Monture :</b> ${esc(o.frameType ? RX_FRAME_LABELS[o.frameType as RxFrameType] : '—')} &nbsp; <b>Options :</b> ${esc(options)}
${o.comment ? `<br><b>Commentaire :</b> ${esc(o.comment)}` : ''}</div>
<p class="muted" style="margin-top:30px">Commande passée via OculoSaaS · OculoRX</p>`);
}

/** Relevé mensuel fournisseur imprimable (sans le bloc de marge interne). */
export function printStatement(st: RxStatement, store: { name: string; phone?: string | null; location?: string | null }) {
  const [y, m] = st.month.split('-').map(Number);
  const period = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 15)));
  openPrint(st.number, `<div class="band"></div>
<div class="head"><div><h1>Relevé ${esc(st.number)}</h1><p class="muted">Période : ${esc(period)} · ${st.orderCount} commande(s)</p></div>
<div style="text-align:right"><b>${esc(store.name)}</b>${store.location ? `<br><span class="muted">${esc(store.location)}</span>` : ''}${store.phone ? `<br><span class="muted">${esc(store.phone)}</span>` : ''}</div></div>
<div class="box" style="margin-bottom:14px"><b>Fournisseur :</b> ${esc(st.supplier.name)} (${esc(st.supplier.code)})${st.supplier.city ? ` · ${esc(st.supplier.city)}` : ''}${st.supplier.country ? `, ${esc(st.supplier.country)}` : ''}${st.supplier.phone ? ` · ${esc(st.supplier.phone)}` : ''}</div>
<table><thead><tr><th>Date</th><th>N°</th><th>Patient</th><th>Verre</th><th>Suppléments</th><th class="num">Montant HT</th></tr></thead><tbody>
${st.lines.map((l) => `<tr><td>${esc(formatDate(l.date))}</td><td class="mono">${esc(l.number)}${l.credit ? ' (avoir)' : ''}</td><td>${esc(l.patient)}</td><td>${esc(l.lens)}</td><td>${esc(l.supplements || '—')}</td><td class="num">${esc(l.amount < 0 ? `− ${formatCurrency(-l.amount)}` : formatCurrency(l.amount))}</td></tr>`).join('')}
</tbody></table>
<table class="tot" style="width:45%;margin:14px 0 0 auto"><tr><td>Total HT</td><td class="num">${esc(formatCurrency(st.totalHt))}</td></tr>
<tr><td>TVA ${String(st.vatRate).replace('.', ',')} % sur suppléments<br><span class="muted" style="font-size:10px">Verres exonérés de TVA</span></td><td class="num">${esc(formatCurrency(st.vatAmount))}</td></tr>
<tr class="big"><td>Total TTC</td><td class="num">${esc(formatCurrency(st.totalTtc))}</td></tr></table>
<p style="margin-top:18px"><b>Échéance :</b> ${esc(formatDate(st.dueDate))}</p>
<p class="muted" style="margin-top:30px">Relevé établi avec OculoSaaS · OculoRX</p>`);
}
