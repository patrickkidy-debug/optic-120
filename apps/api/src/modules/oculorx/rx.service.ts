import type { FastifyRequest } from 'fastify';
import {
  RX_DEFAULTS,
  RX_FRAME_LABELS,
  RX_GEOMETRY_LABELS,
  RX_OPEN_STATUSES,
  rxCoefficientFor,
  rxDiopter,
  rxSuggestedPrice,
  type RxCoefficientSettings,
  type RxFrameType,
  type RxGeometry,
} from '@oculo/shared-types';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { isUnrestricted } from '../../middlewares/rbac-guard.js';
import { mailer } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';

export interface RxSettingsView extends RxCoefficientSettings {
  vatRate: number;
  mountedFee: number;
  urgentFee: number;
  /** Montage ajouté au prix de vente de chaque paire. */
  shopMountingFee: number;
}

/** Réglages du magasin (valeurs par défaut tant que rien n'est enregistré). */
export async function getRxSettings(db: TenantPrisma): Promise<RxSettingsView> {
  const s = await db.rxSettings.findFirst({});
  return {
    coefficient: s?.coefficient ?? RX_DEFAULTS.coefficient,
    geometryCoefficients: (s?.geometryCoefficients as RxCoefficientSettings['geometryCoefficients']) ?? {},
    vatRate: s?.vatRate ?? RX_DEFAULTS.vatRate,
    mountedFee: s?.mountedFee ?? RX_DEFAULTS.mountedFee,
    urgentFee: s?.urgentFee ?? RX_DEFAULTS.urgentFee,
    shopMountingFee: s?.shopMountingFee ?? 0,
  };
}

/** Prix d'achat et marges : réservés aux administrateurs de l'établissement. */
export const RX_ADMIN_ROLES = ['admin', 'super_admin'];
export function canSeeMargins(req: FastifyRequest): boolean {
  return isUnrestricted(req) || RX_ADMIN_ROLES.includes(req.auth?.roleCode ?? '');
}

export function suggestedFor(settings: RxSettingsView, lens: { purchasePrice: number; geometry: string }, supplierCoef: number | null | undefined) {
  return rxSuggestedPrice(lens.purchasePrice, rxCoefficientFor(settings, supplierCoef, lens.geometry));
}

/** Bornes d'un mois « AAAA-MM » (UTC). */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function monthOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Numéro « RX-AAMM-001 », séquentiel par mois. */
export async function nextOrderNumber(db: TenantPrisma, at: Date): Promise<string> {
  const prefix = `RX-${String(at.getUTCFullYear()).slice(2)}${String(at.getUTCMonth() + 1).padStart(2, '0')}-`;
  const last = await db.rxOrder.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: 'desc' }, select: { number: true } });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}

/* ------------------------------ Relevé mensuel ------------------------------ */

export interface StatementLine {
  id: string;
  /** Part des suppléments (taillé-monté, urgence) : seule soumise à TVA. */
  supplementsAmount: number;
  date: string;
  number: string;
  patient: string;
  lens: string;
  supplements: string;
  amount: number;
  credit: boolean;
  salePrice: number;
}

/**
 * Relevé d'un fournisseur pour un mois : commandes du mois hors annulées ;
 * un retour / SAV est déduit (avoir).
 */
