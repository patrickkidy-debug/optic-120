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
  const lens = o.lensSnapshot as { reference?: string; designation?: string; geometry?: string; lensIndex?: number | null; treatment?: string | null };
  const eye = (e: unknown) => e as { sph?: number | null; cyl?: number | null; axis?: number | null };
  const row = (label: string, e: { sph?: number | null; cyl?: number | null; axis?: number | null }) =>
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:700">${label}</td><td style="padding:6px 10px;border:1px solid #ddd">${rxDiopter(e.sph)}</td><td style="padding:6px 10px;border:1px solid #ddd">${rxDiopter(e.cyl)}</td><td style="padding:6px 10px;border:1px solid #ddd">${e.axis != null ? `${e.axis}°` : '—'}</td></tr>`;
  const options = [o.mounted && 'Taillé-monté', o.urgent && 'URGENT'].filter(Boolean).join(' · ') || '—';
  return `<div style="font-family:Arial,sans-serif;color:#111;max-width:640px">
<h2 style="margin:0">Bon de commande ${esc(o.number)}</h2>
<p style="color:#555;margin:4px 0 16px">${esc(store.name)}${store.phone ? ` · ${esc(store.phone)}` : ''} — ${esc(o.createdAt.toLocaleDateString('fr-FR'))}</p>
<p><b>Verre :</b> ${esc(lens.reference)} — ${esc(lens.designation)} (${esc(RX_GEOMETRY_LABELS[lens.geometry as RxGeometry] ?? lens.geometry)}${lens.lensIndex ? `, indice ${esc(lens.lensIndex)}` : ''})</p>
<p><b>Patient :</b> ${esc(o.patientName)}${o.fileNumber ? ` · dossier ${esc(o.fileNumber)}` : ''}</p>
<table style="border-collapse:collapse;margin:8px 0"><tr><th></th><th style="padding:6px 10px;border:1px solid #ddd">Sphère</th><th style="padding:6px 10px;border:1px solid #ddd">Cylindre</th><th style="padding:6px 10px;border:1px solid #ddd">Axe</th></tr>${row('OD', eye(o.od))}${row('OG', eye(o.og))}</table>
<p><b>Addition :</b> ${rxDiopter(o.addition)} · <b>EP :</b> ${o.pd ?? '—'} mm · <b>Hauteur :</b> ${o.height ?? '—'} mm</p>
<p><b>Monture :</b> ${esc(o.frameType ? RX_FRAME_LABELS[o.frameType as RxFrameType] : '—')} · <b>Options :</b> ${esc(options)}</p>
${o.comment ? `<p><b>Commentaire :</b> ${esc(o.comment)}</p>` : ''}
<p style="color:#888;font-size:12px;margin-top:24px">Commande envoyée depuis OculoSaaS · OculoRX</p></div>`;
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
