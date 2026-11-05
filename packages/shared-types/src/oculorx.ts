import { z } from 'zod';

/* ============================================================================
 * OculoRX — portail de commande de verres auprès des fournisseurs.
 * Le magasin importe le catalogue de son verrier, commande depuis OculoSaaS,
 * voit son prix d'achat et sa marge, puis édite le relevé mensuel dû.
 * ========================================================================== */

export const RX_GEOMETRIES = ['UNIFOCAL', 'PROGRESSIF', 'BIFOCAL', 'DEGRESSIF'] as const;
export type RxGeometry = (typeof RX_GEOMETRIES)[number];
export const RX_GEOMETRY_LABELS: Record<RxGeometry, string> = {
  UNIFOCAL: 'Unifocal',
  PROGRESSIF: 'Progressif',
  BIFOCAL: 'Bifocal',
  DEGRESSIF: 'Dégressif',
};

export const RX_INDICES = [1.5, 1.56, 1.59, 1.6, 1.67, 1.74] as const;
export const RX_MATERIALS = ['Organique', 'Polycarbonate', 'Minéral'] as const;

/** Cycle de vie d'une commande : Envoyée → En fabrication → Expédiée → Livrée. */
export const RX_STATUSES = ['SENT', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] as const;
export type RxStatus = (typeof RX_STATUSES)[number];
export const RX_STATUS_LABELS: Record<RxStatus, string> = {
  SENT: 'Envoyée',
  IN_PRODUCTION: 'En fabrication',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  RETURNED: 'Retour / SAV',
};
/** Statuts atteignables depuis chaque statut (changement manuel). */
export const RX_NEXT_STATUSES: Record<RxStatus, RxStatus[]> = {
  SENT: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};
/** Commandes encore chez le fournisseur. */
export const RX_OPEN_STATUSES: readonly RxStatus[] = ['SENT', 'IN_PRODUCTION', 'SHIPPED'];

export const RX_FRAME_TYPES = ['CERCLEE', 'NYLOR', 'PERCEE'] as const;
export type RxFrameType = (typeof RX_FRAME_TYPES)[number];
export const RX_FRAME_LABELS: Record<RxFrameType, string> = { CERCLEE: 'Cerclée', NYLOR: 'Nylor', PERCEE: 'Percée' };

export const RX_DEFAULTS = { coefficient: 2.8, vatRate: 18, mountedFee: 2500, urgentFee: 3000 } as const;

/** Arrondi aux 500 FCFA les plus proches. */
export function rxRound500(n: number): number {
  return Math.round(n / 500) * 500;
}

/** Les géométries à addition (vision de près intégrée). */
export function rxNeedsAddition(geometry: string): boolean {
  return geometry === 'PROGRESSIF' || geometry === 'BIFOCAL' || geometry === 'DEGRESSIF';
}

export interface RxCoefficientSettings {
  coefficient: number;
  geometryCoefficients: Partial<Record<RxGeometry, number>>;
}

/** Coefficient de vente : celui du fournisseur, sinon de la géométrie, sinon le global. */
export function rxCoefficientFor(settings: RxCoefficientSettings, supplierCoefficient: number | null | undefined, geometry: string): number {
  if (supplierCoefficient && supplierCoefficient > 0) return supplierCoefficient;
  const g = settings.geometryCoefficients[geometry as RxGeometry];
  if (g && g > 0) return g;
  return settings.coefficient > 0 ? settings.coefficient : RX_DEFAULTS.coefficient;
}

/** Prix de vente conseillé d'un verre : achat × coefficient, arrondi aux 500 FCFA. */
export function rxSuggestedPrice(purchasePrice: number, coefficient: number): number {
  return rxRound500(purchasePrice * coefficient);
}

/** Valeur dioptrique affichée avec signe et deux décimales : +1,25 / -0,75. */
export function rxDiopter(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  const s = Math.abs(v).toFixed(2).replace('.', ',');
  return v > 0 ? `+${s}` : v < 0 ? `-${s}` : '0,00';
}

/* ------------------------------ Contrôles ------------------------------ */

export interface RxEye {
  sph?: number | null;
  cyl?: number | null;
  axis?: number | null;
}
export interface RxLensRange {
  geometry: string;
  sphMin?: number | null;
  sphMax?: number | null;
  cylMax?: number | null;
  addMin?: number | null;
  addMax?: number | null;
}
export interface RxCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

/**
 * Contrôles de fabrication d'une ordonnance pour un verre donné. Partagés
 * entre l'écran (affichage vert / rouge en direct) et le serveur (refus).
 */
