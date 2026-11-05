import { RX_FRAME_LABELS, RX_GEOMETRY_LABELS, rxDiopter, type RxFrameType, type RxGeometry } from '@oculo/shared-types';
import type { RxOrder, RxStatement } from './api';
import { formatCurrency, formatDate } from '../../lib/format';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function openPrint(title: string, body: string) {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return alert('Autorisez les fenêtres pop-up pour imprimer.');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page { size: A4 portrait; margin: 12mm 14mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #0f172a;
  font-size: 12px;
  line-height: 1.45;
  background: #ffffff;
}
.accent-bar {
  height: 6px;
  border-radius: 4px;
  background: linear-gradient(90deg, #0f172a 0%, #1e293b 60%, #0284c7 100%);
  margin-bottom: 16px;
}
.head-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}
.doc-title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
  margin: 0;
  text-transform: uppercase;
}
.doc-subtitle {
  font-size: 10px;
  color: #64748b;
  font-weight: 600;
  margin: 2px 0 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.order-badge-box {
  border: 1.5px solid #0f172a;
  border-radius: 8px;
  padding: 8px 14px;
  text-align: right;
  background: #f8fafc;
  display: inline-block;
}
.order-number {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.04em;
}
.order-date {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
.urgent-badge {
  display: inline-block;
  background: #ef4444;
  color: #ffffff;
  font-weight: 700;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 4px;
}
.standard-badge {
  display: inline-block;
  background: #e2e8f0;
  color: #334155;
  font-weight: 600;
  font-size: 9px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 4px;
}
.party-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 12px 0;
  margin: 0 -12px 14px;
}
.party-card {
  width: 50%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  background: #f8fafc;
  vertical-align: top;
}
.party-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 4px;
}
.party-name {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}
.party-sub {
  font-size: 11px;
  color: #475569;
  margin-top: 2px;
}
.patient-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  background: #f8fafc;
  margin-bottom: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.patient-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}
