import type { Prescription } from './api';
import type { CompanyInfo } from './saleDocument';

export interface PrescriptionPatient {
  firstName: string;
  lastName: string;
  phone?: string | null;
}

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

/**
 * Construit un document HTML autonome (ordonnance optique) prêt à imprimer.
 * Tous les styles sont inline en NOIR SUR BLANC : indépendant du thème de l'app
 * (le thème sombre rendait le texte invisible à l'impression via window.print).
 */
export function buildPrescriptionHtml(
  rx: Prescription,
  patient: PrescriptionPatient,
  company: CompanyInfo,
): string {
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

  const eyeRow = (
    label: string,
    sphere: string | null,
    cyl: string | null,
    axis: string | null,
    add: string | null,
  ) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;">${label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(sphere ?? '—')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(cyl ?? '—')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(axis ?? '—')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(add ?? '—')}</td>
    </tr>`;

  const extras = [
    rx.pupillaryDistance ? `Écart pupillaire : ${esc(rx.pupillaryDistance)} mm` : '',
    rx.lensType ? `Type de verres : ${esc(rx.lensType)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ordonnance ${esc(patient.lastName)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; margin:0; padding:24px; background:#fff; }
  @media print { body { padding:0; } }
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
        <div style="font-size:26px;font-weight:800;letter-spacing:1px;color:${accent};">ORDONNANCE</div>
        <div style="font-size:12px;color:#64748b;">Date : ${frDate(rx.date)}</div>
      </div>
    </div>

    <div style="margin-top:26px;padding:14px 16px;background:#f8fafc;border-radius:10px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">Patient</div>
      <div style="margin-top:2px;font-size:16px;font-weight:700;color:#0f172a;">${esc(patient.firstName)} ${esc(patient.lastName)}</div>
      ${patient.phone ? `<div style="font-size:12px;color:#64748b;">${esc(patient.phone)}</div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:14px;">
      <thead>
        <tr style="background:${accent};color:#fff;">
          <th style="padding:10px 12px;text-align:left;border-radius:8px 0 0 0;">Œil</th>
          <th style="padding:10px 12px;text-align:center;">Sphère</th>
          <th style="padding:10px 12px;text-align:center;">Cylindre</th>
          <th style="padding:10px 12px;text-align:center;">Axe</th>
          <th style="padding:10px 12px;text-align:center;border-radius:0 8px 0 0;">Addition</th>
        </tr>
      </thead>
      <tbody>
        ${eyeRow('OD (droit)', rx.odSphere, rx.odCylinder, rx.odAxis, rx.odAddition)}
        ${eyeRow('OG (gauche)', rx.ogSphere, rx.ogCylinder, rx.ogAxis, rx.ogAddition)}
      </tbody>
    </table>

    ${extras ? `<div style="margin-top:14px;font-size:13px;color:#334155;">${extras}</div>` : ''}
    ${rx.notes ? `<div style="margin-top:10px;font-size:13px;color:#334155;"><b>Notes :</b> ${esc(rx.notes)}</div>` : ''}

    <div style="margin-top:48px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:12px;color:#94a3b8;">${esc(company.name)}</div>
      <div style="text-align:center;">
        <div style="width:200px;border-top:1px solid #94a3b8;padding-top:6px;font-size:12px;color:#64748b;">
          ${rx.prescriberName ? esc(rx.prescriberName) : 'Cachet & signature'}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Ouvre l'ordonnance dans une nouvelle fenêtre et lance l'impression / PDF. */
export function printPrescription(
  rx: Prescription,
  patient: PrescriptionPatient,
  company: CompanyInfo,
): void {
  const html = buildPrescriptionHtml(rx, patient, company);
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Veuillez autoriser les fenêtres pop-up pour imprimer l\'ordonnance.');
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
