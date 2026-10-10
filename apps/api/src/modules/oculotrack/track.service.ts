import { randomBytes } from 'node:crypto';
import {
  TRACK_STAGE_TO_LENS_STATUS,
  trackStageRank,
  type TrackAnomalyType,
  type TrackStage,
} from '@oculo/shared-types';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { prisma } from '../../lib/prisma.js';
import { nextCounterNumber } from '../../lib/document-number.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';

/* ==========================================================================
 * Moteur OculoTrack : toutes les écritures passent par ici, qu'elles viennent
 * du magasin, du portail fournisseur / transporteur ou du système. Chaque
 * fonction reçoit un client CLOISONNÉ (forTenant) et un acteur ; chaque
 * changement crée un TrackEvent (jamais modifié ni supprimé).
 * ========================================================================== */

export type ActorType = 'STAFF' | 'SUPPLIER' | 'CARRIER' | 'SYSTEM';

export interface Actor {
  type: ActorType;
  id?: string | null;
  name: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface Proof {
  clientEventId?: string;
  occurredAt?: string;
  gps?: { lat: number; lng: number; accuracy?: number };
  photo?: string;
  signature?: string;
  note?: string;
}

export const SYSTEM_ACTOR: Actor = { type: 'SYSTEM', name: 'OculoTrack' };

/** Jeton opaque (QR code, lien public) : 32 octets aléatoires, non devinable. */
export function newToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function nextTrackNumber(db: TenantPrisma, tenantId: string, prefix: 'OT' | 'PKG'): Promise<string> {
  const year = new Date().getFullYear();
  return nextCounterNumber(db as never, tenantId, prefix, year, async () => {
    if (prefix === 'OT') {
      const rows = await db.lensOrder.findMany({ where: { trackCode: { startsWith: `OT-${year}-` } }, select: { trackCode: true } });
      return rows.map((r) => r.trackCode!).filter(Boolean);
    }
    const rows = await db.trackPackage.findMany({ where: { number: { startsWith: `PKG-${year}-` } }, select: { number: true } });
    return rows.map((r) => r.number);
  });
}

/** Une action rejouée (hors ligne) porte le même clientEventId : elle n'est appliquée qu'une fois. */
export async function alreadyApplied(clientEventId?: string): Promise<boolean> {
  if (!clientEventId) return false;
  const ev = await prisma.trackEvent.findUnique({ where: { clientEventId }, select: { id: true } });
  return Boolean(ev);
}

function proofMeta(actor: Actor, proof?: Proof, extra?: Record<string, unknown>) {
  return {
    ip: actor.ip ?? null,
    device: actor.userAgent ? actor.userAgent.slice(0, 240) : null,
    gps: proof?.gps ?? null,
    note: proof?.note || null,
    ...extra,
  };
}

export async function addEvent(
  db: TenantPrisma,
  e: {
    lensOrderId?: string | null;
    packageId?: string | null;
    type: string;
    stage?: string | null;
    actor: Actor;
    message?: string | null;
    meta?: Record<string, unknown>;
    clientEventId?: string;
    occurredAt?: string;
  },
) {
  return db.trackEvent.create({
    data: {
      lensOrderId: e.lensOrderId ?? null,
      packageId: e.packageId ?? null,
      type: e.type,
      stage: e.stage ?? null,
      actorType: e.actor.type,
      actorId: e.actor.id ?? null,
      actorName: e.actor.name,
      message: e.message ?? null,
      meta: (e.meta ?? undefined) as object | undefined,
      clientEventId: e.clientEventId ?? null,
      occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
    } as never,
  });
}

export async function notify(db: TenantPrisma, n: { kind: string; title: string; body: string; link?: string }) {
  await db.tenantNotification.create({ data: { kind: n.kind, title: n.title, body: n.body, link: n.link ?? null } as never });
}

export async function addAttachment(
  db: TenantPrisma,
  a: {
    lensOrderId?: string | null;
    packageId?: string | null;
    anomalyId?: string | null;
    eventId?: string | null;
    kind: string;
    name?: string | null;
    data: string;
    actor: Actor;
  },
) {
  const mime = /^data:([^;]+);/.exec(a.data)?.[1] ?? 'application/octet-stream';
  const sizeBytes = Math.round((a.data.length - a.data.indexOf(',') - 1) * 0.75);
  return db.trackAttachment.create({
    data: {
      lensOrderId: a.lensOrderId ?? null,
      packageId: a.packageId ?? null,
      anomalyId: a.anomalyId ?? null,
      eventId: a.eventId ?? null,
      kind: a.kind,
      name: a.name ?? null,
      mime,
      sizeBytes,
      data: a.data,
      uploadedByType: a.actor.type,
      uploadedByName: a.actor.name,
    } as never,
    select: { id: true, kind: true, name: true, mime: true, sizeBytes: true, createdAt: true },
  });
}

/* ------------------------------- Étapes ---------------------------------- */

/** Fait passer des commandes à une étape, synchronise le statut historique et trace. */
export async function setStage(
  db: TenantPrisma,
  orderIds: string[],
  stage: TrackStage,
  actor: Actor,
  opts: { packageId?: string | null; message?: string; proof?: Proof; type?: string } = {},
) {
  const orders = await db.lensOrder.findMany({
    where: { id: { in: orderIds }, trackCode: { not: null } },
    select: { id: true, trackCode: true, trackStage: true, deliveredAt: true },
  });
  for (const o of orders) {
    await db.lensOrder.updateMany({
      where: { id: o.id },
      data: { trackStage: stage, status: TRACK_STAGE_TO_LENS_STATUS[stage] as never },
    });
    await addEvent(db, {
      lensOrderId: o.id,
      packageId: opts.packageId,
      type: opts.type ?? 'STAGE_CHANGED',
      stage,
      actor,
      message: opts.message,
      meta: proofMeta(actor, opts.proof, { from: o.trackStage }),
      // Le clientEventId n'est posé que sur le premier événement (unicité).
      clientEventId: orders.indexOf(o) === 0 ? opts.proof?.clientEventId : undefined,
      occurredAt: opts.proof?.occurredAt,
    });
  }
  return orders.length;
}

/* ------------------------------ Commandes ------------------------------- */

export async function startTracking(
  db: TenantPrisma,
  tenantId: string,
  orderId: string,
  input: { supplierId: string; frameRef?: string | null; measurementId?: string | null; expectedAt?: string | null; note?: string | null },
  actor: Actor,
) {
  const order = await db.lensOrder.findFirst({ where: { id: orderId } });
  if (!order) throw notFound('Commande introuvable');
  if (order.trackCode) throw conflict('Le suivi OculoTrack est déjà activé pour cette commande');
  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId }, select: { id: true, name: true } });
  if (!supplier) throw notFound('Fournisseur introuvable');
  if (input.measurementId) {
    const m = await db.opticalMeasurement.findFirst({ where: { id: input.measurementId }, select: { id: true } });
    if (!m) throw notFound('Prise de mesures introuvable');
  }
  const trackCode = await nextTrackNumber(db, tenantId, 'OT');
  await db.lensOrder.updateMany({
    where: { id: orderId },
    data: {
      trackCode,
      trackStage: 'CREATED',
      trackStartedAt: new Date(),
      publicToken: newToken(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      frameRef: input.frameRef || null,
      measurementId: input.measurementId || null,
      ...(input.expectedAt ? { expectedAt: new Date(input.expectedAt) } : {}),
    },
  });
  await addEvent(db, {
    lensOrderId: orderId,
    type: 'ORDER_TRACKING_STARTED',
    stage: 'CREATED',
    actor,
    message: input.note || null,
    meta: proofMeta(actor, undefined, { supplier: supplier.name, number: order.number }),
  });
  return trackCode;
}

