import type { Customer, Prescription, CustomerSale, CustomerLensOrder, CustomerRepair } from './api';
import type { CompanyInfo } from './saleDocument';
import { LENS_ORDER_STATUS_LABELS, ageFromBirthDate, type LensOrderStatus } from '@oculo/shared-types';

export type DossierCustomer = Customer & {
  prescriptions: Prescription[];
  sales: CustomerSale[];
  lensOrders: CustomerLensOrder[];
  repairs: CustomerRepair[];
};

const SALE_TYPE_LABEL: Record<string, string> = { SALE: 'Vente', QUOTE: 'Devis', RETURN: 'Retour' };

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function frDate(d: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    typeof d === 'string' ? new Date(d) : d,
  );
}

function money(v: string | number): string {
  return new Intl.NumberFormat('fr-FR').format(Number(v)) + ' FCFA';
}

function rxTable(rx: Prescription, accent: string): string {
  const eyeRow = (label: string, sphere: string | null, cyl: string | null, axis: string | null, add: string | null) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;">${label}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(sphere ?? '—')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(cyl ?? '—')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(axis ?? '—')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(add ?? '—')}</td>
    </tr>`;
  const extras = [
    rx.lensType ? `Type de verres : ${esc(rx.lensType)}` : '',
    rx.pupillaryDistance ? `Écart pupillaire : ${esc(rx.pupillaryDistance)} mm` : '',
    rx.prescriberName ? `Prescripteur : ${esc(rx.prescriberName)}` : '',
    rx.expiresAt ? `Valide jusqu'au ${frDate(rx.expiresAt)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `
    <div style="margin-top:10px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;">Ordonnance du ${frDate(rx.date)}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;">
        <thead>
          <tr style="background:${accent};color:#fff;">
            <th style="padding:6px 10px;text-align:left;">Œil</th>
            <th style="padding:6px 10px;text-align:center;">Sphère</th>
            <th style="padding:6px 10px;text-align:center;">Cylindre</th>
            <th style="padding:6px 10px;text-align:center;">Axe</th>
            <th style="padding:6px 10px;text-align:center;">Add.</th>
          </tr>
        </thead>
        <tbody>
          ${eyeRow('OD (droit)', rx.odSphere, rx.odCylinder, rx.odAxis, rx.odAddition)}
          ${eyeRow('OG (gauche)', rx.ogSphere, rx.ogCylinder, rx.ogAxis, rx.ogAddition)}
        </tbody>
      </table>
      ${extras ? `<div style="margin-top:8px;font-size:11px;color:#64748b;">${extras}</div>` : ''}
      ${rx.notes ? `<div style="margin-top:4px;font-size:11px;color:#334155;"><b>Notes :</b> ${esc(rx.notes)}</div>` : ''}
    </div>`;
}

function saleRow(s: CustomerSale): string {
  const items = s.items.map((it) => `${it.quantity}× ${esc(it.product.name)}`).join(', ');
  return `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(s.number)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${frDate(s.createdAt)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(SALE_TYPE_LABEL[s.type] ?? s.type)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${items || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${money(s.totalAmount)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(s.status)}</td>
    </tr>`;
}

function lensOrderRow(o: CustomerLensOrder): string {
  const lens = [o.odLens ? `OD ${o.odLens}` : '', o.ogLens ? `OG ${o.ogLens}` : ''].filter(Boolean).join(' · ') || esc(o.description);
  return `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(o.number)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${frDate(o.createdAt)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${lens}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(LENS_ORDER_STATUS_LABELS[o.status as LensOrderStatus] ?? o.status)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${o.cost != null ? money(o.cost) : '—'}</td>
    </tr>`;
}

function repairRow(r: CustomerRepair): string {
  return `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(r.number)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${frDate(r.createdAt)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${esc(r.description)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(r.status)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${r.cost != null ? money(r.cost) : '—'}</td>
    </tr>`;
}

function section(title: string, tableHead: string, rows: string): string {
  return `
    <div style="margin-top:22px;">
      <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:8px;">${esc(title)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f1f5f9;color:#475569;">${tableHead}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Construit le dossier client complet (identité, deux dernières ordonnances,
 * achats/devis avec articles, commandes de verres, réparations) en HTML
 * autonome noir sur blanc, prêt à imprimer / enregistrer en PDF.
 */
export function buildClientDossierHtml(customer: DossierCustomer, company: CompanyInfo): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(company.accentColor ?? '') ? (company.accentColor as string) : '#0d9488';
  const logo = company.logoUrl
    ? `<img src="${esc(company.logoUrl)}" alt="logo" style="max-height:56px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-size:22px;font-weight:800;color:${accent};">${esc(company.name)}</div>`;
  const contactLine = [
    company.contactPhone ? `Tél : ${esc(company.contactPhone)}` : '',
    company.contactEmail ? `Email : ${esc(company.contactEmail)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const age = ageFromBirthDate(customer.dateOfBirth);
  const identityBits = [
    age !== null ? `${age} ans` : null,
    customer.gender || null,
    customer.profession || null,
    customer.address || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const recentRx = customer.prescriptions.slice(0, 2);
  const olderRxCount = customer.prescriptions.length - recentRx.length;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dossier client ${esc(customer.lastName)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; margin:0; padding:24px; background:#fff; }
  @media print { body { padding:0; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div style="max-width:780px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div>
        ${logo}
        ${company.location ? `<div style="margin-top:6px;font-size:12px;color:#64748b;">${esc(company.location)}</div>` : ''}
        ${contactLine ? `<div style="font-size:12px;color:#64748b;">${contactLine}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:26px;font-weight:800;letter-spacing:1px;color:${accent};">DOSSIER CLIENT</div>
        <div style="font-size:12px;color:#64748b;">Généré le ${frDate(new Date())}</div>
      </div>
    </div>

    <div style="margin-top:26px;padding:14px 16px;background:#f8fafc;border-radius:10px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">Client</div>
      <div style="margin-top:2px;font-size:18px;font-weight:700;color:#0f172a;">${esc(customer.firstName)} ${esc(customer.lastName)}</div>
      <div style="margin-top:2px;font-size:12px;color:#64748b;">
        ${customer.phone ? esc(customer.phone) : ''}${customer.phone && customer.email ? ' · ' : ''}${customer.email ? esc(customer.email) : ''}
      </div>
      ${identityBits ? `<div style="font-size:12px;color:#64748b;">${esc(identityBits)}</div>` : ''}
      <div style="margin-top:4px;font-size:12px;color:${accent};font-weight:700;">${customer.loyaltyPoints ?? 0} points de fidélité</div>
      ${customer.notes ? `<div style="margin-top:6px;font-size:12px;color:#334155;"><b>Notes :</b> ${esc(customer.notes)}</div>` : ''}
    </div>

    <div style="margin-top:22px;font-size:14px;font-weight:800;color:#0f172a;">
      Ordonnances les plus récentes ${customer.prescriptions.length > 0 ? `(${customer.prescriptions.length} au total)` : ''}
    </div>
    ${
      recentRx.length > 0
        ? recentRx.map((rx) => rxTable(rx, accent)).join('')
        : '<div style="margin-top:8px;font-size:12px;color:#64748b;">Aucune ordonnance enregistrée.</div>'
    }
    ${olderRxCount > 0 ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8;">+ ${olderRxCount} ordonnance(s) plus ancienne(s) — voir la fiche client dans l'application.</div>` : ''}

    ${
      customer.sales.length > 0
        ? section(
            `Achats & devis (${customer.sales.length})`,
            '<th style="padding:6px 10px;text-align:left;">N°</th><th style="padding:6px 10px;text-align:left;">Date</th><th style="padding:6px 10px;text-align:left;">Type</th><th style="padding:6px 10px;text-align:left;">Articles</th><th style="padding:6px 10px;text-align:right;">Montant</th><th style="padding:6px 10px;text-align:left;">Statut</th>',
            customer.sales.map(saleRow).join(''),
          )
        : ''
    }

    ${
      customer.lensOrders.length > 0
        ? section(
            `Commandes de verres (${customer.lensOrders.length})`,
            '<th style="padding:6px 10px;text-align:left;">N°</th><th style="padding:6px 10px;text-align:left;">Date</th><th style="padding:6px 10px;text-align:left;">Verres</th><th style="padding:6px 10px;text-align:left;">Statut</th><th style="padding:6px 10px;text-align:right;">Coût</th>',
            customer.lensOrders.map(lensOrderRow).join(''),
          )
        : ''
    }

    ${
      customer.repairs.length > 0
        ? section(
            `SAV & réparations (${customer.repairs.length})`,
            '<th style="padding:6px 10px;text-align:left;">N°</th><th style="padding:6px 10px;text-align:left;">Date</th><th style="padding:6px 10px;text-align:left;">Description</th><th style="padding:6px 10px;text-align:left;">Statut</th><th style="padding:6px 10px;text-align:right;">Coût</th>',
            customer.repairs.map(repairRow).join(''),
          )
        : ''
    }

    <div style="margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;">
      ${esc(company.name)} — Dossier généré depuis OculoSaaS
    </div>
  </div>
</body>
</html>`;
}

/** Ouvre le dossier client dans une nouvelle fenêtre et lance l'impression / l'enregistrement en PDF. */
export function printClientDossier(customer: DossierCustomer, company: CompanyInfo): void {
  const html = buildClientDossierHtml(customer, company);
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert("Veuillez autoriser les fenêtres pop-up pour générer le dossier client.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* déjà imprimé */
    }
  }, 600);
}
