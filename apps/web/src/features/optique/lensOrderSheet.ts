import { LENS_ORDER_STATUS_LABELS, LENS_TREATMENTS, type LensOrderEyeRx } from '@oculo/shared-types';
import type { CustomerDetail, LensOrder, Prescription } from './api';
import type { Measurement } from './measurements';
import type { CompanyInfo } from './saleDocument';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';
import { displayLocale } from '../../lib/format';

/**
 * Fiche technique d'une commande de verres, destinée au laboratoire / à
 * l'atelier de montage : client, prescription, verres, monture, mesures de
 * centrage, contrôle qualité et signatures. Document autonome noir sur blanc
 * (indépendant du thème), imprimé ou enregistré en PDF depuis le navigateur.
 *
 * Les montants de vente n'y figurent volontairement pas : la fiche circule
 * à l'atelier et chez le laboratoire.
 */

const L = (k: string, o?: Record<string, unknown>) => tr(`labSheet.${k}`, o);

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function date(d: string | Date | null | undefined, withTime = false): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(displayLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(typeof d === 'string' ? new Date(d) : d);
}

function age(dob?: string | null): string {
  if (!dob) return '';
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return '';
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a >= 0 ? L('years', { n: a }) : '';
}

/** Dioptrie signée : +1.25 / -0.50 / 0.00. */
function dpt(n: number | string | null | undefined): string {
  if (n == null || n === '') return '';
  const v = Number(String(n).replace(',', '.'));
  if (Number.isNaN(v)) return esc(n);
  return (v > 0 ? '+' : '') + v.toFixed(2);
}
function deg(n: number | string | null | undefined): string {
  if (n == null || n === '') return '';
  return `${esc(n)}°`;
}
const val = (s: string) => s || '<span class="blank"></span>';

/** Prescription de l'œil : celle de la commande, sinon la dernière ordonnance du client. */
function eyeRx(order: LensOrder, rx: Prescription | null, eye: 'od' | 'og'): LensOrderEyeRx & { fromRx?: boolean } {
  const p = order.lensConfig?.prescription;
  const e = p ? (eye === 'og' && p.sameForBoth ? p.od : p[eye]) : null;
  if (e && Object.values(e).some((v) => v != null && v !== '')) return e;
  if (!rx) return {};
  const n = (v: string | null | undefined) => (v == null || v === '' ? undefined : Number(String(v).replace(',', '.')));
  return eye === 'od'
    ? { sphere: n(rx.odSphere), cylinder: n(rx.odCylinder), axis: n(rx.odAxis), addition: n(rx.odAddition), fromRx: true }
    : { sphere: n(rx.ogSphere), cylinder: n(rx.ogCylinder), axis: n(rx.ogAxis), addition: n(rx.ogAddition), fromRx: true };
}