/* -------------------------------- Colis --------------------------------- */

const ACTIVE_PACKAGE = ['PREPARING', 'HANDED_TO_CARRIER', 'IN_TRANSIT'];

export async function createOutboundPackage(
  db: TenantPrisma,
  tenantId: string,
  input: {
    lensOrderIds: string[];
    supplierId: string;
    fromCity?: string | null;
    toCity?: string | null;
    carrierName?: string | null;
    externalTracking?: string | null;
    expectedAt?: string | null;
    weightGrams?: number | null;
    note?: string | null;
  },
  actor: Actor,
) {
  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId }, select: { id: true, name: true, city: true } });
  if (!supplier) throw notFound('Fournisseur introuvable');
  const ids = [...new Set(input.lensOrderIds)];
  const orders = await db.lensOrder.findMany({
    where: { id: { in: ids } },
    select: { id: true, trackCode: true, trackStage: true, supplierId: true, number: true },
  });
  if (orders.length !== ids.length) throw notFound('Commande introuvable');
  for (const o of orders) {
    if (!o.trackCode) throw badRequest(`Activez d'abord le suivi OculoTrack de la commande ${o.number}`);
    if (o.supplierId !== supplier.id) throw badRequest(`La commande ${o.trackCode} est destinée à un autre fournisseur`);
    if (trackStageRank(o.trackStage as TrackStage) > trackStageRank('PACKED')) {
      throw badRequest(`La commande ${o.trackCode} a déjà quitté le magasin`);
    }
  }
  const busy = await db.trackPackageItem.findFirst({
    where: { lensOrderId: { in: ids }, package: { direction: 'OUTBOUND', status: { in: ACTIVE_PACKAGE } } },
    select: { lensOrder: { select: { trackCode: true } }, package: { select: { number: true } } },
  });
  if (busy) throw conflict(`La commande ${busy.lensOrder.trackCode} est déjà dans le colis ${busy.package.number}`);

  const number = await nextTrackNumber(db, tenantId, 'PKG');
  const pkg = await db.trackPackage.create({
    data: {
      number,
      token: newToken(),
      direction: 'OUTBOUND',
      status: 'PREPARING',
      supplierId: supplier.id,
      fromCity: input.fromCity || null,
      toCity: input.toCity || supplier.city || null,
      carrierName: input.carrierName || null,
      externalTracking: input.externalTracking || null,
      expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
      weightGrams: input.weightGrams ?? null,
      note: input.note || null,
      createdById: actor.type === 'STAFF' ? actor.id ?? null : null,
      items: { create: ids.map((lensOrderId) => ({ lensOrderId, tenantId })) },
    } as never,
  });
  await addEvent(db, { packageId: pkg.id, type: 'PACKAGE_CREATED', stage: 'PREPARING', actor, message: `${ids.length} commande(s)`, meta: proofMeta(actor) });
  await setStage(db, ids, 'PACKED', actor, { packageId: pkg.id, message: number });
  return pkg;
}

