import type { Consultation, Patient } from './api';
import type { CompanyInfo } from '../optique/saleDocument';
import { tr } from '../../lib/tr';
import { displayLocale } from '../../lib/format';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function frDate(d: string | Date): string {
  return new Intl.DateTimeFormat(displayLocale(), { day: '2-digit', month: 'long', year: 'numeric' }).format(
    typeof d === 'string' ? new Date(d) : d,
  );
}

/**
 * Ordonnance MÉDICALE (clinique d'ophtalmologie), autonome et noir sur blanc
 * (indépendant du thème sombre de l'app). Reprend les mesures de la consultation
 * et la prescription de l'opticien optométriste.
 */
export function buildMedicalPrescriptionHtml(
  c: Consultation,
  patient: Pick<Patient, 'firstName' | 'lastName' | 'dateOfBirth' | 'phone'>,
  company: CompanyInfo,
): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(company.accentColor ?? '') ? (company.accentColor as string) : '#0d9488';

  const logo = company.logoUrl
    ? `<img src="${esc(company.logoUrl)}" alt="logo" style="max-height:56px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-size:22px;font-weight:800;color:${accent};">${esc(company.name)}</div>`;

  const contactLine = [
    company.contactPhone ? tr('doc.phone', { value: esc(company.contactPhone) }) : '',
    company.contactEmail ? tr('doc.email', { value: esc(company.contactEmail) }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const measure = (label: string, od: string | null, og: string | null) =>
    od || og
      ? `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${label}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(od ?? '—')}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${esc(og ?? '—')}</td>
        </tr>`
      : '';

  const measuresRows =
    measure(tr('doc.visualAcuity'), c.visualAcuityRight, c.visualAcuityLeft) +
    measure(tr('doc.refraction'), c.refractionRight, c.refractionLeft) +
    measure(tr('doc.iop'), c.tonometryRight, c.tonometryLeft);

  return `<!doctype html>
<html lang="${displayLocale().slice(0, 2)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${tr('doc.prescriptionTitle', { name: esc(patient.lastName) })}</title>
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
        <div style="font-size:26px;font-weight:800;letter-spacing:1px;color:${accent};">${tr('doc.prescription')}</div>
        <div style="font-size:12px;color:#64748b;">${tr('doc.date', { value: frDate(c.date) })}</div>
      </div>
    </div>

    <div style="margin-top:26px;padding:14px 16px;background:#f8fafc;border-radius:10px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">${tr('doc.patient')}</div>
      <div style="margin-top:2px;font-size:16px;font-weight:700;color:#0f172a;">${esc(patient.firstName)} ${esc(patient.lastName)}</div>
      ${patient.dateOfBirth ? `<div style="font-size:12px;color:#64748b;">${tr('doc.bornOn', { date: frDate(patient.dateOfBirth) })}</div>` : ''}
      ${patient.phone ? `<div style="font-size:12px;color:#64748b;">${esc(patient.phone)}</div>` : ''}
    </div>

    ${
      measuresRows
        ? `<table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:13px;">
            <thead>
              <tr style="background:${accent};color:#fff;">
                <th style="padding:8px 12px;text-align:left;border-radius:8px 0 0 0;">${tr('doc.exam')}</th>
                <th style="padding:8px 12px;text-align:center;">${tr('doc.rightEyeOd')}</th>
                <th style="padding:8px 12px;text-align:center;border-radius:0 8px 0 0;">${tr('doc.leftEyeOg')}</th>
              </tr>
            </thead>
            <tbody>${measuresRows}</tbody>
          </table>`
        : ''
    }

    ${c.diagnosis ? `<div style="margin-top:18px;font-size:14px;color:#0f172a;"><b>${tr('doc.diagnosis')}</b> ${esc(c.diagnosis)}</div>` : ''}

    <div style="margin-top:18px;">
      <div style="font-size:13px;font-weight:700;color:${accent};">${tr('doc.rx')}</div>
      <div style="margin-top:6px;min-height:80px;white-space:pre-line;font-size:14px;color:#1e293b;">${esc(c.prescription ?? '')}</div>
    </div>

    <div style="margin-top:48px;display:flex;justify-content:flex-end;">
      <div style="text-align:center;">
        ${c.practitionerName ? `<div style="margin-bottom:34px;font-size:13px;font-weight:600;color:#0f172a;">${esc(c.practitionerName)}<div style="font-size:11px;font-weight:400;color:#64748b;">${tr('doc.optometrist')}</div></div>` : ''}
        <div style="width:240px;border-top:1px solid #94a3b8;padding-top:6px;font-size:12px;color:#64748b;">
          ${tr('doc.doctorStamp')}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Ouvre l'ordonnance dans une nouvelle fenêtre et lance l'impression / PDF. */
export function printMedicalPrescription(
  c: Consultation,
  patient: Pick<Patient, 'firstName' | 'lastName' | 'dateOfBirth' | 'phone'>,
  company: CompanyInfo,
): void {
  const html = buildMedicalPrescriptionHtml(c, patient, company);
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert(tr('doc.allowPopupsRx'));
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