export function rxChecks(lens: RxLensRange, input: { od: RxEye; og: RxEye; addition?: number | null; hasPatient: boolean }): RxCheck[] {
  const out: RxCheck[] = [];
  const range = (v: number, min?: number | null, max?: number | null) => (min == null || v >= min) && (max == null || v <= max);
  const plage = `${rxDiopter(lens.sphMin ?? null)} à ${rxDiopter(lens.sphMax ?? null)}`;
  for (const [eye, e] of [['OD', input.od], ['OG', input.og]] as const) {
    if (e.sph == null) {
      out.push({ key: `${eye}-sph`, label: `Sphère ${eye}`, ok: false, detail: 'à saisir' });
    } else {
      const ok = range(e.sph, lens.sphMin, lens.sphMax);
      out.push({ key: `${eye}-sph`, label: `Sphère ${eye} ${rxDiopter(e.sph)}`, ok, detail: ok ? 'dans la plage' : `hors fabrication (${plage})` });
    }
    if (e.cyl != null && e.cyl !== 0) {
      const ok = lens.cylMax == null || Math.abs(e.cyl) <= lens.cylMax;
      out.push({ key: `${eye}-cyl`, label: `Cylindre ${eye} ${rxDiopter(e.cyl)}`, ok, detail: ok ? 'dans la plage' : `hors fabrication (max ${rxDiopter(lens.cylMax ?? null).replace('+', '')})` });
      const axisOk = e.axis != null && e.axis >= 0 && e.axis <= 180;
      out.push({ key: `${eye}-axis`, label: `Axe ${eye}`, ok: axisOk, detail: axisOk ? `${e.axis}°` : 'entre 0 et 180° requis' });
    }
  }
  if (rxNeedsAddition(lens.geometry)) {
    const a = input.addition;
    if (a == null) {
      out.push({ key: 'add', label: 'Addition', ok: false, detail: 'obligatoire pour ce verre' });
    } else {
      const ok = range(a, lens.addMin, lens.addMax);
      out.push({ key: 'add', label: `Addition ${rxDiopter(a)}`, ok, detail: ok ? 'dans la plage' : `hors fabrication (${rxDiopter(lens.addMin ?? null)} à ${rxDiopter(lens.addMax ?? null)})` });
    }
  }
  out.push({ key: 'patient', label: 'Patient', ok: input.hasPatient, detail: input.hasPatient ? 'renseigné' : 'à renseigner' });
  return out;
}

/* ------------------------------ Import ------------------------------ */

export interface RxLensRow {
  reference: string;
  designation: string;
  geometry: RxGeometry;
  lensIndex: number | null;
  material: string | null;
  treatment: string | null;
  diameter: number | null;
  sphMin: number | null;
  sphMax: number | null;
  cylMax: number | null;
  addMin: number | null;
  addMax: number | null;
  purchasePrice: number;
}

/** En-têtes du fichier modèle, dans l'ordre. */
export const RX_IMPORT_COLUMNS = [
  'reference', 'designation', 'geometrie', 'indice', 'matiere', 'traitement', 'diametre',
  'sph_min', 'sph_max', 'cyl_max', 'add_min', 'add_max', 'prix_achat_ht',
] as const;

/** En-tête normalisé : minuscules, sans accents ni espaces superflus. */
export function rxNormalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-./]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/** Nombre saisi avec virgule ou point, espaces de milliers tolérés. */
export function rxParseNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[\s  ]/g, '').replace(',', '.').replace(/[^0-9.+-]/g, '');
  if (s === '' || s === '+' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseGeometry(v: unknown): RxGeometry | null {
  const s = rxNormalizeHeader(String(v ?? ''));
  if (!s) return null;
  if (s.startsWith('uni') || s.startsWith('simple')) return 'UNIFOCAL';
  if (s.startsWith('prog')) return 'PROGRESSIF';
  if (s.startsWith('bif') || s.startsWith('double')) return 'BIFOCAL';
  if (s.startsWith('deg')) return 'DEGRESSIF';
  return null;
}

/**
 * Lit les lignes d'un catalogue (objets clé = en-tête). Une ligne sans
 * référence, désignation ou prix est écartée avec sa raison.
 */
export function rxParseRows(records: Record<string, unknown>[]): { valid: RxLensRow[]; invalid: { line: number; reason: string; reference?: string }[] } {
  const valid: RxLensRow[] = [];
  const invalid: { line: number; reason: string; reference?: string }[] = [];
  records.forEach((raw, i) => {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) r[rxNormalizeHeader(k)] = typeof v === 'string' ? v.trim() : v;
    const line = i + 2; // ligne 1 = en-têtes
    const reference = String(r.reference ?? r.ref ?? '').trim();
    const designation = String(r.designation ?? r.libelle ?? '').trim();
    const price = rxParseNumber(r.prix_achat_ht ?? r.prix_achat ?? r.prix);
    if (Object.values(r).every((v) => v == null || v === '')) return; // ligne vide
    const missing = [!reference && 'référence', !designation && 'désignation', (price == null || price < 0) && 'prix'].filter(Boolean);
    if (missing.length) {
      invalid.push({ line, reference: reference || undefined, reason: `${missing.join(', ')} manquant(e)` });
      return;
    }
    valid.push({
      reference,
      designation,
      geometry: parseGeometry(r.geometrie ?? r.geometry) ?? 'UNIFOCAL',
      lensIndex: rxParseNumber(r.indice ?? r.index),
      material: String(r.matiere ?? '').trim() || null,
      treatment: String(r.traitement ?? '').trim() || null,
      diameter: rxParseNumber(r.diametre) != null ? Math.round(rxParseNumber(r.diametre)!) : null,
      sphMin: rxParseNumber(r.sph_min),
      sphMax: rxParseNumber(r.sph_max),
      cylMax: rxParseNumber(r.cyl_max) != null ? Math.abs(rxParseNumber(r.cyl_max)!) : null,
      addMin: rxParseNumber(r.add_min),
      addMax: rxParseNumber(r.add_max),
      purchasePrice: Math.round(price!),
    });
  });
  return { valid, invalid };
}

