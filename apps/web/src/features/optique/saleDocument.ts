import { CURRENCY_FORMAT, type SupportedCurrency } from '@oculo/shared-types';
import type { SaleDetail } from './api';
import { tr } from '../../lib/tr';
import { displayLocale } from '../../lib/format';
import { saleStatusLabel } from '../../lib/labels';

export interface CompanyInfo {
  name: string;
  logoUrl?: string | null;
  /** Couleur d'accent personnalisée (#RRGGBB). Défaut : teal/violet. */
  accentColor?: string | null;
  /** Mentions légales (RCCM, NINEA/IFU…) affichées sous l'en-tête. */
  legalInfo?: string | null;
  /** Note libre en bas de document (remerciement, conditions…). */
  footerNote?: string | null;
  /** Validité d'un devis en jours (défaut 30). */
  quoteValidityDays?: number | null;
  /** Situation géographique de l'établissement (adresse ou lien de carte). */
  location?: string | null;
  /** Contact de l'entreprise, affiché sous l'en-tête. */
  contactPhone?: string | null;
  contactEmail?: string | null;
  /** Format de papier par défaut (A4 si absent). */
  paperSize?: 'A4' | 'A5' | null;
}

/**
 * Mise en page d'impression commune aux factures, devis et reçus.
 *
 * Le document est dessiné pour ~780 px de large, puis mis à l'échelle (zoom)
 * pour occuper EXACTEMENT la largeur imprimable du format choisi : il remplit
 * la feuille, centré, quel que soit le papier (A4 ou A5). Sa hauteur minimale
 * couvre la page, ce qui envoie le pied de document en bas de feuille.
 * La fenêtre affiche un aperçu de la feuille et une barre A4 / A5 / Imprimer.
 */
const PAPER = {
  A4: { w: 210, h: 297, margin: 12, zoom: 0.92 },
  A5: { w: 148, h: 210, margin: 9, zoom: 0.62 },
} as const;

export function paperStyles(): string {
  const page = (k: keyof typeof PAPER) => {
    const p = PAPER[k];
    const innerW = p.w - 2 * p.margin;
    // Légère marge de sécurité en hauteur : évite une page blanche due aux arrondis.
    const innerH = p.h - 2 * p.margin - 3;
    return `
  body.paper-${k} .sheet { width:${p.w}mm; min-height:${p.h}mm; padding:${p.margin}mm; }
  body.paper-${k} .doc { zoom:${p.zoom}; width:calc(${innerW}mm / ${p.zoom}); min-height:calc(${innerH}mm / ${p.zoom}); }`;
  };
  return `
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; background:#e5e7eb; }
  .toolbar { position:sticky; top:0; z-index:10; display:flex; gap:8px; justify-content:center; align-items:center; padding:10px; background:#0f172a; color:#fff; font-size:13px; }
  .toolbar button { border:0; border-radius:8px; padding:7px 14px; font-weight:600; cursor:pointer; background:#334155; color:#fff; }
  .toolbar button.on { background:#7c3aed; }
  .toolbar .print { background:#16a34a; }
  .sheet { margin:20px auto; background:#fff; box-shadow:0 10px 30px rgba(15,23,42,.18); }
  .doc { display:flex; flex-direction:column; }
  ${page('A4')}
  ${page('A5')}
  @media print {
    body { background:#fff; }
    .toolbar, .no-print { display:none !important; }
    .sheet { margin:0 !important; padding:0 !important; box-shadow:none !important; width:auto !important; min-height:0 !important; }
    tr, .avoid-break { page-break-inside:avoid; }
  }`;
}

