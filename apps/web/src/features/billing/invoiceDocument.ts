import { SUB_INVOICE_STATUS_META, type SubInvoiceStatus } from '@oculo/shared-types';
import type { BillingSettings, Invoice } from './invoicing';

/**
 * Facture A4 imprimable (§7-12, §31).
 *
 * Document HTML autonome, styles INLINE et en noir sur blanc : indépendant du
 * thème de l'application, qui rendrait le texte invisible à l'impression en
 * mode sombre. Le navigateur fournit « Enregistrer au format PDF » depuis la
 * boîte d'impression ; le titre du document devient le nom du fichier
 * (« FACTURE-FAC-2026-000001 »), sans embarquer de bibliothèque PDF.
 *
 * Rien n'est inventé : un champ légal vide (adresse, numéro fiscal, téléphone)
 * n'est tout simplement pas imprimé, plutôt qu'affiché avec une valeur
 * plausible. Une facture est une pièce qu'un tiers peut opposer.
 */

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function frLong(d: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    typeof d === 'string' ? new Date(d) : d,
  );
}

function frShort(d: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    typeof d === 'string' ? new Date(d) : d,
  );
}

function money(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  return `${formatted} ${currency === 'XOF' ? 'FCFA' : currency}`;
}

const TONE_COLORS: Record<string, { bg: string; fg: string }> = {
  success: { bg: '#dcfce7', fg: '#166534' },
  warning: { bg: '#fef3c7', fg: '#92400e' },
  danger: { bg: '#fee2e2', fg: '#991b1b' },
  info: { bg: '#dbeafe', fg: '#1e40af' },
  neutral: { bg: '#e2e8f0', fg: '#334155' },
};

