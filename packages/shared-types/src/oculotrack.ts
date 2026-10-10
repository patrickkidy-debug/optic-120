import { z } from 'zod';

/* ==========================================================================
 * OculoTrack — suivi des commandes et colis entre le magasin et ses
 * fournisseurs / laboratoires.
 *
 * Une « commande OculoTrack » est une commande de verres existante (LensOrder)
 * dont le suivi est activé : elle reçoit un numéro OT, un fournisseur et une
 * étape fine (`trackStage`). Les colis regroupent une ou plusieurs commandes,
 * à l'aller (magasin → laboratoire) ou au retour.
 * ========================================================================== */

/** Étapes d'une commande, dans l'ordre du cycle de vie. */
export const TRACK_STAGES = [
  'CREATED',
  'FRAME_PREPARED',
  'PACKED',
  'HANDED_TO_CARRIER',
  'IN_TRANSIT_TO_LAB',
  'RECEIVED_BY_LAB',
  'REGISTERED_BY_LAB',
  'MOUNT_PENDING',
  'MOUNTING',
  'MOUNTED',
  'QUALITY_CHECK',
  'READY_FOR_RETURN',
  'RETURN_HANDED',
  'IN_TRANSIT_TO_STORE',
  'ARRIVED_AT_STORE',
  'RECEIPT_CONFIRMED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type TrackStage = (typeof TRACK_STAGES)[number];

/** Rang d'une étape (CANCELLED hors séquence). */
export function trackStageRank(s: TrackStage): number {
  return s === 'CANCELLED' ? -1 : TRACK_STAGES.indexOf(s);
}

/** Code couleur : 🟢 terminé · 🔵 en cours · 🟠 en attente · 🔴 anomalie · ⚫ annulé. */
export type TrackTone = 'done' | 'progress' | 'waiting' | 'issue' | 'cancelled';
export const TRACK_STAGE_TONE: Record<TrackStage, TrackTone> = {
  CREATED: 'waiting',
  FRAME_PREPARED: 'waiting',
  PACKED: 'waiting',
  HANDED_TO_CARRIER: 'progress',
  IN_TRANSIT_TO_LAB: 'progress',
  RECEIVED_BY_LAB: 'progress',
  REGISTERED_BY_LAB: 'progress',
  MOUNT_PENDING: 'waiting',
  MOUNTING: 'progress',
  MOUNTED: 'progress',
  QUALITY_CHECK: 'progress',
  READY_FOR_RETURN: 'waiting',
  RETURN_HANDED: 'progress',
  IN_TRANSIT_TO_STORE: 'progress',
  ARRIVED_AT_STORE: 'progress',
  RECEIPT_CONFIRMED: 'done',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
};

/** Où se trouve physiquement la monture à chaque étape. */
export type TrackLocation = 'STORE' | 'TO_LAB' | 'LAB' | 'TO_STORE' | 'DONE';
export const TRACK_STAGE_LOCATION: Record<TrackStage, TrackLocation> = {
  CREATED: 'STORE',
  FRAME_PREPARED: 'STORE',
  PACKED: 'STORE',
  HANDED_TO_CARRIER: 'TO_LAB',
  IN_TRANSIT_TO_LAB: 'TO_LAB',
  RECEIVED_BY_LAB: 'LAB',
  REGISTERED_BY_LAB: 'LAB',
  MOUNT_PENDING: 'LAB',
  MOUNTING: 'LAB',
  MOUNTED: 'LAB',
  QUALITY_CHECK: 'LAB',
  READY_FOR_RETURN: 'LAB',
  RETURN_HANDED: 'TO_STORE',
  IN_TRANSIT_TO_STORE: 'TO_STORE',
  ARRIVED_AT_STORE: 'STORE',
  RECEIPT_CONFIRMED: 'STORE',
  COMPLETED: 'DONE',
  CANCELLED: 'DONE',
};

/** Étapes que le laboratoire peut fixer lui-même (traitement du montage). */
export const LAB_SETTABLE_STAGES = [
  'REGISTERED_BY_LAB',
  'MOUNT_PENDING',
  'MOUNTING',
  'MOUNTED',
  'QUALITY_CHECK',
  'READY_FOR_RETURN',
] as const satisfies readonly TrackStage[];

/** Étapes que le magasin peut fixer à la main (les autres découlent des colis). */
export const STORE_SETTABLE_STAGES = ['FRAME_PREPARED', 'COMPLETED', 'CANCELLED'] as const satisfies readonly TrackStage[];

/**
 * Correspondance avec le statut historique des commandes de verres : le
 * Kanban « Commandes de verres » reste juste quand OculoTrack fait avancer
 * une commande.
 */
export const TRACK_STAGE_TO_LENS_STATUS: Record<TrackStage, string> = {
  CREATED: 'TO_ORDER',
  FRAME_PREPARED: 'TO_ORDER',
  PACKED: 'TO_ORDER',
  HANDED_TO_CARRIER: 'ORDERED',
  IN_TRANSIT_TO_LAB: 'ORDERED',
  RECEIVED_BY_LAB: 'LAB_CONFIRMED',
  REGISTERED_BY_LAB: 'LAB_CONFIRMED',
  MOUNT_PENDING: 'IN_PRODUCTION',
  MOUNTING: 'MOUNTING',
  MOUNTED: 'CONTROL',
  QUALITY_CHECK: 'CONTROL',
  READY_FOR_RETURN: 'SHIPPED',
  RETURN_HANDED: 'SHIPPED',
  IN_TRANSIT_TO_STORE: 'SHIPPED',
  ARRIVED_AT_STORE: 'RECEIVED',
  RECEIPT_CONFIRMED: 'RECEIVED',
  COMPLETED: 'READY',
  CANCELLED: 'CANCELLED',
};

/* --------------------------------- Colis --------------------------------- */

export const TRACK_PACKAGE_DIRECTIONS = ['OUTBOUND', 'RETURN'] as const;
export type TrackPackageDirection = (typeof TRACK_PACKAGE_DIRECTIONS)[number];

export const TRACK_PACKAGE_STATUSES = ['PREPARING', 'HANDED_TO_CARRIER', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;
export type TrackPackageStatus = (typeof TRACK_PACKAGE_STATUSES)[number];

/* ------------------------------- Anomalies ------------------------------- */

export const TRACK_ANOMALY_TYPES = [
  'FRAME_MISSING',
  'FRAME_DAMAGED',
  'WRONG_FRAME',
  'WRONG_REFERENCE',
  'ORDER_MISSING',
  'PRESCRIPTION_UNREADABLE',
  'MEASUREMENTS_MISSING',
  'LENSES_UNAVAILABLE',
  'MANUFACTURING_ERROR',
  'OTHER',
] as const;
export type TrackAnomalyType = (typeof TRACK_ANOMALY_TYPES)[number];

/* ------------------------------ Pièces jointes ----------------------------- */

export const TRACK_ATTACHMENT_KINDS = [
  'FRAME_PHOTO',
  'PRESCRIPTION',
  'MEASUREMENT',
  'DOCUMENT',
  'MOUNT_PROOF',
  'PACKAGE_PHOTO',
  'RECEPTION_PHOTO',
  'ANOMALY',
  'SIGNATURE',
  'OTHER',
] as const;
export type TrackAttachmentKind = (typeof TRACK_ATTACHMENT_KINDS)[number];

/** Plafond d'une pièce jointe (data URL) : les photos sont réduites côté client. */
export const TRACK_ATTACHMENT_MAX = 4_500_000;

const dataUrl = z
  .string()
  .max(TRACK_ATTACHMENT_MAX)
  .refine((v) => /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(v), 'Fichier non pris en charge (photo ou PDF)');

const optDate = z.string().max(40).optional().or(z.literal(''));
const optText = (n: number) => z.string().trim().max(n).optional().or(z.literal(''));

/** Contexte « preuve » d'une action terrain (fournisseur, transporteur). */
export const trackProofSchema = z.object({
  /** Identifiant généré par l'appareil : rejouer une action hors ligne ne la duplique pas. */
  clientEventId: z.string().uuid().optional(),
  /** Heure réelle de l'action sur l'appareil (peut précéder la synchronisation). */
  occurredAt: z.string().datetime().optional(),
  /** Position, seulement si l'utilisateur l'a autorisée. */
  gps: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000).optional() }).optional(),
  photo: dataUrl.optional(),
  signature: dataUrl.optional(),
  note: optText(1000),
});