/** Remise au transporteur (expéditeur). Sans compte transporteur, le colis part aussitôt « en transit ». */
export async function handover(
  db: TenantPrisma,
  pkgId: string,
  input: { carrierName?: string | null; externalTracking?: string | null; shippedAt?: string | null; expectedAt?: string | null } & Proof,
  actor: Actor,
) {
  const pkg = await db.trackPackage.findFirst({ where: { id: pkgId }, include: { items: { select: { lensOrderId: true } } } });
  if (!pkg) throw notFound('Colis introuvable');
  if (pkg.status !== 'PREPARING') throw badRequest('Ce colis a déjà été remis au transporteur');
  const now = input.shippedAt ? new Date(input.shippedAt) : new Date();
  const toCarrierAccount = Boolean(pkg.carrierAccessId);
  await db.trackPackage.updateMany({
    where: { id: pkgId },
    data: {
      status: toCarrierAccount ? 'HANDED_TO_CARRIER' : 'IN_TRANSIT',
      carrierName: input.carrierName || pkg.carrierName,
      externalTracking: input.externalTracking || pkg.externalTracking,
      handedAt: now,
      shippedAt: now,
      ...(input.expectedAt ? { expectedAt: new Date(input.expectedAt) } : {}),
    },
  });
  const ev = await addEvent(db, {
    packageId: pkgId,
    type: 'PACKAGE_HANDED_TO_CARRIER',
    stage: 'HANDED_TO_CARRIER',
    actor,
    message: input.carrierName || pkg.carrierName || null,
    meta: proofMeta(actor, input, { externalTracking: input.externalTracking || pkg.externalTracking }),
    clientEventId: input.clientEventId,
    occurredAt: input.occurredAt,
  });
  if (input.photo) await addAttachment(db, { packageId: pkgId, eventId: ev.id, kind: 'PACKAGE_PHOTO', data: input.photo, actor });
  const ids = pkg.items.map((i) => i.lensOrderId);
  const out = pkg.direction === 'OUTBOUND';
  await setStage(db, ids, out ? 'HANDED_TO_CARRIER' : 'RETURN_HANDED', actor, { packageId: pkgId });
  if (!toCarrierAccount) {
    await addEvent(db, { packageId: pkgId, type: 'PACKAGE_IN_TRANSIT', stage: 'IN_TRANSIT', actor: SYSTEM_ACTOR });
    await setStage(db, ids, out ? 'IN_TRANSIT_TO_LAB' : 'IN_TRANSIT_TO_STORE', SYSTEM_ACTOR, { packageId: pkgId });
  }
  if (!out) {
    await notify(db, {
      kind: 'OT_RETURN_SHIPPED',
      title: `🚚 Colis ${pkg.number} en route`,
      body: `Votre colis ${pkg.number} est en route vers votre magasin.`,
      link: `/optique/oculotrack?package=${pkgId}`,
    });
  }
}