/** Ligne de coordonnées : les champs vides disparaissent au lieu de laisser un tiret. */
function contactLines(settings: BillingSettings): string[] {
  const location = [settings.address, [settings.city, settings.country].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' — ');
  return [
    location,
    [settings.phone ? `Tél : ${settings.phone}` : '', settings.email ? `Email : ${settings.email}` : '']
      .filter(Boolean)
      .join(' · '),
    settings.website || 'https://oculosaas.com',
    [
      settings.taxId ? `NIF : ${settings.taxId}` : '',
      settings.registrationNumber ? `RCCM : ${settings.registrationNumber}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  ].filter((line) => line.trim().length > 0);
}

export function buildInvoiceHtml(invoice: Invoice, settings: BillingSettings): string {
  const isCredit = invoice.kind === 'CREDIT_NOTE';
  const docLabel = isCredit ? 'AVOIR' : 'FACTURE';
  const meta = SUB_INVOICE_STATUS_META[invoice.status as SubInvoiceStatus] ?? {
    label: invoice.status,
    tone: 'neutral' as const,
  };
  // Le retard prime sur « En attente » : c'est l'information qui appelle une
  // action, et la masquer derrière un statut neutre coûte de l'argent.
  const statusLabel = invoice.overdue ? 'EN RETARD' : meta.label.toUpperCase();
  const tone = TONE_COLORS[invoice.overdue ? 'danger' : meta.tone] ?? TONE_COLORS.neutral;

  const editorName = settings.tradeName || settings.legalName || 'OculoSaaS';
  const logo = settings.logoUrl
    ? `<img src="${esc(settings.logoUrl)}" alt="" style="max-height:54px;max-width:190px;object-fit:contain;" />`
    : `<div style="font-size:26px;font-weight:800;color:#0d9488;letter-spacing:-0.5px;">OculoSaaS</div>`;

  // La colonne « Période » n'apparaît que si au moins une ligne en porte une.
  // Sinon elle n'affiche qu'une colonne de tirets, alors que la période
  // couverte figure déjà en clair dans l'en-tête.
  const showPeriodColumn = invoice.items.some((it) => (it.periodLabel ?? '').trim().length > 0);

  const itemRows = invoice.items
    .map(
      (it) => `
      <tr>
        <td style="padding:11px 12px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:600;color:#0f172a;">${esc(it.description)}</div>
        </td>
        ${
          showPeriodColumn
            ? `<td style="padding:11px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;">${esc(it.periodLabel ?? '')}</td>`
            : ''
        }
        <td style="padding:11px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#475569;">${esc(it.quantity)}</td>
        <td style="padding:11px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#475569;">${esc(money(it.unitPrice, invoice.currency))}</td>
        <td style="padding:11px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0f172a;">${esc(money(it.total, invoice.currency))}</td>
      </tr>`,
    )
    .join('');

  const totalRow = (label: string, value: string, strong = false, color = '#0f172a') => `
    <tr>
      <td style="padding:6px 0;color:#475569;font-size:${strong ? '14px' : '13px'};${strong ? 'font-weight:700;' : ''}">${esc(label)}</td>
      <td style="padding:6px 0 6px 28px;text-align:right;color:${color};font-size:${strong ? '16px' : '13px'};font-weight:${strong ? '800' : '600'};white-space:nowrap;">${esc(value)}</td>
    </tr>`;

  const successfulPayments = invoice.payments.filter((p) => p.status === 'SUCCESS');
  const paymentBlock =
    successfulPayments.length === 0
      ? ''
      : `
    <div style="margin-top:22px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Informations de paiement</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="color:#64748b;text-align:left;">
            <th style="padding:4px 0;font-weight:600;">Méthode</th>
            <th style="padding:4px 0;font-weight:600;">Référence</th>
            <th style="padding:4px 0;font-weight:600;">Date</th>
            <th style="padding:4px 0;font-weight:600;text-align:right;">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${successfulPayments
            .map(
              (p) => `
            <tr>
              <td style="padding:4px 0;color:#0f172a;">${esc(p.methodLabel)}</td>
              <td style="padding:4px 0;color:#475569;">${esc(p.reference ?? '—')}</td>
              <td style="padding:4px 0;color:#475569;">${esc(p.paidAt ? frShort(p.paidAt) : '—')}</td>
              <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(money(p.amount, p.currency))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;

  const refundBlock =
    invoice.refunds.length === 0
      ? ''
      : `
    <div style="margin-top:14px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:#9a3412;text-transform:uppercase;margin-bottom:8px;">Remboursements</div>
      ${invoice.refunds
        .map(
          (r) => `<div style="font-size:12px;color:#7c2d12;padding:3px 0;">
            ${esc(frShort(r.refundedAt))} — ${esc(money(r.amount, r.currency))} · ${esc(r.reason)}
          </div>`,
        )
        .join('')}
    </div>`;

  const clientLines = [
    invoice.billing.contact,
    invoice.billing.whatsapp,
    invoice.billing.email,
    invoice.billing.address,
    [invoice.billing.city, invoice.billing.country].filter(Boolean).join(', '),
  ].filter((l) => l && String(l).trim().length > 0);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(docLabel)}-${esc(invoice.number)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { margin: 0; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#ffffff;color:#0f172a;">
<div style="max-width:780px;margin:0 auto;padding:8px;">

  <!-- En-tête -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:18px;border-bottom:3px solid #0d9488;">
    <div>
      ${logo}
      <div style="margin-top:8px;font-size:15px;font-weight:700;color:#0f172a;">${esc(editorName)}</div>
      <div style="font-size:12px;color:#64748b;">Logiciel de gestion pour opticiens</div>
      ${contactLines(settings)
        .map((l) => `<div style="font-size:11px;color:#64748b;margin-top:2px;">${esc(l)}</div>`)
        .join('')}
    </div>
    <div style="text-align:right;">
      <div style="font-size:24px;font-weight:800;letter-spacing:1px;color:#0f172a;">${esc(docLabel)}</div>
      <div style="font-size:14px;font-weight:700;color:#0d9488;margin-top:2px;">${esc(invoice.number)}</div>
      <div style="margin-top:10px;font-size:11px;color:#64748b;">Date d’émission</div>
      <div style="font-size:12px;font-weight:600;">${esc(frLong(invoice.issueDate))}</div>
      <div style="margin-top:6px;font-size:11px;color:#64748b;">Date d’échéance</div>
      <div style="font-size:12px;font-weight:600;">${esc(frLong(invoice.dueDate))}</div>
      <div style="display:inline-block;margin-top:10px;padding:5px 12px;border-radius:999px;background:${tone.bg};color:${tone.fg};font-size:11px;font-weight:800;letter-spacing:0.6px;">
        ${esc(statusLabel)}
      </div>
    </div>
  </div>

  <!-- Client -->
  <div style="display:flex;gap:24px;margin-top:20px;">
    <div style="flex:1;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:#64748b;text-transform:uppercase;">Facturé à</div>
      <div style="margin-top:6px;font-size:15px;font-weight:700;color:#0f172a;">${esc(invoice.billing.name)}</div>
      ${clientLines.map((l) => `<div style="font-size:12px;color:#475569;margin-top:2px;">${esc(l)}</div>`).join('')}
    </div>
    <div style="flex:1;text-align:right;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:#64748b;text-transform:uppercase;">Période couverte</div>
      <div style="margin-top:6px;font-size:13px;font-weight:600;color:#0f172a;">
        ${esc(frShort(invoice.periodStart))} → ${esc(frShort(invoice.periodEnd))}
      </div>
      ${invoice.planName && invoice.planName !== '—' ? `<div style="font-size:12px;color:#475569;margin-top:2px;">Offre ${esc(invoice.planName)}</div>` : ''}
    </div>
  </div>

  <!-- Détail -->
  <table style="width:100%;border-collapse:collapse;margin-top:20px;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#475569;text-transform:uppercase;">Désignation</th>
        ${showPeriodColumn ? `<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#475569;text-transform:uppercase;">Période</th>` : ''}
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#475569;text-transform:uppercase;">Qté</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#475569;text-transform:uppercase;">Prix</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#475569;text-transform:uppercase;">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totaux -->
  <div style="display:flex;justify-content:flex-end;margin-top:16px;">
    <table style="border-collapse:collapse;min-width:290px;">
      ${totalRow('Sous-total', money(invoice.subtotal, invoice.currency))}
      ${invoice.discount > 0 ? totalRow('Remise', `- ${money(invoice.discount, invoice.currency)}`) : ''}
      ${invoice.tax > 0 ? totalRow('Taxes', money(invoice.tax, invoice.currency)) : ''}
      <tr><td colspan="2" style="padding:4px 0;"><div style="height:1px;background:#cbd5e1;"></div></td></tr>
      ${totalRow(isCredit ? 'TOTAL DE L’AVOIR' : 'TOTAL À PAYER', money(invoice.total, invoice.currency), true)}
      ${!isCredit ? totalRow('Montant payé', money(invoice.amountPaid, invoice.currency), false, '#166534') : ''}
      ${
        !isCredit
          ? totalRow(
              'Solde restant',
              money(invoice.balance, invoice.currency),
              true,
              invoice.balance > 0 ? '#991b1b' : '#166534',
            )
          : ''
      }
      ${invoice.amountRefunded > 0 ? totalRow('Dont remboursé', money(invoice.amountRefunded, invoice.currency), false, '#9a3412') : ''}
    </table>
  </div>

  ${paymentBlock}
  ${refundBlock}

  ${
    invoice.notes
      ? `<div style="margin-top:16px;font-size:12px;color:#475569;"><strong style="color:#0f172a;">Note :</strong> ${esc(invoice.notes)}</div>`
      : ''
  }
  ${
    settings.paymentTerms
      ? `<div style="margin-top:12px;font-size:11px;color:#64748b;"><strong>Conditions de paiement :</strong> ${esc(settings.paymentTerms)}</div>`
      : ''
  }
  ${
    settings.paymentDetails
      ? `<div style="margin-top:6px;font-size:11px;color:#64748b;white-space:pre-line;"><strong>Coordonnées de paiement :</strong>\n${esc(settings.paymentDetails)}</div>`
      : ''
  }

  <!-- Pied de page -->
  <div style="margin-top:26px;padding-top:14px;border-top:1px solid #e2e8f0;text-align:center;">
    <div style="font-size:12px;font-weight:600;color:#0f172a;">
      Merci d’utiliser OculoSaaS, votre logiciel de gestion pour opticiens.
    </div>
    <div style="font-size:11px;color:#0d9488;margin-top:3px;">${esc(settings.website || 'https://oculosaas.com')}</div>
    ${settings.footerNote ? `<div style="font-size:10px;color:#94a3b8;margin-top:6px;">${esc(settings.footerNote)}</div>` : ''}
    ${
      settings.legalName
        ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">${esc(settings.legalName)}${settings.registrationNumber ? ` · RCCM ${esc(settings.registrationNumber)}` : ''}${settings.taxId ? ` · NIF ${esc(settings.taxId)}` : ''}</div>`
        : ''
    }
  </div>

  <div class="no-print" style="margin-top:22px;text-align:center;">
    <button onclick="window.print()" style="padding:9px 18px;border-radius:9px;border:0;background:#0d9488;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
      Imprimer / Enregistrer en PDF
    </button>
  </div>
</div>
</body>
</html>`;
}

/**
 * Ouvre la facture dans une fenêtre dédiée et lance l'impression. Le bouton
 * « Enregistrer au format PDF » de la boîte d'impression produit le fichier ;
 * le nom proposé vient du titre du document.
 */
export function printInvoice(invoice: Invoice, settings: BillingSettings): boolean {
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Veuillez autoriser les fenêtres pop-up pour afficher la facture.');
    return false;
  }
  win.document.open();
  win.document.write(buildInvoiceHtml(invoice, settings));
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
  return true;
}