/** Barre de format + script de bascule A4 / A5 (règle @page dynamique). */
export function paperToolbar(initial: 'A4' | 'A5'): string {
  const margins = { A4: PAPER.A4.margin, A5: PAPER.A5.margin };
  return `<div class="toolbar no-print">
    <span>${tr('doc.paperFormat')}</span>
    <button type="button" data-size="A4">A4</button>
    <button type="button" data-size="A5">A5</button>
    <button type="button" class="print" onclick="window.print()">${tr('doc.printBtn')}</button>
  </div>
  <style id="page-rule"></style>
  <script>
    (function () {
      var margins = ${JSON.stringify(margins)};
      function setSize(s) {
        document.body.className = 'paper-' + s;
        document.getElementById('page-rule').textContent = '@page { size: ' + s + ' portrait; margin: ' + margins[s] + 'mm; }';
        document.querySelectorAll('.toolbar [data-size]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-size') === s); });
      }
      document.querySelectorAll('.toolbar [data-size]').forEach(function (b) { b.onclick = function () { setSize(b.getAttribute('data-size')); }; });
      setSize(${JSON.stringify(initial)});
    })();
  </script>`;
}

// La devise vient de la vente elle-meme (figee a l'encaissement) : une
// facture reimprimee garde sa devise d'origine.
function money(amount: number | string, currency = 'XOF'): string {
  const fmt = CURRENCY_FORMAT[currency as SupportedCurrency];
  const n = new Intl.NumberFormat(displayLocale(), {
    maximumFractionDigits: fmt?.decimals ?? 0,
  }).format(Number.isFinite(Number(amount)) ? Number(amount) : 0);
  return `${n} ${fmt?.symbol ?? currency}`;
}

function frDate(d: string | Date): string {
  return new Intl.DateTimeFormat(displayLocale(), { day: '2-digit', month: 'long', year: 'numeric' }).format(
    typeof d === 'string' ? new Date(d) : d,
  );
}

/** Échappe le HTML pour éviter toute injection depuis les données client. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Construit le document HTML autonome (devis ou facture) prêt à imprimer /
 * exporter en PDF via la boîte d'impression du navigateur. Tous les styles
 * sont inline pour être indépendants de l'app et fidèles à l'impression.
 */