/** Le transporteur confirme la prise en charge (colis remis par l'expéditeur). */
export async function carrierPickup(db: TenantPrisma, pkgId: string, proof: Proof, actor: Actor) {
  const pkg = await db.trackPackage.findFirst({ where: { id: pkgId }, include: { items: { select: { lensOrderId: true } } } });
  if (!pkg) throw notFound('Colis introuvable');
  if (!['PREPARING', 'HANDED_TO_CARRIER'].includes(pkg.status)) throw badRequest('Colis déjà en transit ou livré');
  await db.trackPackage.updateMany({ where: { id: pkgId }, data: { status: 'IN_TRANSIT', handedAt: pkg.handedAt ?? new Date() } });
  await addEvent(db, { packageId: pkgId, type: 'PACKAGE_PICKED_UP', stage: 'IN_TRANSIT', actor, meta: proofMeta(actor, proof), clientEventId: proof.clientEventId, occurredAt: proof.occurredAt });
  const out = pkg.direction === 'OUTBOUND';
  await setStage(db, pkg.items.map((i) => i.lensOrderId), out ? 'IN_TRANSIT_TO_LAB' : 'IN_TRANSIT_TO_STORE', actor, { packageId: pkgId });
}

/** Point de passage du transporteur (« Arrivé à Abidjan »). */
export async function carrierCheckpoint(db: TenantPrisma, pkgId: string, message: string, proof: Proof, actor: Actor) {
  const pkg = await db.trackPackage.findFirst({ where: { id: pkgId }, select: { id: true, status: true } });
  if (!pkg) throw notFound('Colis introuvable');
  if (pkg.status !== 'IN_TRANSIT') throw badRequest("Le colis n'est pas en transit");
  await addEvent(db, { packageId: pkgId, type: 'CARRIER_CHECKPOINT', actor, message, meta: proofMeta(actor, proof), clientEventId: proof.clientEventId, occurredAt: proof.occurredAt });
}

const CHECK_TO_ANOMALY: Record<string, TrackAnomalyType> = {
  received: 'FRAME_MISSING',
  reference: 'WRONG_REFERENCE',
  quantity: 'ORDER_MISSING',
  condition: 'FRAME_DAMAGED',
};