/* ------------------------------ Côté magasin ------------------------------ */

/** Active le suivi OculoTrack sur une commande de verres. */
export const trackStartSchema = z.object({
  supplierId: z.string().uuid(),
  frameRef: optText(120),
  measurementId: z.string().uuid().optional().or(z.literal('')),
  expectedAt: optDate,
  note: optText(1000),
});
export type TrackStartInput = z.infer<typeof trackStartSchema>;

export const trackOrderUpdateSchema = z.object({
  frameRef: optText(120),
  measurementId: z.string().uuid().optional().or(z.literal('')).nullable(),
  expectedAt: optDate,
});

export const trackStoreStageSchema = z.object({
  stage: z.enum(STORE_SETTABLE_STAGES),
  note: optText(1000),
});

export const trackAttachmentSchema = z.object({
  kind: z.enum(TRACK_ATTACHMENT_KINDS),
  name: optText(160),
  data: dataUrl,
});

/** « Préparer l'expédition » : crée le colis aller. */
export const trackPackageCreateSchema = z.object({
  lensOrderIds: z.array(z.string().uuid()).min(1).max(50),
  supplierId: z.string().uuid(),
  fromCity: optText(80),
  toCity: optText(80),
  carrierName: optText(120),
  externalTracking: optText(80),
  expectedAt: optDate,
  weightGrams: z.number().int().min(0).max(100000).nullable().optional(),
  note: optText(1000),
});
export type TrackPackageCreateInput = z.infer<typeof trackPackageCreateSchema>;