.patient-tag {
  font-family: Consolas, monospace;
  font-size: 11px;
  color: #475569;
  background: #ffffff;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
}
.section-heading {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
  margin: 14px 0 6px;
}
.rx-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
  border-radius: 8px;
  overflow: hidden;
  border: 1.5px solid #0f172a;
}
.rx-table th {
  background: #0f172a;
  color: #ffffff;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 8px 10px;
  font-weight: 700;
}
.rx-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  font-size: 13px;
}
.rx-table td:last-child {
  border-right: 0;
}
.rx-table tr:last-child td {
  border-bottom: 0;
}
.rx-eye-badge {
  display: inline-block;
  width: 34px;
  padding: 2px 0;
  text-align: center;
  color: #ffffff;
  border-radius: 4px;
  font-weight: 800;
  font-size: 11px;
}
.rx-eye-od { background: #0284c7; }
.rx-eye-og { background: #0d9488; }
.rx-num {
  text-align: right;
  font-family: Consolas, monospace;
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
}
.lens-box {
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px 14px;
  background: #ffffff;
  margin-bottom: 14px;
}
.lens-main-name {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}
.spec-tags {
  margin-top: 6px;
}
.spec-pill {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #334155;
  margin-right: 5px;
  margin-bottom: 4px;
}
.spec-pill b { color: #0f172a; }
.supplier-note-small {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
  font-size: 10px;
  color: #64748b;
}
.specs-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 8px 0;
  margin: 0 -8px 14px;
}
.spec-col {
  width: 25%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  background: #f8fafc;
  vertical-align: top;
}
.spec-col-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 2px;
}
.spec-col-val {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  font-family: Consolas, monospace;
}
.comment-alert {
  border-left: 3.5px solid #f59e0b;
  background: #fffbeb;
  border-radius: 0 8px 8px 0;
  padding: 8px 12px;
  margin-bottom: 14px;
  font-size: 11px;
  color: #92400e;
}
.comment-alert b { color: #b45309; }
.sign-table {
  width: 100%;
  margin-top: 22px;
  border-collapse: separate;
  border-spacing: 12px 0;
  margin-left: -12px;
  margin-right: -12px;
  page-break-inside: avoid;
}
.sign-box {
  width: 50%;
  border: 1px dashed #94a3b8;
  border-radius: 8px;
  padding: 8px 12px;
  height: 60px;
  vertical-align: top;
  background: #ffffff;
}
.sign-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}
.foot {
  margin-top: 18px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 10px;
}
.mono { font-family: Consolas, monospace; }
</style></head><body>${body}
<script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`);
  w.document.close();
}

/** Bon de commande imprimable (ou à enregistrer en PDF) pour le fournisseur. */
export function printOrderSheet(o: RxOrder, store: { name: string; phone?: string | null }) {
  const eye = (label: string, badgeClass: string, e: RxOrder['od']) =>
    `<tr>
      <td style="width:50px;text-align:center"><span class="rx-eye-badge ${badgeClass}">${label}</span></td>
      <td class="rx-num">${rxDiopter(e.sph)}</td>
      <td class="rx-num">${rxDiopter(e.cyl)}</td>
      <td class="rx-num">${e.axis != null ? `${e.axis}°` : '—'}</td>
      <td class="rx-num">${rxDiopter(o.addition)}</td>
    </tr>`;

  const options = [o.mounted && 'Taillé-monté', o.urgent && 'URGENT'].filter(Boolean).join(' · ') || 'Standard (non monté)';
  const frameText = o.frameType ? RX_FRAME_LABELS[o.frameType as RxFrameType] : '—';
  const geoText = RX_GEOMETRY_LABELS[o.lens.geometry as RxGeometry] ?? o.lens.geometry;

  // Si un nom boutique existe, on l'affiche en titre principal, et le nom fournisseur en bas en petit caractere uniquement
  const hasShopName = Boolean(o.lens.shopName);
  const mainLensName = hasShopName ? o.lens.shopName! : o.lens.designation;

  const html = `
<div class="accent-bar"></div>

<table class="head-table">
  <tr>
    <td style="vertical-align:top">
      <h1 class="doc-title">Bon de commande de verres</h1>
      <p class="doc-subtitle">OculoRX · Surfaçage & Taillage Ophtalmique</p>
    </td>
    <td style="vertical-align:top;text-align:right">
      <div class="order-badge-box">
        <div class="order-number">${esc(o.number)}</div>
        <div class="order-date">Émis le ${esc(formatDate(o.createdAt))}</div>
        ${o.urgent ? '<span class="urgent-badge">🚨 Urgent</span>' : '<span class="standard-badge">Délai standard</span>'}
        ${o.lensOrder?.trackCode ? `<div style="font-size:10px;color:#0284c7;font-family:Consolas,monospace;margin-top:3px">Suivi : ${esc(o.lensOrder.trackCode)}</div>` : ''}
      </div>
    </td>
  </tr>
</table>

<table class="party-table">
  <tr>
    <td class="party-card">
      <div class="party-label">Émetteur (Boutique / Opticien)</div>
      <div class="party-name">${esc(store.name)}</div>
      ${store.phone ? `<div class="party-sub">Tél : ${esc(store.phone)}</div>` : ''}
      ${o.userName ? `<div class="party-sub">Commandé par : ${esc(o.userName)}</div>` : ''}
    </td>
    <td class="party-card">
      <div class="party-label">Destinataire (Fournisseur / Laboratoire)</div>
      <div class="party-name">${esc(o.supplier.name)}</div>
      ${o.supplier.code ? `<div class="party-sub">Code : <span class="mono">${esc(o.supplier.code)}</span></div>` : ''}
      ${o.supplier.phone || o.supplier.whatsapp ? `<div class="party-sub">Contact : ${esc(o.supplier.phone || o.supplier.whatsapp)}</div>` : ''}
    </td>
  </tr>
</table>

<div class="patient-card">
  <div>
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.06em">Patient</div>
    <div class="patient-title">${esc(o.patientName)}</div>
  </div>
  ${o.fileNumber ? `<div class="patient-tag">Dossier N° ${esc(o.fileNumber)}</div>` : ''}
</div>

<div class="section-heading">1 · Prescription optique (Dioptries)</div>
<table class="rx-table">
  <thead>
    <tr>
      <th style="width:50px;text-align:center">Œil</th>
      <th style="text-align:right">Sphère (D)</th>
      <th style="text-align:right">Cylindre (D)</th>
      <th style="text-align:right">Axe</th>
      <th style="text-align:right">Addition (D)</th>
    </tr>
  </thead>
  <tbody>
    ${eye('OD', 'rx-eye-od', o.od)}
    ${eye('OG', 'rx-eye-og', o.og)}
  </tbody>
</table>

<div class="section-heading">2 · Verre commandé</div>
<div class="lens-box">
  <div class="lens-main-name">${esc(mainLensName)}</div>
  <div class="spec-tags">
    <span class="spec-pill">Géométrie : <b>${esc(geoText)}</b></span>
    ${o.lens.lensIndex ? `<span class="spec-pill">Indice : <b>${esc(String(o.lens.lensIndex).replace('.', ','))}</b></span>` : ''}
    ${o.lens.fabrication ? `<span class="spec-pill">Fabrication : <b>${esc(o.lens.fabrication)}</b></span>` : ''}
    ${o.lens.material ? `<span class="spec-pill">Matière : <b>${esc(o.lens.material)}</b></span>` : ''}
    ${o.lens.treatment ? `<span class="spec-pill">Traitements : <b>${esc(o.lens.treatment)}</b></span>` : ''}
  </div>
  ${hasShopName ? `
    <div class="supplier-note-small">
      <b>Désignation fournisseur :</b> ${esc(o.lens.designation)} &nbsp;·&nbsp; <b>Réf. usine :</b> <span class="mono">${esc(o.lens.reference)}</span>
    </div>
  ` : `
    <div class="supplier-note-small">
      <b>Réf. usine :</b> <span class="mono">${esc(o.lens.reference)}</span>
    </div>
  `}
</div>

<div class="section-heading">3 · Paramètres d'atelier & montage</div>
<table class="specs-table">
  <tr>
    <td class="spec-col">
      <div class="spec-col-label">Écart pupillaire (EP)</div>
      <div class="spec-col-val">${o.pd != null ? `${o.pd} mm` : '—'}</div>
    </td>
    <td class="spec-col">
      <div class="spec-col-label">Hauteur de montage</div>
      <div class="spec-col-val">${o.height != null ? `${o.height} mm` : '—'}</div>
    </td>
    <td class="spec-col">
      <div class="spec-col-label">Type de monture</div>
      <div class="spec-col-val" style="font-family:inherit">${esc(frameText)}</div>
    </td>
    <td class="spec-col">
      <div class="spec-col-label">Façonnage</div>
      <div class="spec-col-val" style="font-family:inherit;font-size:11px">${esc(options)}</div>
    </td>
  </tr>
</table>

${o.comment ? `
  <div class="comment-alert">
    <b>Instructions atelier :</b> ${esc(o.comment)}
  </div>
` : ''}

<table class="sign-table">
  <tr>
    <td class="sign-box">
      <div class="sign-title">Visa / Signature opticien</div>
    </td>
    <td class="sign-box">
      <div class="sign-title">Réception laboratoire (Date & Visa)</div>
    </td>
  </tr>
</table>

<div class="foot">
  <span>Document électronique généré par OculoSaaS · Module OculoRX</span>
  <span>Vérifiez la conformité des verres à réception sous 48h.</span>
</div>
`;

  openPrint(`Bon de commande ${o.number}`, html);
}

/** Relevé mensuel fournisseur imprimable (sans le bloc de marge interne). */
export function printStatement(st: RxStatement, store: { name: string; phone?: string | null; location?: string | null }) {
  const [y, m] = st.month.split('-').map(Number);
  const period = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 15)));
  openPrint(st.number, `<div class="accent-bar"></div>
<table class="head-table"><tr>
  <td><h1 class="doc-title">Relevé fournisseur</h1><p class="doc-subtitle">Période : ${esc(period)} · ${st.orderCount} commande(s)</p></td>
  <td style="text-align:right"><b>${esc(store.name)}</b>${store.location ? `<br><span style="color:#64748b">${esc(store.location)}</span>` : ''}${store.phone ? `<br><span style="color:#64748b">${esc(store.phone)}</span>` : ''}</td>
</tr></table>
<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;background:#f8fafc;margin-bottom:14px">
  <b>Fournisseur :</b> ${esc(st.supplier.name)} (${esc(st.supplier.code)})${st.supplier.city ? ` · ${esc(st.supplier.city)}` : ''}${st.supplier.country ? `, ${esc(st.supplier.country)}` : ''}${st.supplier.phone ? ` · ${esc(st.supplier.phone)}` : ''}
</div>
<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1.5px solid #0f172a">
  <th style="padding:6px;font-size:10px;text-transform:uppercase;color:#64748b;text-align:left">Date</th>
  <th style="padding:6px;font-size:10px;text-transform:uppercase;color:#64748b;text-align:left">N°</th>
  <th style="padding:6px;font-size:10px;text-transform:uppercase;color:#64748b;text-align:left">Patient</th>
  <th style="padding:6px;font-size:10px;text-transform:uppercase;color:#64748b;text-align:left">Verre</th>
  <th style="padding:6px;font-size:10px;text-transform:uppercase;color:#64748b;text-align:left">Suppléments</th>
  <th style="padding:6px;font-size:10px;text-transform:uppercase;color:#64748b;text-align:right">Montant HT</th>
</tr></thead><tbody>
${st.lines.map((l) => `<tr style="border-bottom:1px solid #eee"><td style="padding:6px">${esc(formatDate(l.date))}</td><td style="padding:6px;font-family:Consolas,monospace">${esc(l.number)}${l.credit ? ' (avoir)' : ''}</td><td style="padding:6px">${esc(l.patient)}</td><td style="padding:6px">${esc(l.lens)}</td><td style="padding:6px">${esc(l.supplements || '—')}</td><td style="padding:6px;text-align:right;font-family:Consolas,monospace">${esc(l.amount < 0 ? `− ${formatCurrency(-l.amount)}` : formatCurrency(l.amount))}</td></tr>`).join('')}
</tbody></table>
<table style="width:45%;margin:14px 0 0 auto;border-collapse:collapse">
  <tr><td style="padding:4px 6px">Total HT</td><td style="padding:4px 6px;text-align:right;font-family:Consolas,monospace">${esc(formatCurrency(st.totalHt))}</td></tr>
  <tr><td style="padding:4px 6px">TVA ${String(st.vatRate).replace('.', ',')} % sur suppléments<br><span style="font-size:10px;color:#64748b">Verres exonérés de TVA</span></td><td style="padding:4px 6px;text-align:right;font-family:Consolas,monospace">${esc(formatCurrency(st.vatAmount))}</td></tr>
  <tr style="font-weight:800;font-size:14px;border-top:1.5px solid #0f172a"><td style="padding:8px 6px">Total TTC</td><td style="padding:8px 6px;text-align:right;font-family:Consolas,monospace">${esc(formatCurrency(st.totalTtc))}</td></tr>
</table>
<p style="margin-top:18px"><b>Échéance :</b> ${esc(formatDate(st.dueDate))}</p>
<div class="foot"><span>Relevé établi avec OculoSaaS · OculoRX</span></div>`);
}
