import type { SaleDetail } from './api';

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
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

function money(amount: number | string, currency = 'XOF'): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(
    Number.isFinite(Number(amount)) ? Number(amount) : 0,
  );
  const suffix = currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
  return `${n} ${suffix}`;
}

function frDate(d: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
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
  const docTitle = isQuote ? 'DEVIS' : 'FACTURE';
  const validColor = /^#[0-9a-fA-F]{6}$/.test(company.accentColor ?? '');
  const accent = validColor ? (company.accentColor as string) : isQuote ? '#7c3aed' : '#0d9488';
  const currency = sale.currency || 'XOF';

  const customerName = sale.customer
    ? `${sale.customer.firstName} ${sale.customer.lastName}`
    : 'Client comptant';

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

  const validityDays =
    company.quoteValidityDays && company.quoteValidityDays > 0 ? company.quoteValidityDays : 30;
  const paymentBlock = isQuote
    ? `<p style="margin:16px 0 0;font-size:12px;color:#64748b;">Ce devis est valable ${validityDays} jours à compter de sa date d'émission. Sous réserve de disponibilité des articles en stock.</p>`
    : `<table style="width:100%;border-collapse:collapse;">
        ${totalRow('Payé', money(sale.paidAmount, currency), { color: '#0d9488' })}
        ${balance > 0 ? totalRow('Reste à payer', money(balance, currency), { strong: true, color: '#dc2626' }) : ''}
      </table>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${docTitle} ${esc(sale.number)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; margin:0; padding:24px; }
  @media print { body { padding:0; } .no-print { display:none !important; } }
</style>
</head>
<body>
  <div style="max-width:780px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div>
        ${logo}
        <div style="margin-top:8px;font-size:13px;font-weight:600;color:#334155;">${esc(sale.branch.name)}</div>
        ${branchLines ? `<div style="font-size:12px;color:#64748b;">${branchLines}</div>` : ''}
        ${
          company.legalInfo
            ? `<div style="margin-top:4px;font-size:11px;color:#94a3b8;white-space:pre-line;">${esc(company.legalInfo)}</div>`
            : ''
        }
      </div>
      <div style="text-align:right;">
        <div style="font-size:28px;font-weight:800;letter-spacing:1px;color:${accent};">${docTitle}</div>
        <div style="margin-top:4px;font-size:13px;color:#0f172a;font-weight:600;">N° ${esc(sale.number)}</div>
        <div style="font-size:12px;color:#64748b;">Date : ${frDate(sale.createdAt)}</div>
        <div style="font-size:12px;color:#64748b;">Statut : ${esc(STATUS_LABEL[sale.status] ?? sale.status)}</div>
      </div>
    </div>

    <div style="margin-top:28px;padding:14px 16px;background:#f8fafc;border-radius:10px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">${isQuote ? 'Devis pour' : 'Facturé à'}</div>
      <div style="margin-top:2px;font-size:15px;font-weight:700;color:#0f172a;">${esc(customerName)}</div>
      ${sale.customer?.phone ? `<div style="font-size:12px;color:#64748b;">${esc(sale.customer.phone)}</div>` : ''}
      ${sale.customer?.email ? `<div style="font-size:12px;color:#64748b;">${esc(sale.customer.email)}</div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:13px;">
      <thead>
        <tr style="background:${accent};color:#fff;">
          <th style="padding:10px 12px;text-align:left;border-radius:8px 0 0 0;">Désignation</th>
          <th style="padding:10px 12px;text-align:center;">Qté</th>
          <th style="padding:10px 12px;text-align:right;">P.U.</th>
          <th style="padding:10px 12px;text-align:right;border-radius:0 8px 0 0;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:18px;">
      <table style="width:320px;border-collapse:collapse;font-size:13px;">
        ${totalRow('Sous-total', money(sale.subtotal, currency))}
        ${Number(sale.discountAmount) > 0 ? totalRow('Remise', `- ${money(sale.discountAmount, currency)}`) : ''}
        ${totalRow('TVA', money(sale.taxAmount, currency))}
        ${Number(sale.insuranceAmount) > 0 ? totalRow('Prise en charge', `- ${money(sale.insuranceAmount, currency)}`) : ''}
        <tr><td colspan="2" style="padding:4px 0;"><div style="border-top:2px solid ${accent};"></div></td></tr>
        ${totalRow('TOTAL', money(sale.totalAmount, currency), { strong: true })}
      </table>
    </div>

    ${paymentBlock}

    ${
      company.footerNote
        ? `<div style="margin-top:24px;padding:12px 16px;background:#f8fafc;border-left:3px solid ${accent};border-radius:0 8px 8px 0;font-size:12px;color:#475569;white-space:pre-line;">${esc(company.footerNote)}</div>`
        : ''
    }

    <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;">
      <span>${esc(company.name)}</span>
      <span>${sale.cashier ? `Établi par ${esc(sale.cashier.firstName)} ${esc(sale.cashier.lastName)}` : ''}</span>
    </div>
  </div>
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
    alert("Veuillez autoriser les fenêtres pop-up pour télécharger le document.");
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