export function buildSaleDocumentHtml(sale: SaleDetail, company: CompanyInfo): string {
  const isQuote = sale.type === 'QUOTE';
  const docTitle = isQuote ? tr('doc.quote') : tr('doc.invoice');
  const validColor = /^#[0-9a-fA-F]{6}$/.test(company.accentColor ?? '');
  const accent = validColor ? (company.accentColor as string) : isQuote ? '#7c3aed' : '#0d9488';
  const currency = sale.currency || 'XOF';

  const customerName = sale.customer
    ? `${sale.customer.firstName} ${sale.customer.lastName}`
    : tr('doc.walkIn');

  const balance = Number(sale.totalAmount) - Number(sale.paidAmount);

  const rows = sale.items
    .map(
      (it, i) => `
      <tr style="${i % 2 ? 'background:#f8fafc;' : ''}">
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:600;color:#0f172a;">${esc(it.product.name)}</div>
          <div style="font-size:11px;color:#94a3b8;">${esc(it.product.sku)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${money(it.unitPrice, currency)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${money(it.lineTotal, currency)}</td>
      </tr>`,
    )
    .join('');

  const totalRow = (label: string, value: string, opts: { strong?: boolean; color?: string } = {}) => `
    <tr>
      <td style="padding:6px 12px;text-align:right;color:#64748b;">${label}</td>
      <td style="padding:6px 12px;text-align:right;${opts.strong ? 'font-weight:700;font-size:16px;' : ''}${
        opts.color ? `color:${opts.color};` : 'color:#0f172a;'
      }">${value}</td>
    </tr>`;

  const logo = company.logoUrl
    ? `<img src="${esc(company.logoUrl)}" alt="logo" style="max-height:56px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-size:22px;font-weight:800;color:${accent};">${esc(company.name)}</div>`;

  const branchLines = [sale.branch.address, sale.branch.city, sale.branch.phone]
    .filter(Boolean)
    .map((l) => esc(l))
    .join(' · ');

  const contactLine = [
    company.contactPhone ? tr('doc.phone', { value: esc(company.contactPhone) }) : '',
    company.contactEmail ? tr('doc.email', { value: esc(company.contactEmail) }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const validityDays =
    company.quoteValidityDays && company.quoteValidityDays > 0 ? company.quoteValidityDays : 30;
  // Ordonnance jointe (facultative) : correction reprise sur le document pour
  // que le client ait le devis et sa correction sur la même page.
  const rx = sale.prescription;
  const rxCell = (v: string | null | undefined) =>
    `<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e2e8f0;">${
      v ? esc(v) : '—'
    }</td>`;
  const rxRow = (
    label: string,
    sph: string | null | undefined,
    cyl: string | null | undefined,
    axis: string | null | undefined,
    add: string | null | undefined,
  ) =>
    `<tr>
      <td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #e2e8f0;">${label}</td>
      ${rxCell(sph)}${rxCell(cyl)}${rxCell(axis)}${rxCell(add)}
    </tr>`;
  const rxExtras = rx
    ? [
        rx.pupillaryDistance ? tr('doc.pd', { value: esc(rx.pupillaryDistance) }) : '',
        rx.lensType ? tr('doc.lensType', { value: esc(rx.lensType) }) : '',
        rx.prescriberName ? tr('doc.prescriber', { value: esc(rx.prescriberName) }) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const prescriptionBlock = rx
    ? `<div class="avoid-break" style="margin-top:26px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">
          ${tr('doc.attachedRx', { date: frDate(rx.date) })}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;color:#334155;">
              <th style="padding:8px 12px;text-align:left;">${tr('doc.eye')}</th>
              <th style="padding:8px 12px;text-align:center;">${tr('doc.sphere')}</th>
              <th style="padding:8px 12px;text-align:center;">${tr('doc.cylinder')}</th>
              <th style="padding:8px 12px;text-align:center;">${tr('doc.axis')}</th>
              <th style="padding:8px 12px;text-align:center;">${tr('doc.addition')}</th>
            </tr>
          </thead>
          <tbody>
            ${rxRow(tr('doc.odRight'), rx.odSphere, rx.odCylinder, rx.odAxis, rx.odAddition)}
            ${rxRow(tr('doc.ogLeft'), rx.ogSphere, rx.ogCylinder, rx.ogAxis, rx.ogAddition)}
          </tbody>
        </table>
        ${rxExtras ? `<div style="margin-top:6px;font-size:12px;color:#475569;">${rxExtras}</div>` : ''}
      </div>`
    : '';

  const paymentBlock = isQuote
    ? `<p style="margin:16px 0 0;font-size:12px;color:#64748b;">${tr('doc.quoteValidity', { days: validityDays })}</p>`
    : `<div style="display:flex;justify-content:flex-end;"><table style="width:320px;border-collapse:collapse;font-size:13px;">
        ${totalRow(tr('doc.paid'), money(sale.paidAmount, currency), { color: '#0d9488' })}
        ${balance > 0 ? totalRow(tr('doc.balanceDue'), money(balance, currency), { strong: true, color: '#dc2626' }) : ''}
      </table></div>`;

  return `<!doctype html>
<html lang="${displayLocale().slice(0, 2)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${docTitle} ${esc(sale.number)}</title>
<style>${paperStyles()}</style>
</head>
<body class="paper-${company.paperSize === 'A5' ? 'A5' : 'A4'}">
  ${paperToolbar(company.paperSize === 'A5' ? 'A5' : 'A4')}
  <div class="sheet"><div class="doc">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div>
        ${logo}
        <div style="margin-top:8px;font-size:13px;font-weight:600;color:#334155;">${esc(sale.branch.name)}</div>
        ${branchLines ? `<div style="font-size:12px;color:#64748b;">${branchLines}</div>` : ''}
        ${company.location ? `<div style="font-size:12px;color:#64748b;">${esc(company.location)}</div>` : ''}
        ${contactLine ? `<div style="font-size:12px;color:#64748b;">${contactLine}</div>` : ''}
        ${
          company.legalInfo
            ? `<div style="margin-top:4px;font-size:11px;color:#94a3b8;white-space:pre-line;">${esc(company.legalInfo)}</div>`
            : ''
        }
      </div>
      <div style="text-align:right;">
        <div style="font-size:28px;font-weight:800;letter-spacing:1px;color:${accent};">${docTitle}</div>
        <div style="margin-top:4px;font-size:13px;color:#0f172a;font-weight:600;">${tr('doc.number', { value: esc(sale.number) })}</div>
        <div style="font-size:12px;color:#64748b;">${tr('doc.date', { value: frDate(sale.createdAt) })}</div>
        <div style="font-size:12px;color:#64748b;">${tr('doc.status', { value: esc(saleStatusLabel(sale.status)) })}</div>
      </div>
    </div>

    <div style="margin-top:28px;padding:14px 16px;background:#f8fafc;border-radius:10px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">${isQuote ? tr('doc.quoteFor') : tr('doc.billedTo')}</div>
      <div style="margin-top:2px;font-size:15px;font-weight:700;color:#0f172a;">${esc(customerName)}</div>
      ${sale.customer?.phone ? `<div style="font-size:12px;color:#64748b;">${esc(sale.customer.phone)}</div>` : ''}
      ${sale.customer?.email ? `<div style="font-size:12px;color:#64748b;">${esc(sale.customer.email)}</div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:13px;">
      <thead>
        <tr style="background:${accent};color:#fff;">
          <th style="padding:10px 12px;text-align:left;border-radius:8px 0 0 0;">${tr('doc.description')}</th>
          <th style="padding:10px 12px;text-align:center;">${tr('doc.qty')}</th>
          <th style="padding:10px 12px;text-align:right;">${tr('doc.unitPrice')}</th>
          <th style="padding:10px 12px;text-align:right;border-radius:0 8px 0 0;">${tr('doc.total')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:18px;">
      <table style="width:320px;border-collapse:collapse;font-size:13px;">
        ${totalRow(tr('doc.subtotal'), money(sale.subtotal, currency))}
        ${Number(sale.discountAmount) > 0 ? totalRow(tr('doc.discount'), `- ${money(sale.discountAmount, currency)}`) : ''}
        ${totalRow(tr('doc.vat'), money(sale.taxAmount, currency))}
        ${Number(sale.insuranceAmount) > 0 ? totalRow(tr('doc.insurance'), `- ${money(sale.insuranceAmount, currency)}`) : ''}
        <tr><td colspan="2" style="padding:4px 0;"><div style="border-top:2px solid ${accent};"></div></td></tr>
        ${totalRow(tr('doc.grandTotal'), money(sale.totalAmount, currency), { strong: true })}
      </table>
    </div>

    ${paymentBlock}

    ${prescriptionBlock}

    ${
      company.footerNote
        ? `<div style="margin-top:24px;padding:12px 16px;background:#f8fafc;border-left:3px solid ${accent};border-radius:0 8px 8px 0;font-size:12px;color:#475569;white-space:pre-line;">${esc(company.footerNote)}</div>`
        : ''
    }

    <div style="flex:1 0 40px;"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;">
      <span>${esc(company.name)}</span>
      <span>${sale.cashier ? tr('doc.issuedBy', { name: `${esc(sale.cashier.firstName)} ${esc(sale.cashier.lastName)}` }) : ''}</span>
    </div>
  </div></div>
</body>
</html>`;
}

/**
 * Ouvre le document dans une nouvelle fenêtre et déclenche l'impression
 * (« Enregistrer en PDF » dans la boîte d'impression du navigateur).
 */
export function printSaleDocument(sale: SaleDetail, company: CompanyInfo): void {
  const html = buildSaleDocumentHtml(sale, company);
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert(tr('doc.allowPopups'));
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Laisse le logo/les polices se charger avant d'ouvrir la boîte d'impression.
  win.onload = () => {
    win.focus();
    win.print();
  };
  // Filet de sécurité si onload ne se déclenche pas (document déjà chargé).
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* déjà imprimé */
    }
  }, 600);
}