/** Remise au transporteur (magasin à l'aller, laboratoire au retour). */
export const trackHandoverSchema = trackProofSchema.extend({
  carrierName: optText(120),
  externalTracking: optText(80),
  shippedAt: optDate,
  expectedAt: optDate,
});

/** Réception d'un colis, avec vérification commande par commande. */
export const trackReceiveSchema = trackProofSchema.extend({
  checks: z
    .record(
      z.object({
        received: z.boolean(),
        reference: z.boolean(),
        quantity: z.boolean(),
        condition: z.boolean(),
      }),
    )
    .default({}),
});

export const trackAnomalySchema = trackProofSchema.extend({
  type: z.enum(TRACK_ANOMALY_TYPES),
  comment: optText(2000),
  lensOrderId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
});

export const trackAnomalyResolveSchema = z.object({ resolution: optText(1000) });

/** Le laboratoire fait avancer une commande. */
export const trackLabStageSchema = trackProofSchema.extend({
  stage: z.enum(LAB_SETTABLE_STAGES),
});

/** « Expédier vers le magasin » : colis retour créé par le laboratoire. */
export const trackReturnSchema = trackProofSchema.extend({
  lensOrderIds: z.array(z.string().uuid()).min(1).max(50),
  carrierName: optText(120),
  externalTracking: optText(80),
  shippedAt: optDate,
  expectedAt: optDate,
});

/* --------------------------------- Portail -------------------------------- */

export const PORTAL_ACCOUNT_KINDS = ['SUPPLIER', 'CARRIER'] as const;
export type PortalAccountKind = (typeof PORTAL_ACCOUNT_KINDS)[number];

export const portalInviteSchema = z.object({
  kind: z.enum(PORTAL_ACCOUNT_KINDS),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: optText(40),
  /** Obligatoire pour un compte fournisseur : le fournisseur de ce magasin qu'il représente. */
  supplierId: z.string().uuid().optional(),
});
export type PortalInviteInput = z.infer<typeof portalInviteSchema>;

export const portalLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const portalSetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, 'Au moins 8 caractères').max(200),
});