/**
 * Réception d'un colis par son destinataire : le laboratoire (aller) ou le
 * magasin (retour). Un contrôle non coché crée automatiquement une anomalie.
 */
export async function receivePackage(
  db: TenantPrisma,
  pkgId: string,
  input: Proof & { checks?: Record<string, { received: boolean; reference: boolean; quantity: boolean; condition: boolean }> },
  actor: Actor,
) {
  const pkg = await db.trackPackage.findFirst({
    where: { id: pkgId },
    include: { items: { include: { lensOrder: { select: { id: true, trackCode: true } } } }, supplier: { select: { name: true } } },
  });
  if (!pkg) throw notFound('Colis introuvable');
  if (pkg.status === 'RECEIVED') throw conflict('Réception déjà confirmée pour ce colis');
  if (pkg.status === 'CANCELLED') throw badRequest('Colis annulé');
  const when = input.occurredAt ? new Date(input.occurredAt) : new Date();
  await db.trackPackage.updateMany({ where: { id: pkgId }, data: { status: 'RECEIVED', receivedAt: when } });
  const ev = await addEvent(db, {
    packageId: pkgId,
    type: 'PACKAGE_RECEIVED',
    stage: 'RECEIVED',
    actor,
    message: `Colis réceptionné par ${actor.name}`,
    meta: proofMeta(actor, input, { checks: input.checks ?? {} }),
    clientEventId: input.clientEventId,
    occurredAt: input.occurredAt,
  });
  if (input.photo) await addAttachment(db, { packageId: pkgId, eventId: ev.id, kind: 'RECEPTION_PHOTO', data: input.photo, actor });
  if (input.signature) await addAttachment(db, { packageId: pkgId, eventId: ev.id, kind: 'SIGNATURE', data: input.signature, actor });

  // Vérification commande par commande.
  const problems: string[] = [];
  for (const it of pkg.items) {
    const c = input.checks?.[it.lensOrderId];
    if (c) {
      await db.trackPackageItem.updateMany({ where: { id: it.id }, data: { checks: c, checkedAt: when } });
      for (const [k, ok] of Object.entries(c)) {
        if (!ok && CHECK_TO_ANOMALY[k]) {
          await reportAnomaly(db, { type: CHECK_TO_ANOMALY[k]!, lensOrderId: it.lensOrderId, packageId: pkgId, comment: 'Contrôle à réception non validé' }, actor);
          problems.push(it.lensOrder.trackCode ?? '');
        }
      }
    }
  }
  const ids = pkg.items.map((i) => i.lensOrderId);
  const out = pkg.direction === 'OUTBOUND';
  if (out) {
    await setStage(db, ids, 'RECEIVED_BY_LAB', actor, { packageId: pkgId });
    await notify(db, {
      kind: 'OT_PACKAGE_RECEIVED',
      title: `📦 Colis ${pkg.number} réceptionné`,
      body: `Votre colis ${pkg.number} a été réceptionné par ${pkg.supplier?.name ?? 'votre laboratoire'}${problems.length ? ` — ${problems.length} contrôle(s) en anomalie` : ''}.`,
      link: `/optique/oculotrack?package=${pkgId}`,
    });
  } else if (actor.type === 'CARRIER') {
    await setStage(db, ids, 'ARRIVED_AT_STORE', actor, { packageId: pkgId });
    await notify(db, {
      kind: 'OT_ARRIVED',
      title: `📍 Colis ${pkg.number} arrivé`,
      body: `Votre colis ${pkg.number} est arrivé au magasin. Confirmez la réception.`,
      link: `/optique/oculotrack?package=${pkgId}`,
    });
  } else {
    await setStage(db, ids, 'ARRIVED_AT_STORE', actor, { packageId: pkgId });
    await setStage(db, ids, 'RECEIPT_CONFIRMED', actor, { packageId: pkgId });
  }
}