export async function computeStatement(db: TenantPrisma, supplierId: string, month: string, settings: RxSettingsView) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId } });
  if (!supplier) return null;
  const { start, end } = monthRange(month);
  const orders = await db.rxOrder.findMany({
    where: { supplierId, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
  });
  const lines: StatementLine[] = orders.map((o) => {
    const snap = o.lensSnapshot as { reference?: string; designation?: string };
    const credit = o.status === 'RETURNED';
    const sup = (o.supplements as { label: string; amount: number }[]) ?? [];
    return {
      id: o.id,
      date: o.createdAt.toISOString(),
      number: o.number,
      patient: o.patientName,
      lens: `${snap.reference ?? ''} · ${snap.designation ?? ''}`,
      supplements: sup.map((s) => s.label).join(', '),
      amount: credit ? -o.purchasePrice : o.purchasePrice,
      supplementsAmount: (credit ? -1 : 1) * sup.reduce((s, x) => s + x.amount, 0),
      credit,
      salePrice: credit ? -o.salePrice : o.salePrice,
    };
  });
  const totalHt = lines.reduce((s, l) => s + l.amount, 0);
  // Les verres correcteurs sont exonérés de TVA : seule la part des
  // suppléments (prestations du fournisseur) y est soumise.
  const vatRate = supplier.rxVatRate ?? settings.vatRate;
  const vatBase = lines.reduce((s, l) => s + l.supplementsAmount, 0);
  const vatAmount = Math.round((vatBase * vatRate) / 100);
  const margin = lines.reduce((s, l) => s + (l.salePrice - l.amount), 0);
  const sales = lines.reduce((s, l) => s + l.salePrice, 0);
  // Échéance : 30 jours après la fin du mois (sauf délai propre au fournisseur).
  const dueDate = new Date(end.getTime() + 29 * 86_400_000);
  const code = (supplier.code || supplier.name.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return {
    supplier: { id: supplier.id, name: supplier.name, code, city: supplier.city, country: supplier.country, phone: supplier.phone, orderEmail: supplier.orderEmail, address: supplier.address },
    month,
    number: `REL-${code}-${month.replace('-', '')}`,
    lines,
    orderCount: lines.length,
    totalHt,
    vatRate,
    vatBase,
    vatAmount,
    totalTtc: totalHt + vatAmount,
    dueDate: dueDate.toISOString(),
    margin,
    marginPct: sales > 0 ? Math.round((margin / sales) * 1000) / 10 : 0,
  };
}

/* ------------------------------ Bon de commande ------------------------------ */

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Bon de commande HTML (email au fournisseur) — sans prix de vente patient. */
export function orderSheetHtml(o: {
  number: string;
  createdAt: Date;
  patientName: string;
  fileNumber: string | null;
  lensSnapshot: unknown;
  od: unknown;
  og: unknown;
  addition: number | null;
  pd: number | null;
  height: number | null;
  frameType: string | null;
  mounted: boolean;
  urgent: boolean;
  comment: string | null;
}, store: { name: string; phone?: string | null; email?: string | null }) {
  const lens = o.lensSnapshot as { reference?: string; designation?: string; shopName?: string | null; geometry?: string; lensIndex?: number | null; treatment?: string | null; fabrication?: string | null };
  const eye = (e: unknown) => e as { sph?: number | null; cyl?: number | null; axis?: number | null };
  const row = (label: string, bg: string, e: { sph?: number | null; cyl?: number | null; axis?: number | null }) =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #cbd5e1;background:${bg};color:#fff;font-weight:800;text-align:center">${label}</td>
      <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-family:Consolas,monospace;font-weight:700">${rxDiopter(e.sph)}</td>
      <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-family:Consolas,monospace;font-weight:700">${rxDiopter(e.cyl)}</td>
      <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-family:Consolas,monospace;font-weight:700">${e.axis != null ? `${e.axis}°` : '—'}</td>
      <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-family:Consolas,monospace;font-weight:700">${rxDiopter(o.addition)}</td>
    </tr>`;
  const options = [o.mounted && 'Taillé-monté', o.urgent && 'URGENT'].filter(Boolean).join(' · ') || 'Standard (non monté)';
  const mainLensName = lens.shopName ? lens.shopName : lens.designation;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
  <div style="height:5px;border-radius:3px;background:linear-gradient(90deg,#0f172a 0%,#0284c7 100%);margin-bottom:16px"></div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr>
      <td>
        <h2 style="margin:0;font-size:18px;text-transform:uppercase;letter-spacing:-0.02em;color:#0f172a">Bon de commande de verres</h2>
        <p style="margin:3px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em">OculoRX · Surfaçage & Taillage Ophtalmique</p>
      </td>
      <td style="text-align:right">
        <div style="display:inline-block;padding:6px 12px;border:1.5px solid #0f172a;border-radius:6px;background:#f8fafc">
          <div style="font-family:Consolas,monospace;font-size:15px;font-weight:800;color:#0f172a">${esc(o.number)}</div>
          <div style="font-size:10px;color:#64748b">${esc(o.createdAt.toLocaleDateString('fr-FR'))}</div>
          ${o.urgent ? '<div style="margin-top:2px;font-size:9px;font-weight:700;color:#ef4444;text-transform:uppercase">🚨 Urgent</div>' : ''}
        </div>
      </td>
    </tr>
  </table>

  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#f8fafc;margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Émetteur (Opticien)</div>
    <div style="font-size:13px;font-weight:700;color:#0f172a">${esc(store.name)}</div>
    ${store.phone ? `<div style="font-size:11px;color:#475569">Tél : ${esc(store.phone)}</div>` : ''}
  </div>

  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#f8fafc;margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Patient</div>
    <div style="font-size:13px;font-weight:700;color:#0f172a">${esc(o.patientName)}${o.fileNumber ? ` · <span style="font-family:Consolas,monospace;font-size:11px;font-weight:400;color:#475569">Dossier ${esc(o.fileNumber)}</span>` : ''}</div>
  </div>

  <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;margin-bottom:6px">Prescription Optique</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
    <tr style="background:#0f172a;color:#fff">
      <th style="padding:6px 10px;font-size:10px;text-align:center">Œil</th>
      <th style="padding:6px 10px;font-size:10px;text-align:right">Sphère</th>
      <th style="padding:6px 10px;font-size:10px;text-align:right">Cylindre</th>
      <th style="padding:6px 10px;font-size:10px;text-align:right">Axe</th>
      <th style="padding:6px 10px;font-size:10px;text-align:right">Addition</th>
    </tr>
    ${row('OD', '#0284c7', eye(o.od))}
    ${row('OG', '#0d9488', eye(o.og))}
  </table>

  <div style="border:1.5px solid #cbd5e1;border-radius:8px;padding:12px;background:#fff;margin-bottom:14px">
    <div style="font-size:13px;font-weight:800;color:#0f172a">${esc(mainLensName)}</div>
    <div style="font-size:11px;color:#475569;margin-top:4px">
      ${esc(RX_GEOMETRY_LABELS[lens.geometry as RxGeometry] ?? lens.geometry)}
      ${lens.lensIndex ? ` · Indice ${esc(String(lens.lensIndex).replace('.', ','))}` : ''}
      ${lens.treatment ? ` · ${esc(lens.treatment)}` : ''}
    </div>
    ${lens.shopName ? `
      <div style="font-size:10px;color:#64748b;margin-top:6px;padding-top:4px;border-top:1px dashed #e2e8f0">
        <b>Désignation fournisseur :</b> ${esc(lens.designation)} &nbsp;·&nbsp; <b>Réf usine :</b> ${esc(lens.reference)}
      </div>
    ` : `
      <div style="font-size:10px;color:#64748b;margin-top:6px;padding-top:4px;border-top:1px dashed #e2e8f0">
        <b>Réf usine :</b> ${esc(lens.reference)}
      </div>
    `}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
    <tr>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;width:25%">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700">EP</div>
        <div style="font-size:12px;font-weight:700;font-family:Consolas,monospace">${o.pd != null ? `${o.pd} mm` : '—'}</div>
      </td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;width:25%">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700">Hauteur</div>
        <div style="font-size:12px;font-weight:700;font-family:Consolas,monospace">${o.height != null ? `${o.height} mm` : '—'}</div>
      </td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;width:25%">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700">Monture</div>
        <div style="font-size:11px;font-weight:700">${esc(o.frameType ? RX_FRAME_LABELS[o.frameType as RxFrameType] : '—')}</div>
      </td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;width:25%">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700">Façonnage</div>
        <div style="font-size:11px;font-weight:700">${esc(options)}</div>
      </td>
    </tr>
  </table>

  ${o.comment ? `<div style="border-left:3px solid #f59e0b;background:#fffbeb;padding:8px 12px;margin-bottom:14px;font-size:11px;color:#92400e"><b>Instructions atelier :</b> ${esc(o.comment)}</div>` : ''}

  <p style="color:#94a3b8;font-size:10px;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">Commande transmise via OculoSaaS · Module OculoRX</p>
</div>`;
}

/** Envoie le bon de commande au fournisseur (sans bloquer la commande si l'envoi échoue). */
export async function emailOrder(to: string | null | undefined, html: string, number: string, storeName: string): Promise<boolean> {
  if (!to) return false;
  try {
    await mailer.send({ to, subject: `Commande verres ${number} — ${storeName}`, html });
    return true;
  } catch (e) {
    logger.warn({ err: e, number }, 'OculoRX : envoi du bon de commande impossible');
    return false;
  }
}

export const OPEN = RX_OPEN_STATUSES as string[];