export function buildLensOrderSheetHtml(
  order: LensOrder,
  company: CompanyInfo,
  customer: CustomerDetail | null,
  createdBy?: string | null,
  measure?: Measurement | null,
): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(company.accentColor ?? '') ? (company.accentColor as string) : '#0d9488';
  const rx = customer?.prescriptions?.[0] ?? null;
  // Dernière prise de mesures du client (page « Prise de mesures »), prioritaire
  // sur l'ordonnance pour le centrage : elle décrit le client avec sa monture.
  const ms = measure ?? null;
  const mmv = (n: number | null | undefined) => (n == null ? '' : `${String(n).replace('.', ',')}`);
  const cfg = order.lensConfig;
  const od = eyeRx(order, rx, 'od');
  const og = eyeRx(order, rx, 'og');
  const fromRx = od.fromRx || og.fromRx;
  const treatments = (cfg?.treatments ?? [])
    .map((k) => trFr(LENS_TREATMENTS.find((t) => t.key === k)?.label ?? k))
    .join(', ');
  const name = order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : L('walkIn');

  const logo = company.logoUrl
    ? `<img src="${esc(company.logoUrl)}" alt="" style="max-height:48px;max-width:170px;object-fit:contain;" />`
    : `<div style="font-size:20px;font-weight:800;color:${accent};">${esc(company.name)}</div>`;

  const row = (label: string, e: LensOrderEyeRx, lens: string | null, pd: string, h: string) => `
    <tr>
      <th>${label}</th>
      <td>${val(dpt(e.sphere))}</td>
      <td>${val(dpt(e.cylinder))}</td>
      <td>${val(deg(e.axis))}</td>
      <td>${val(dpt(e.addition))}</td>
      <td>${val(e.prism != null ? `${esc(e.prism)} ${esc(e.prismBase ?? '')}` : '')}</td>
      <td>${val(pd)}</td>
      <td>${val(h)}</td>
    </tr>
    ${lens ? `<tr class="lensline"><td colspan="8"><b>${L('lensRef')}</b> ${esc(lens)}</td></tr>` : ''}`;

  // Écart pupillaire monoculaire : jamais déduit du binoculaire / 2 (une erreur
  // de centrage coûte une paire) — la case reste à mesurer et remplir.
  const pdTotal = ms?.pdTotal != null ? mmv(ms.pdTotal) : rx?.pupillaryDistance ? esc(rx.pupillaryDistance) : '';

  const info = (label: string, value: string) =>
    `<div class="info"><span>${label}</span><b>${value || '—'}</b></div>`;

  const check = (label: string) => `<div class="check"><span class="box"></span>${label}</div>`;

  return `<!doctype html>
<html lang="${displayLocale().slice(0, 2)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(L('title'))} ${esc(order.number)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a; margin:0; padding:20px; background:#fff; font-size:12px; }
  .sheet { max-width:780px; margin:0 auto; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; border-bottom:3px solid ${accent}; padding-bottom:10px; }
  .num { text-align:right; }
  .num .t { font-size:11px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; color:${accent}; }
  .num .n { font-size:24px; font-weight:800; font-family:ui-monospace, Menlo, Consolas, monospace; letter-spacing:1px; }
  .num .s { font-size:11px; color:#475569; }
  h2 { margin:16px 0 6px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:${accent}; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px 14px; }
  .grid.two { grid-template-columns:repeat(2,1fr); }
  .info { border:1px solid #e2e8f0; border-radius:6px; padding:5px 8px; }
  .info span { display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.4px; color:#64748b; }
  .info b { font-size:12.5px; }
  table.rx { width:100%; border-collapse:collapse; }
  table.rx th, table.rx td { border:1px solid #94a3b8; padding:7px 6px; text-align:center; font-size:13px; }
  table.rx thead th { background:${accent}; color:#fff; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; border-color:${accent}; }
  table.rx tbody th { background:#f1f5f9; text-align:left; width:92px; }
  table.rx td { font-family:ui-monospace, Menlo, Consolas, monospace; font-weight:700; }
  table.rx tr.lensline td { text-align:left; font-family:inherit; font-weight:400; font-size:11.5px; background:#f8fafc; }
  .blank { display:inline-block; min-width:44px; border-bottom:1px dotted #94a3b8; height:14px; }
  .note { margin-top:4px; font-size:10.5px; color:#64748b; }
  .checks { display:grid; grid-template-columns:repeat(2,1fr); gap:6px 18px; }
  .check { display:flex; align-items:center; gap:8px; padding:4px 0; border-bottom:1px dotted #cbd5e1; }
  .box { width:13px; height:13px; border:1.5px solid #334155; border-radius:2px; flex-shrink:0; }
  .free { min-height:46px; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px; white-space:pre-wrap; }
  .sign { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:8px; }
  .sign div { border:1px solid #cbd5e1; border-radius:6px; height:64px; padding:5px 8px; font-size:10px; color:#64748b; }
  .foot { margin-top:14px; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; }
  .toolbar { position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; margin:-20px -20px 14px; padding:10px 20px; background:#f1f5f9; border-bottom:1px solid #e2e8f0; }
  .toolbar button { font:inherit; font-weight:600; padding:7px 14px; border-radius:8px; border:0; background:${accent}; color:#fff; cursor:pointer; }
  @media print { body { padding:0; } .no-print { display:none !important; } }
</style>
</head>
<body>
  <div class="toolbar no-print"><button onclick="window.print()">${esc(L('print'))}</button></div>
  <div class="sheet">
    <div class="head">
      <div>
        ${logo}
        ${company.location ? `<div style="margin-top:4px;color:#475569;">${esc(company.location)}</div>` : ''}
        <div style="color:#475569;">${[company.contactPhone, company.contactEmail].filter(Boolean).map(esc).join(' · ')}</div>
      </div>
      <div class="num">
        <div class="t">${esc(L('title'))}</div>
        <div class="n">${esc(order.number)}</div>
        <div class="s">${esc(L('orderedOn'))} ${date(order.createdAt)} · ${esc(trFr(LENS_ORDER_STATUS_LABELS[order.status]))}</div>
        ${order.expectedAt ? `<div class="s"><b>${esc(L('dueOn'))} ${date(order.expectedAt)}</b></div>` : ''}
      </div>
    </div>

    <h2>${esc(L('customer'))}</h2>
    <div class="grid">
      ${info(L('name'), esc(name))}
      ${info(L('phone'), esc(order.customer?.phone ?? customer?.phone ?? ''))}
      ${info(L('customerCode'), esc(customer?.code ?? ''))}
      ${info(L('birthDate'), customer?.dateOfBirth ? `${date(customer.dateOfBirth)} ${age(customer.dateOfBirth) ? `(${esc(age(customer.dateOfBirth))})` : ''}` : '')}
      ${info(L('profession'), esc(customer?.profession ?? ''))}
      ${info(L('prescriber'), esc(rx?.prescriberName ?? ''))}
    </div>

    <h2>${esc(L('prescription'))}</h2>
    <table class="rx">
      <thead>
        <tr>
          <th>${esc(L('eye'))}</th><th>${esc(L('sphere'))}</th><th>${esc(L('cylinder'))}</th><th>${esc(L('axis'))}</th>
          <th>${esc(L('addition'))}</th><th>${esc(L('prism'))}</th><th>${esc(L('monoPd'))}</th><th>${esc(L('height'))}</th>
        </tr>
      </thead>
      <tbody>
        ${row(L('od'), od, order.odLens, mmv(ms?.odMonoPd), ms?.odHeight != null ? mmv(ms.odHeight) : esc(rx?.odHeight ?? ''))}
        ${row(L('og'), og, order.ogLens, mmv(ms?.ogMonoPd), ms?.ogHeight != null ? mmv(ms.ogHeight) : esc(rx?.ogHeight ?? ''))}
      </tbody>
    </table>
    <div class="note">
      ${pdTotal ? `${esc(L('pdTotal'))} <b>${pdTotal} mm</b> · ` : ''}
      ${rx?.odNearPd || rx?.ogNearPd ? `${esc(L('nearPd'))} <b>${esc(rx?.odNearPd ?? '—')} / ${esc(rx?.ogNearPd ?? '—')}</b> · ` : ''}
      ${ms ? `${esc(L('measuredOn', { date: date(ms.takenAt) }))} · ` : ''}
      ${ms?.vertex != null ? `${esc(L('vertex'))} <b>${mmv(ms.vertex)} mm</b> · ` : ''}
      ${ms?.pantoTilt != null ? `${esc(L('panto'))} <b>${mmv(ms.pantoTilt)}°</b> · ` : ''}
      ${rx?.vertex && ms?.vertex == null ? `${esc(L('vertex'))} <b>${esc(rx.vertex)}</b> · ` : ''}
      ${rx?.pantoTilt && ms?.pantoTilt == null ? `${esc(L('panto'))} <b>${esc(rx.pantoTilt)}</b> · ` : ''}
      ${fromRx && rx ? esc(L('rxSource', { date: date(rx.date) })) : esc(L('rxFromOrder'))}
    </div>

    <h2>${esc(L('lenses'))}</h2>
    <div class="grid">
      ${info(L('lensType'), esc(cfg?.lensType ?? ''))}
      ${info(L('material'), esc(cfg?.material ?? ''))}
      ${info(L('index'), esc(cfg?.index ?? ''))}
      ${info(L('treatments'), esc(treatments))}
      ${info(L('lab'), esc(order.supplierName ?? ''))}
      ${info(L('category'), esc(order.category ?? ''))}
    </div>
    <div class="info" style="margin-top:6px;"><span>${esc(L('description'))}</span><b style="font-weight:600;">${esc(order.description)}</b></div>

    <h2>${esc(L('frame'))}</h2>
    <div class="grid">
      ${info(L('frameModel'), esc(order.frameProduct ? `${order.frameProduct.brand ? `${order.frameProduct.brand} · ` : ''}${order.frameProduct.name}` : ''))}
      ${info(
        L('frameSize'),
        ms?.lensWidth != null || ms?.bridge != null
          ? `${mmv(ms?.lensWidth) || '—'} □ ${mmv(ms?.bridge) || '—'}${ms?.lensHeight != null ? ` · B ${mmv(ms.lensHeight)}` : ''}`
          : '<span style="white-space:nowrap"><span class="blank" style="min-width:30px"></span> □ <span class="blank" style="min-width:30px"></span> — <span class="blank" style="min-width:30px"></span></span>',
      )}
      ${info(L('frameSupplied'), `□ ${esc(L('fromStock'))} &nbsp; □ ${esc(L('clientOwn'))}`)}
    </div>
    <div class="checks" style="margin-top:6px;">
      ${check(L('mountFull'))}
      ${check(L('mountNylon'))}
      ${check(L('mountRimless'))}
      ${check(L('mountOther'))}
    </div>

    <h2>${esc(L('instructions'))}</h2>
    <div class="free">${esc(order.notes ?? '')}</div>

    <h2>${esc(L('qc'))}</h2>
    <div class="checks">
      ${check(L('qcPower'))}
      ${check(L('qcAxis'))}
      ${check(L('qcCentering'))}
      ${check(L('qcTreatments'))}
      ${check(L('qcFit'))}
      ${check(L('qcClean'))}
    </div>

    <div class="sign">
      <div>${esc(L('signOrdered'))}${createdBy ? `<br/><b style="color:#0f172a;">${esc(createdBy)}</b>` : ''}</div>
      <div>${esc(L('signMounted'))}</div>
      <div>${esc(L('signChecked'))}</div>
    </div>

    <div class="foot">
      <span>${esc(company.name)} — ${esc(order.number)}</span>
      <span>${esc(L('printedOn'))} ${date(new Date(), true)}</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Ouvre la fiche dans une nouvelle fenêtre. La fenêtre est ouverte AVANT le
 * chargement des données (sinon le navigateur bloque la fenêtre surgissante),
 * puis remplie quand le dossier client est arrivé.
 */
export async function openLensOrderSheet(
  order: LensOrder,
  company: CompanyInfo,
  loadCustomer: () => Promise<CustomerDetail | null>,
  createdBy?: string | null,
  loadMeasure?: () => Promise<Measurement | null>,
): Promise<void> {
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert(tr('doc.allowPopupsRx'));
    return;
  }
  win.document.write(`<p style="font-family:sans-serif;padding:24px;color:#475569;">${esc(L('loading'))}</p>`);
  let customer: CustomerDetail | null = null;
  try {
    customer = await loadCustomer();
  } catch {
    // Dossier client inaccessible (droits, réseau) : la fiche reste utilisable
    // avec les informations de la commande, les cases manquantes sont à remplir.
    customer = null;
  }
  win.document.open();
  let measure: Measurement | null = null;
  try {
    measure = loadMeasure ? await loadMeasure() : null;
  } catch {
    measure = null; // droits ou réseau : la fiche garde des cases à remplir
  }
  win.document.write(buildLensOrderSheetHtml(order, company, customer, createdBy, measure));
  win.document.close();
  win.focus();
}