/** Le magasin confirme la réception d'un colis retour déjà déposé par le transporteur. */
export async function confirmStoreReceipt(db: TenantPrisma, pkgId: string, input: Proof & { checks?: Record<string, { received: boolean; reference: boolean; quantity: boolean; condition: boolean }> }, actor: Actor) {
  const pkg = await db.trackPackage.findFirst({ where: { id: pkgId }, include: { items: { select: { lensOrderId: true } } } });
  if (!pkg) throw notFound('Colis introuvable');
  if (pkg.direction !== 'RETURN') throw badRequest("Ce colis n'est pas un retour");
  if (pkg.status !== 'RECEIVED') return receivePackage(db, pkgId, input, actor);
  await addEvent(db, { packageId: pkgId, type: 'STORE_RECEIPT_CONFIRMED', stage: 'RECEIVED', actor, meta: proofMeta(actor, input, { checks: input.checks ?? {} }) });
  await setStage(db, pkg.items.map((i) => i.lensOrderId), 'RECEIPT_CONFIRMED', actor, { packageId: pkgId });
}

/** « Expédier vers le magasin » : colis retour créé par le laboratoire. */
export async function createReturn(
  db: TenantPrisma,
  tenantId: string,
  supplierId: string,
  input: { lensOrderIds: string[]; carrierName?: string | null; externalTracking?: string | null; shippedAt?: string | null; expectedAt?: string | null } & Proof,
  actor: Actor,
) {
  const ids = [...new Set(input.lensOrderIds)];
  const orders = await db.lensOrder.findMany({ where: { id: { in: ids }, supplierId, trackCode: { not: null } }, select: { id: true, trackCode: true, trackStage: true } });
  if (orders.length !== ids.length) throw notFound('Commande introuvable');
  const notReady = orders.find((o) => o.trackStage !== 'READY_FOR_RETURN');
  if (notReady) throw badRequest(`La commande ${notReady.trackCode} n'est pas « prête pour retour »`);
  const supplier = await db.supplier.findFirst({ where: { id: supplierId }, select: { city: true } });
  const number = await nextTrackNumber(db, tenantId, 'PKG');
  const pkg = await db.trackPackage.create({
    data: {
      number,
      token: newToken(),
      direction: 'RETURN',
      status: 'PREPARING',
      supplierId,
      fromCity: supplier?.city ?? null,
      carrierName: input.carrierName || null,
      externalTracking: input.externalTracking || null,
      expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
      note: input.note || null,
      createdByPortal: actor.id ?? null,
      items: { create: ids.map((lensOrderId) => ({ lensOrderId, tenantId })) },
    } as never,
  });
  await addEvent(db, { packageId: pkg.id, type: 'PACKAGE_CREATED', stage: 'PREPARING', actor, message: `Retour · ${ids.length} commande(s)`, meta: proofMeta(actor) });
  await handover(db, pkg.id, { ...input }, actor);
  return pkg;
}

/* ------------------------------ Anomalies ------------------------------- */

export async function reportAnomaly(
  db: TenantPrisma,
  input: { type: TrackAnomalyType; comment?: string | null; lensOrderId?: string | null; packageId?: string | null } & Proof,
  actor: Actor,
) {
  const a = await db.trackAnomaly.create({
    data: {
      type: input.type,
      comment: input.comment || null,
      lensOrderId: input.lensOrderId ?? null,
      packageId: input.packageId ?? null,
      reportedByType: actor.type,
      reportedByName: actor.name,
    } as never,
  });
  const ref = input.lensOrderId
    ? (await db.lensOrder.findFirst({ where: { id: input.lensOrderId }, select: { trackCode: true } }))?.trackCode
    : input.packageId
      ? (await db.trackPackage.findFirst({ where: { id: input.packageId }, select: { number: true } }))?.number
      : null;
  const ev = await addEvent(db, {
    lensOrderId: input.lensOrderId,
    packageId: input.packageId,
    type: 'ANOMALY_REPORTED',
    actor,
    message: input.comment || null,
    meta: proofMeta(actor, input, { anomalyId: a.id, anomalyType: input.type }),
    clientEventId: input.clientEventId,
    occurredAt: input.occurredAt,
  });
  if (input.photo) await addAttachment(db, { lensOrderId: input.lensOrderId, packageId: input.packageId, anomalyId: a.id, eventId: ev.id, kind: 'ANOMALY', data: input.photo, actor });
  await notify(db, {
    kind: 'OT_ANOMALY',
    title: `⚠️ Anomalie${ref ? ` — ${ref}` : ''}`,
    body: `${actor.name} signale une anomalie${input.comment ? ` : ${input.comment}` : '.'}`,
    link: input.lensOrderId ? `/optique/oculotrack?order=${input.lensOrderId}` : input.packageId ? `/optique/oculotrack?package=${input.packageId}` : '/optique/oculotrack',
  });
  return a;
}