/* ------------------------------ Schémas API ------------------------------ */

const optNum = z.number().finite().nullable().optional();
const optStr = (max: number) => z.string().trim().max(max).nullable().optional();

export const rxSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(120),
  code: optStr(20),
  city: optStr(80),
  country: optStr(80),
  deliveryDays: z.number().int().min(0).max(120).nullable().optional(),
  contactName: optStr(120),
  phone: optStr(40),
  orderEmail: z.string().trim().email('Email invalide').max(160).nullable().optional().or(z.literal('')),
  rxCoefficient: z.number().min(0.5).max(10).nullable().optional(),
  rxVatRate: z.number().min(0).max(100).nullable().optional(),
});
export type RxSupplierInput = z.infer<typeof rxSupplierSchema>;

export const rxLensRowSchema = z.object({
  reference: z.string().trim().min(1).max(60),
  designation: z.string().trim().min(1).max(200),
  geometry: z.enum(RX_GEOMETRIES),
  lensIndex: optNum,
  material: optStr(60),
  treatment: optStr(120),
  diameter: z.number().int().min(0).max(100).nullable().optional(),
  sphMin: optNum,
  sphMax: optNum,
  cylMax: optNum,
  addMin: optNum,
  addMax: optNum,
  purchasePrice: z.number().int().min(0).max(100_000_000),
});

export const rxImportSchema = z.object({
  supplierId: z.string().uuid(),
  rows: z.array(rxLensRowSchema).min(1).max(5000),
});

const eyeSchema = z.object({ sph: optNum, cyl: optNum, axis: z.number().int().min(0).max(180).nullable().optional() });

export const rxOrderCreateSchema = z.object({
  lensId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  patientName: optStr(160),
  fileNumber: optStr(60),
  od: eyeSchema,
  og: eyeSchema,
  addition: optNum,
  pd: optNum,
  height: optNum,
  frameType: z.enum(RX_FRAME_TYPES).nullable().optional(),
  mounted: z.boolean().default(false),
  urgent: z.boolean().default(false),
  comment: optStr(1000),
  /** Prix de vente patient (paire), modifiable par l'opticien. */
  salePrice: z.number().int().min(0).max(100_000_000),
  branchId: z.string().uuid().nullable().optional(),
});
export type RxOrderCreateInput = z.infer<typeof rxOrderCreateSchema>;

export const rxStatusSchema = z.object({ status: z.enum(RX_STATUSES), note: optStr(300) });

export const rxSettingsSchema = z.object({
  coefficient: z.number().min(0.5).max(10),
  geometryCoefficients: z.record(z.enum(RX_GEOMETRIES), z.number().min(0.5).max(10)).default({}),
  vatRate: z.number().min(0).max(100),
  mountedFee: z.number().int().min(0).max(1_000_000),
  urgentFee: z.number().int().min(0).max(1_000_000),
});
export type RxSettingsInput = z.infer<typeof rxSettingsSchema>;

export const rxStatementPaySchema = z.object({
  paid: z.boolean(),
  paidAt: z.string().optional(),
  paymentMethod: optStr(60),
});

/* --------------------- Lien avec « Commandes de verres » --------------------- */

/** Statut de la commande de verres liée, selon le statut OculoRX. */
export const RX_TO_LENS_STATUS: Record<RxStatus, string | null> = {
  SENT: 'ORDERED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  RETURNED: null,
};

/** Statut OculoRX correspondant au statut d'une commande de verres (ou à son étape OculoTrack). */
export function rxStatusFromLensStatus(status: string): RxStatus | null {
  if (status === 'TO_ORDER' || status === 'ORDERED') return 'SENT';
  if (['LAB_CONFIRMED', 'IN_PRODUCTION', 'MOUNTING', 'MOUNTED', 'CONTROL'].includes(status)) return 'IN_PRODUCTION';
  if (status === 'SHIPPED') return 'SHIPPED';
  if (['RECEIVED', 'READY', 'DELIVERED'].includes(status)) return 'DELIVERED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return null;
}

const RX_FLOW: RxStatus[] = ['SENT', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED'];
/** Avancée seulement : une synchronisation ne fait jamais reculer une commande. */
export function rxIsForward(from: RxStatus, to: RxStatus): boolean {
  if (from === 'CANCELLED' || from === 'RETURNED' || from === to) return false;
  if (to === 'CANCELLED') return from !== 'DELIVERED';
  return RX_FLOW.indexOf(to) > RX_FLOW.indexOf(from);
}
