import { mirrorRadii, radiiToPoints, type Precal } from '@oculo/shared-types';
import type { CompanyInfo } from '../optique/saleDocument';
import type { FrameTrace } from './api';
import { computePrecal, fmtDpt, fmtMm, type EyeResult, type PrecalResult } from './precal';
import { tr } from '../../lib/tr';
import { displayLocale } from '../../lib/format';

const L = (k: string, o?: Record<string, unknown>) => tr(`oculolab.sheet.${k}`, o);

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Dessin d'un verre en vraie grandeur (unités SVG = mm, largeur en mm) :
 * contour, boîte, centre de boîte, centre optique et diamètre minimal.
 * `side` : 'od' dessiné tel quel, 'og' en miroir (x vers le nez inversé).
 */
function eyeSvg(radii: readonly number[], eye: EyeResult, side: 'od' | 'og', a: number, b: number): string {
  const shape = side === 'od' ? radii : mirrorRadii(radii);
  const pts = radiiToPoints(shape);
  const sx = side === 'od' ? 1 : -1;
  const oc = { x: eye.oc.x * sx, y: eye.oc.y };
  const pad = 4;
  const r = eye.mbd / 2;
  const half = Math.max(a / 2, b / 2, Math.abs(oc.x) + r, Math.abs(oc.y) + r) + pad;
  const size = half * 2;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(' ') + 'Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.toFixed(1)}mm" height="${size.toFixed(1)}mm" viewBox="${-half} ${-half} ${size} ${size}">
    <rect x="${-a / 2}" y="${-b / 2}" width="${a}" height="${b}" fill="none" stroke="#94a3b8" stroke-width="0.2" stroke-dasharray="1 0.8"/>
    <line x1="${-a / 2 - 2}" y1="0" x2="${a / 2 + 2}" y2="0" stroke="#cbd5e1" stroke-width="0.15"/>
    <line x1="0" y1="${-b / 2 - 2}" x2="0" y2="${b / 2 + 2}" stroke="#cbd5e1" stroke-width="0.15"/>
    <circle cx="${oc.x}" cy="${-oc.y}" r="${r}" fill="none" stroke="#64748b" stroke-width="0.2" stroke-dasharray="0.6 0.6"/>
    <path d="${path}" fill="rgba(124,58,237,0.06)" stroke="#111827" stroke-width="0.35"/>
    <g stroke="#dc2626" stroke-width="0.3">
      <line x1="${oc.x - 2.5}" y1="${-oc.y}" x2="${oc.x + 2.5}" y2="${-oc.y}"/>
      <line x1="${oc.x}" y1="${-oc.y - 2.5}" x2="${oc.x}" y2="${-oc.y + 2.5}"/>
    </g>
    <text x="${-half + 1}" y="${-half + 3.5}" font-size="3" font-family="Arial" font-weight="700">${side === 'od' ? 'OD' : 'OG'}</text>
  </svg>`;
}

function eyeRows(p: Precal, res: PrecalResult): string {
  const row = (label: string, od: string, og: string) => `<tr><th>${esc(label)}</th><td>${esc(od)}</td><td>${esc(og)}</td></tr>`;
  const e = (side: 'od' | 'og') => ({ in: p[side], out: res[side] });
  const o = e('od'), g = e('og');
  const hDec = (r: EyeResult) => (r.oc.x === 0 ? '0.0' : `${fmtMm(Math.abs(r.oc.x))} ${r.oc.x > 0 ? L('nasal') : L('temporal')}`);
  const vDec = (r: EyeResult) => (r.oc.y === 0 ? '0.0' : `${fmtMm(Math.abs(r.oc.y))} ${r.oc.y > 0 ? L('up') : L('down')}`);
  return [
    row(L('sphere'), fmtDpt(o.in.sphere), fmtDpt(g.in.sphere)),
    row(L('cylinder'), fmtDpt(o.in.cylinder), fmtDpt(g.in.cylinder)),
    row(L('axis'), o.in.axis != null ? `${o.in.axis}°` : '—', g.in.axis != null ? `${g.in.axis}°` : '—'),
    row(L('addition'), fmtDpt(o.in.addition), fmtDpt(g.in.addition)),
    row(L('monoPd'), fmtMm(o.in.monoPd), fmtMm(g.in.monoPd)),
    row(L('height'), fmtMm(o.in.height), fmtMm(g.in.height)),
    row(L('hDecentration'), hDec(o.out), hDec(g.out)),
    row(L('vDecentration'), vDec(o.out), vDec(g.out)),
    row(L('mbd'), `Ø ${fmtMm(o.out.mbd)}`, `Ø ${fmtMm(g.out.mbd)}`),
    row(L('blank'), o.out.blank ? `Ø ${o.out.blank}` : L('special'), g.out.blank ? `Ø ${g.out.blank}` : L('special')),
  ].join('');
}

function thicknessTable(res: PrecalResult, chosen: number | null | undefined): string {
  const eyes = (['od', 'og'] as const).filter((s) => res[s].thickness.length);
  if (!eyes.length) return '';
  const head = res[eyes[0]!].thickness.map((t) => `<th${t.index === chosen ? ' class="sel"' : ''}>${t.index.toFixed(2)}</th>`).join('');
  const body = eyes
    .map((s) => {
      const r = res[s];
      const cells = r.thickness
        .map((t) => `<td${t.index === chosen ? ' class="sel"' : ''}>${(r.power ?? 0) < 0 ? `${L('edge')} ${t.edge.toFixed(1)}` : `${L('center')} ${t.center.toFixed(1)}`}</td>`)
        .join('');
      return `<tr><th>${s.toUpperCase()} (${fmtDpt(r.power)})</th>${cells}</tr>`;
    })
    .join('');
  return `<h3>${esc(L('thicknessTitle'))}</h3>
    <table class="grid small"><tr><th>${esc(L('index'))}</th>${head}</tr>${body}</table>
    <p class="hint">${esc(L('thicknessHint'))}</p>`;
}

export function buildPrecalSheetHtml(trace: FrameTrace, company: CompanyInfo): string {
  const p = trace.precal;
  const res = computePrecal(trace.radii, trace.dbl, p, { frameType: trace.frameType });
  const { a, b, ed, circumference } = res.stats;
  const date = new Intl.DateTimeFormat(displayLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(trace.updatedAt || trace.createdAt));
  const customer = trace.customer ? `${trace.customer.firstName} ${trace.customer.lastName}` : '—';
  const accent = company.accentColor || '#7c3aed';
  const kv = (k: string, v: string) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  const warnings = res.warnings.filter((w) => w.level === 'danger' && w.code !== 'lowConfidence');

  return `<!doctype html><html lang="${esc(displayLocale())}"><head><meta charset="utf-8"><title>${esc(trace.number)} — ${esc(L('title'))}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 10.5pt; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${esc(accent)}; padding-bottom: 6px; }
  header img { max-height: 16mm; max-width: 45mm; }
  h1 { font-size: 17pt; margin: 0; letter-spacing: .5px; }
  h3 { font-size: 10.5pt; margin: 10px 0 4px; text-transform: uppercase; color: #374151; }
  .muted { color: #6b7280; font-size: 9pt; }
  .cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px; }
  .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 8px; }
  .kv { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .kv span { color: #6b7280; }
  .shapes { display: flex; justify-content: center; gap: 6mm; align-items: center; margin: 4px 0; }
  table.grid { width: 100%; border-collapse: collapse; }
  table.grid th, table.grid td { border: 1px solid #d1d5db; padding: 3px 6px; text-align: center; }
  table.grid th { background: #f3f4f6; font-weight: 600; }
  table.grid tr th:first-child { text-align: left; }
  table.small { font-size: 9pt; }
  .sel { background: #ede9fe !important; font-weight: 700; }
  .ruler { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; color: #6b7280; }
  .ruler i { display: inline-block; width: 50mm; height: 2.5mm; border: 1px solid #111827; border-top: 0; }
  .alert { border: 1px solid #dc2626; color: #991b1b; border-radius: 6px; padding: 5px 8px; margin-top: 6px; font-size: 9.5pt; }
  .hint { color: #6b7280; font-size: 8.5pt; margin: 3px 0 0; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 10px; }
  .sign div { border-top: 1px solid #9ca3af; padding-top: 3px; font-size: 9pt; color: #6b7280; height: 16mm; }
  @media print { .noprint { display: none; } }
  @media screen { body { padding: 8mm; background: #fff; } }
</style></head><body>
<header>
  <div>
    ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" alt="">` : ''}
    <div><b>${esc(company.name)}</b></div>
    <div class="muted">${esc([company.location, company.contactPhone, company.contactEmail].filter(Boolean).join(' · '))}</div>
  </div>
  <div style="text-align:right">
    <h1>${esc(L('title'))}</h1>
    <div><b>${esc(trace.number)}</b> — ${esc(date)}</div>
    <div class="muted">${esc(L('subtitle'))}</div>
  </div>
</header>

<div class="cols">
  <div class="box"><h3>${esc(L('supplier'))}</h3>
    ${kv(L('lab'), trace.supplier?.name ?? '—')}
    ${kv(L('contact'), trace.supplier?.whatsapp || trace.supplier?.phone || trace.supplier?.email || '—')}
  </div>
  <div class="box"><h3>${esc(L('client'))}</h3>
    ${kv(L('name'), customer)}
    ${kv(L('reference'), trace.label || '—')}
  </div>
  <div class="box"><h3>${esc(L('frame'))}</h3>
    ${kv(L('frameType'), L(`type_${trace.frameType}`))}
    ${kv(L('frameRef'), trace.frameRef || '—')}
    ${kv(L('source'), L(`source_${trace.source}`))}
  </div>
</div>

<h3>${esc(L('shapeTitle'))}</h3>
<div class="cols" style="grid-template-columns: repeat(6, 1fr)">
  ${kv('A', `${a.toFixed(1)} mm`)}${kv('B', `${b.toFixed(1)} mm`)}${kv(L('dbl'), `${trace.dbl.toFixed(1)} mm`)}
  ${kv('ED', `${ed.toFixed(1)} mm`)}${kv(L('framePd'), `${res.framePd.toFixed(1)} mm`)}${kv(L('circ'), `${circumference.toFixed(1)} mm`)}
</div>
<div class="shapes">
  ${eyeSvg(trace.radii, res.od, 'od', a, b)}
  ${eyeSvg(trace.radii, res.og, 'og', a, b)}
</div>
<div class="ruler"><i></i> ${esc(L('ruler'))}</div>
<p class="hint">${esc(L('legend'))}</p>

<h3>${esc(L('centeringTitle'))}</h3>
<table class="grid"><tr><th></th><th>OD</th><th>OG</th></tr>${eyeRows(p, res)}</table>

<h3>${esc(L('lensTitle'))}</h3>
<div class="cols" style="grid-template-columns: 1fr 1fr">
  <div class="box">
    ${kv(L('design'), L(`design_${p.design}`))}
    ${kv(L('index'), p.index ? p.index.toFixed(2) : '—')}
    ${kv(L('material'), p.material || '—')}
  </div>
  <div class="box">
    ${kv(L('treatments'), p.treatments || '—')}
    ${p.design === 'PROGRESSIVE' ? kv(L('minFitting'), `${(p.minFittingHeight ?? 16).toFixed(0)} mm`) : ''}
    ${kv(L('omaFile'), `${trace.number}.oma`)}
  </div>
</div>
${thicknessTable(res, p.index)}
${warnings.map((w) => `<div class="alert">⚠ ${esc(tr(`oculolab.warn.${w.code}`, { ...w.values, eye: w.eye ? w.eye.toUpperCase() : '' }))}</div>`).join('')}
${p.notes ? `<h3>${esc(L('notes'))}</h3><div class="box">${esc(p.notes).replace(/\n/g, '<br>')}</div>` : ''}

<div class="sign"><div>${esc(L('signShop'))}</div><div>${esc(L('signLab'))}</div></div>
<p class="noprint" style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:8px 18px;font-size:11pt">${esc(L('print'))}</button></p>
</body></html>`;
}

/** Ouvre la fiche dans un nouvel onglet, prête à imprimer ou à enregistrer en PDF. */
export function openPrecalSheet(trace: FrameTrace, company: CompanyInfo): void {
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert(tr('doc.allowPopupsRx'));
    return;
  }
  win.document.open();
  win.document.write(buildPrecalSheetHtml(trace, company));
  win.document.close();
  win.focus();
}

/** Télécharge le fichier de forme OMA (lu par les meuleuses et les laboratoires). */
export function downloadText(filename: string, content: string, type = 'application/octet-stream'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