export async function resolveAnomaly(db: TenantPrisma, id: string, resolution: string | null, actor: Actor) {
  const a = await db.trackAnomaly.findFirst({ where: { id } });
  if (!a) throw notFound('Anomalie introuvable');
  if (a.status === 'RESOLVED') return;
  await db.trackAnomaly.updateMany({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedByName: actor.name, resolution } });
  await addEvent(db, { lensOrderId: a.lensOrderId, packageId: a.packageId, type: 'ANOMALY_RESOLVED', actor, message: resolution, meta: { anomalyId: id } });
}

/* -------------------------- Notifications d'étape ------------------------- */

/** Messages envoyés au magasin quand le laboratoire fait avancer une commande. */
export async function notifyLabStage(db: TenantPrisma, orderIds: string[], stage: TrackStage) {
  const orders = await db.lensOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, trackCode: true } });
  for (const o of orders) {
    if (stage === 'MOUNTING') {
      await notify(db, { kind: 'OT_MOUNTING', title: `🔧 ${o.trackCode} en montage`, body: `La commande ${o.trackCode} est actuellement en montage.`, link: `/optique/oculotrack?order=${o.id}` });
    } else if (stage === 'READY_FOR_RETURN') {
      await notify(db, { kind: 'OT_READY', title: `✅ ${o.trackCode} terminée`, body: `La commande ${o.trackCode} est terminée et prête à être expédiée.`, link: `/optique/oculotrack?order=${o.id}` });
    }
  }
}

/* ------------------------------- Retards -------------------------------- */

/**
 * Détecte les colis en retard (date prévue dépassée sans réception) et
 * prévient le magasin UNE fois par colis. Appelée à chaque ouverture du
 * tableau de bord : aucune tâche planifiée n'est nécessaire.
 */
export async function detectLate(db: TenantPrisma) {
  const now = new Date();
  const late = await db.trackPackage.findMany({
    where: { status: { in: ['HANDED_TO_CARRIER', 'IN_TRANSIT'] }, expectedAt: { lt: now }, lateNotifiedAt: null },
    select: { id: true, number: true, expectedAt: true, direction: true },
  });
  for (const p of late) {
    await db.trackPackage.updateMany({ where: { id: p.id }, data: { lateNotifiedAt: now } });
    await addEvent(db, { packageId: p.id, type: 'LATE_DETECTED', actor: SYSTEM_ACTOR, message: `Réception attendue le ${p.expectedAt!.toISOString().slice(0, 10)}` });
    await notify(db, {
      kind: 'OT_LATE',
      title: `⚠️ Retard — ${p.number}`,
      body: `Le colis ${p.number} aurait dû être réceptionné le ${p.expectedAt!.toLocaleDateString('fr-FR')}.`,
      link: `/optique/oculotrack?package=${p.id}`,
    });
  }
}

/** Retard en jours (0 = à l'heure) d'une échéance non atteinte. */
export function lateDays(expectedAt: Date | null, doneAt: Date | null): number {
  if (!expectedAt || doneAt) return 0;
  const d = Math.floor((Date.now() - expectedAt.getTime()) / 86_400_000);
  return d > 0 ? d : 0;
}
