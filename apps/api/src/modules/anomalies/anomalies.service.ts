import {
  AnomalyCategory,
  AnomalyCorrectionType,
  AnomalyStatus,
  AnomalyTargetEntity,
  ANOMALY_CORRECTION_TYPES_BY_CATEGORY,
  ANOMALY_REASON_LABELS,
  type AnomalyDeclareInput,
  type AnomalyModifyInput,
  type AnomalyListFilter,
} from '@oculo/shared-types';
import { forTenant, type TenantPrisma } from '../../lib/prisma-tenant.js';
import { badRequest, notFound, conflict } from '../../lib/http-error.js';
import { getOpticalSettings } from '../../lib/optical-settings.js';
import { previewImpact, appliedImpact, type ImpactContext } from './anomalies.impact.js';
import { resolveCurrentValue } from './anomalies.resolve.js';
import {
  handleSaleFieldCorrection,
  handleStockAdjustment,
  handleSaleCancellation,
  handleProductReturn,
  handlePaymentCorrection,
  handleInsuranceCorrection,
  handleDirectFieldCorrection,
} from './anomalies.handlers.js';

const n = (v: unknown): number => Number(v ?? 0);

/** Une seule anomalie ouverte par cible : évite deux corrections concurrentes. */
async function assertNoOpenAnomaly(db: TenantPrisma, targetEntity: AnomalyTargetEntity, targetId: string): Promise<void> {
  const existing = await db.anomaly.findFirst({
    where: { targetEntity, targetId, status: { in: ['DECLARED', 'PENDING_VALIDATION', 'APPROVED'] as never } },
  });
  if (existing) {
    throw conflict(`Une anomalie (${existing.number}) est déjà ouverte sur cet élément.`);
  }
}

/** Catégorie -> entité cible par défaut (ASSURANCE dépend des champs, voir resolveTarget). */
const TARGET_BY_CATEGORY: Record<AnomalyCategory, AnomalyTargetEntity> = {
  VENTE: AnomalyTargetEntity.SALE,
  DEVIS: AnomalyTargetEntity.SALE,
  PRODUIT: AnomalyTargetEntity.PRODUCT,
  STOCK: AnomalyTargetEntity.STOCK_ITEM,
  CAISSE: AnomalyTargetEntity.CASH_REGISTER,
  PAIEMENT: AnomalyTargetEntity.PAYMENT,
  COMMANDE_VERRES: AnomalyTargetEntity.LENS_ORDER,
  CLIENT: AnomalyTargetEntity.CUSTOMER,
  SAV: AnomalyTargetEntity.REPAIR,
  ASSURANCE: AnomalyTargetEntity.INSURANCE_CLAIM,
};

function resolveCorrectionType(
  category: AnomalyCategory,
  requested: AnomalyCorrectionType | undefined,
  hasRefundField: boolean,
): AnomalyCorrectionType {
  const allowed = ANOMALY_CORRECTION_TYPES_BY_CATEGORY[category];
  if (requested) {
    if (!allowed.includes(requested)) {
      throw badRequest(`Type de correction invalide pour la catégorie ${category}`);
    }
    return requested;
  }
  // ASSURANCE a deux types possibles (dossier ou remboursement) : le champ
  // 'receivedAmount' (propre au remboursement) tranche par défaut, sans
  // obliger le déclarant à préciser correctionType.
  if (category === AnomalyCategory.ASSURANCE && hasRefundField) return AnomalyCorrectionType.REFUND_CORRECTION;
  return allowed[0];
}

function resolveTargetEntity(category: AnomalyCategory, hasReceivedAmountField: boolean): AnomalyTargetEntity {
  if (category === AnomalyCategory.ASSURANCE && hasReceivedAmountField) {
    return AnomalyTargetEntity.INSURANCE_REFUND;
  }
  return TARGET_BY_CATEGORY[category];
}

/** Succursale dérivée automatiquement selon la cible, pour le filtrage. */
async function resolveBranchId(
  db: TenantPrisma,
  targetEntity: AnomalyTargetEntity,
  targetId: string,
  provided?: string,
): Promise<string | null> {
  if (provided) return provided;
  switch (targetEntity) {
    case AnomalyTargetEntity.SALE: {
      const row = await db.sale.findFirst({ where: { id: targetId }, select: { branchId: true } });
      return row?.branchId ?? null;
    }
    case AnomalyTargetEntity.STOCK_ITEM: {
      const row = await db.stockItem.findFirst({ where: { id: targetId }, select: { branchId: true } });
      return row?.branchId ?? null;
    }
    case AnomalyTargetEntity.CASH_REGISTER: {
      const row = await db.cashRegister.findFirst({ where: { id: targetId }, select: { branchId: true } });
      return row?.branchId ?? null;
    }
    case AnomalyTargetEntity.PAYMENT: {
      const row = await db.payment.findFirst({ where: { id: targetId }, select: { sale: { select: { branchId: true } } } });
      return row?.sale.branchId ?? null;
    }
    default:
      return null;
  }
}

async function nextAnomalyNumber(db: TenantPrisma, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.anomaly.count({ where: { tenantId, number: { startsWith: `ANO-${year}-` } } });
  return `ANO-${year}-${String(count + 1).padStart(6, '0')}`;
}

const anomalyInclude = {
  declaredBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  rejectedBy: { select: { id: true, firstName: true, lastName: true } },
  appliedBy: { select: { id: true, firstName: true, lastName: true } },
  cancelledBy: { select: { id: true, firstName: true, lastName: true } },
  entries: { orderBy: { createdAt: 'asc' as const } },
} as const;

/**
 * Déclare une anomalie : résout la cible réelle, calcule un aperçu d'impact,
 * et crée les lignes de correction (immuables dès cet instant — voir
 * AnomalyCorrectionEntry). Refuse une seconde anomalie ouverte sur la même
 * cible.
 */
export async function declareAnomaly(tenantId: string, userId: string, input: AnomalyDeclareInput) {
  const hasRefundField = input.changes.some((c) => c.fieldName === 'receivedAmount');
  const correctionType = resolveCorrectionType(input.category, input.correctionType, hasRefundField);
  const targetEntity = resolveTargetEntity(input.category, hasRefundField);

  const needsChanges = correctionType !== AnomalyCorrectionType.SALE_CANCELLATION && correctionType !== AnomalyCorrectionType.PRODUCT_RETURN;
  if (needsChanges && input.changes.length === 0) {
    throw badRequest('Au moins une valeur actuelle/souhaitée est requise');
  }

  return withTenant(tenantId, async (db) => {
    await assertNoOpenAnomaly(db, targetEntity, input.targetId);
    const branchId = await resolveBranchId(db, targetEntity, input.targetId, input.branchId || undefined);

    const ctx = await buildImpactContext(db, tenantId, input.category, targetEntity, input.targetId);
    const impact = previewImpact(input.category, correctionType, input.changes.map((c) => ({
      fieldName: c.fieldName,
      oldValue: c.oldValue || null,
      newValue: c.newValue || null,
    })), ctx);

    const anomaly = await db.anomaly.create({
      data: {
        tenantId,
        number: await nextAnomalyNumber(db, tenantId),
        category: input.category,
        correctionType,
        targetEntity,
        targetId: input.targetId,
        targetReference: input.targetReference,
        branchId,
        description: input.description,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote || null,
        comment: input.comment || null,
        status: AnomalyStatus.DECLARED,
        financialImpact: impact.financialImpact,
        stockImpact: impact.stockImpact,
        cashImpact: impact.cashImpact,
        insuranceImpact: impact.insuranceImpact,
        declaredById: userId,
        entries: {
          create: input.changes.map((c) => ({
            tenantId,
            fieldName: c.fieldName,
            oldValue: c.oldValue || null,
            newValue: c.newValue || null,
            createdById: userId,
          })),
        },
      },
      include: anomalyInclude,
    });
    return anomaly;
  });
}

/** Contexte nécessaire au calcul d'impact (taux/prix externes à l'anomalie elle-même). */
async function buildImpactContext(
  db: TenantPrisma,
  tenantId: string,
  category: AnomalyCategory,
  targetEntity: AnomalyTargetEntity,
  targetId: string,
): Promise<ImpactContext> {
  if (category === AnomalyCategory.STOCK) {
    const item = await db.stockItem.findFirst({ where: { id: targetId }, include: { product: { select: { buyPrice: true } } } });
    return { buyPrice: item ? n(item.product.buyPrice) : 0 };
  }
  if (category === AnomalyCategory.CLIENT) {
    const settings = await getOpticalSettings(tenantId);
    return { loyaltyPointValue: settings.loyaltyPointValue };
  }
  if (category === AnomalyCategory.PAIEMENT) {
    const payment = await db.payment.findFirst({ where: { id: targetId }, select: { method: true } });
    return { isCashPayment: payment?.method === 'CASH' };
  }
  return {};
}

/** Modifie les métadonnées d'une anomalie encore à l'état de brouillon. */
export async function updateDeclaredAnomaly(tenantId: string, id: string, input: AnomalyModifyInput) {
  const current = await requireAnomaly(tenantId, id);
  if (current.status !== AnomalyStatus.DECLARED) {
    throw conflict('Seule une anomalie déclarée (brouillon) peut être modifiée');
  }
  const data: Record<string, unknown> = {};
  if (input.description !== undefined) data.description = input.description;
  if (input.reasonCode !== undefined) data.reasonCode = input.reasonCode;
  if (input.reasonNote !== undefined) data.reasonNote = input.reasonNote || null;
  if (input.comment !== undefined) data.comment = input.comment || null;
  return withTenant(tenantId, async (db) => {
    await db.anomaly.updateMany({ where: { id }, data });
    return db.anomaly.findFirst({ where: { id }, include: anomalyInclude });
  });
}

export async function submitAnomaly(tenantId: string, id: string) {
  const current = await requireAnomaly(tenantId, id);
  if (current.status !== AnomalyStatus.DECLARED) {
    throw conflict("Cette anomalie n'est plus à l'état de brouillon");
  }
  return withTenant(tenantId, async (db) => {
    await db.anomaly.updateMany({
      where: { id },
      data: { status: AnomalyStatus.PENDING_VALIDATION, submittedAt: new Date() },
    });
    return db.anomaly.findFirst({ where: { id }, include: anomalyInclude });
  });
}

export async function approveAnomaly(tenantId: string, userId: string, id: string, approvalNote?: string) {
  const current = await requireAnomaly(tenantId, id);
  if (current.status !== AnomalyStatus.PENDING_VALIDATION) {
    throw conflict("Cette anomalie n'est pas en attente de validation");
  }
  return withTenant(tenantId, async (db) => {
    await db.anomaly.updateMany({
      where: { id },
      data: { status: AnomalyStatus.APPROVED, approvedById: userId, approvedAt: new Date(), approvalNote: approvalNote || null },
    });
    return db.anomaly.findFirst({ where: { id }, include: anomalyInclude });
  });
}

/** Rejette : ne touche JAMAIS la donnée d'origine (aucun appel de correction n'a lieu avant APPROVED). */
export async function rejectAnomaly(tenantId: string, userId: string, id: string, rejectionReason: string) {
  const current = await requireAnomaly(tenantId, id);
  if (current.status !== AnomalyStatus.PENDING_VALIDATION) {
    throw conflict("Cette anomalie n'est pas en attente de validation");
  }
  return withTenant(tenantId, async (db) => {
    await db.anomaly.updateMany({
      where: { id },
      data: { status: AnomalyStatus.REJECTED, rejectedById: userId, rejectedAt: new Date(), rejectionReason },
    });
    return db.anomaly.findFirst({ where: { id }, include: anomalyInclude });
  });
}

export async function cancelAnomaly(tenantId: string, userId: string, id: string, cancellationReason: string) {
  const current = await requireAnomaly(tenantId, id);
  if (![AnomalyStatus.DECLARED, AnomalyStatus.PENDING_VALIDATION].includes(current.status as never)) {
    throw conflict('Seule une anomalie non encore approuvée peut être annulée');
  }
  return withTenant(tenantId, async (db) => {
    await db.anomaly.updateMany({
      where: { id },
      data: { status: AnomalyStatus.CANCELLED, cancelledById: userId, cancelledAt: new Date(), cancellationReason },
    });
    return db.anomaly.findFirst({ where: { id }, include: anomalyInclude });
  });
}

/**
 * Applique la correction : garde-fou anti-dérive (voir resolveCurrentValue),
 * dispatch vers le handler de la catégorie/du type, puis fige l'impact réel
 * et journalise. La donnée d'origine n'est jamais touchée avant ce point.
 */
export async function applyCorrection(tenantId: string, userId: string, id: string) {
  const current = await requireAnomaly(tenantId, id);
  if (current.status !== AnomalyStatus.APPROVED) {
    throw conflict('Seule une anomalie approuvée peut être appliquée');
  }

  return withTenant(tenantId, async (db) => {
    // Garde-fou anti-dérive (sauf SALE, voir resolveCurrentValue).
    for (const entry of current.entries) {
      const actual = await resolveCurrentValue(db, current.targetEntity as never, current.targetId, entry.fieldName);
      if (actual !== null && entry.oldValue !== null && actual !== entry.oldValue) {
        throw conflict(
          `La valeur de « ${entry.fieldName} » a changé depuis la déclaration ` +
            `(actuel : ${actual}, attendu : ${entry.oldValue}) — annulez et redéclarez cette anomalie.`,
        );
      }
    }

    const reasonLabel = ANOMALY_REASON_LABELS[current.reasonCode as never];
    let result: { before: Record<string, number>; after: Record<string, number> };

    switch (current.correctionType) {
      case AnomalyCorrectionType.STOCK_ADJUSTMENT:
        result = await handleStockAdjustment(tenantId, userId, current.targetId, current.entries, current.number, reasonLabel);
        break;
      case AnomalyCorrectionType.SALE_CANCELLATION:
        result = await handleSaleCancellation(tenantId, userId, current.targetId);
        break;
      case AnomalyCorrectionType.PRODUCT_RETURN:
        result = await handleProductReturn(tenantId, userId, current.targetId, current.entries);
        break;
      case AnomalyCorrectionType.PAYMENT_REVERSAL:
        result = await handlePaymentCorrection(tenantId, userId, current.targetId, current.entries);
        break;
      case AnomalyCorrectionType.REFUND_CORRECTION:
        result = await handleInsuranceCorrection(db, userId, current.targetEntity as never, current.targetId, current.entries);
        break;
      case AnomalyCorrectionType.FIELD_CORRECTION:
        if (current.targetEntity === AnomalyTargetEntity.SALE) {
          result = await handleSaleFieldCorrection(tenantId, userId, current.targetId, current.entries, reasonLabel);
        } else if (current.targetEntity === AnomalyTargetEntity.INSURANCE_CLAIM) {
          result = await handleInsuranceCorrection(db, userId, current.targetEntity as never, current.targetId, current.entries);
        } else {
          result = await handleDirectFieldCorrection(db, current.targetEntity as never, current.targetId, current.entries);
        }
        break;
      default:
        throw badRequest('Type de correction non pris en charge');
    }

    const ctx = await buildImpactContext(db, tenantId, current.category as never, current.targetEntity as never, current.targetId);
    const impact = appliedImpact(current.category as never, current.correctionType as never, result.before, result.after, ctx);

    await db.anomaly.updateMany({
      where: { id },
      data: {
        status: AnomalyStatus.CORRECTED,
        appliedById: userId,
        appliedAt: new Date(),
        financialImpact: impact.financialImpact,
        stockImpact: impact.stockImpact,
        cashImpact: impact.cashImpact,
        insuranceImpact: impact.insuranceImpact,
      },
    });
    return db.anomaly.findFirst({ where: { id }, include: anomalyInclude });
  });
}

export async function getAnomaly(tenantId: string, id: string) {
  return requireAnomaly(tenantId, id);
}

export async function listAnomalies(tenantId: string, filter: AnomalyListFilter) {
  return withTenant(tenantId, async (db) => {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = 50;
    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;
    const where: Record<string, unknown> = {
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.declaredById ? { declaredById: filter.declaredById } : {}),
      ...(from || to ? { declaredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(filter.hasFinancialImpact ? { financialImpact: { not: 0 } } : {}),
      ...(filter.hasStockImpact ? { stockImpact: { not: 0 } } : {}),
    };
    const [items, total] = await Promise.all([
      db.anomaly.findMany({
        where,
        include: anomalyInclude,
        orderBy: { declaredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.anomaly.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });
}

export async function getAnomalyDashboard(tenantId: string, filter: AnomalyListFilter) {
  return withTenant(tenantId, async (db) => {
    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;
    const where: Record<string, unknown> = {
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.declaredById ? { declaredById: filter.declaredById } : {}),
      ...(from || to ? { declaredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };
    const rows = await db.anomaly.findMany({
      where,
      select: { status: true, financialImpact: true, stockImpact: true, cashImpact: true, insuranceImpact: true },
    });
    const counts = { open: 0, pendingValidation: 0, approved: 0, corrected: 0, rejected: 0, cancelled: 0 };
    let financialImpact = 0;
    let stockImpact = 0;
    for (const r of rows) {
      if (r.status === AnomalyStatus.DECLARED || r.status === AnomalyStatus.PENDING_VALIDATION || r.status === AnomalyStatus.APPROVED) counts.open += 1;
      if (r.status === AnomalyStatus.PENDING_VALIDATION) counts.pendingValidation += 1;
      if (r.status === AnomalyStatus.APPROVED) counts.approved += 1;
      if (r.status === AnomalyStatus.CORRECTED) counts.corrected += 1;
      if (r.status === AnomalyStatus.REJECTED) counts.rejected += 1;
      if (r.status === AnomalyStatus.CANCELLED) counts.cancelled += 1;
      financialImpact += n(r.financialImpact);
      stockImpact += r.stockImpact;
    }
    return { counts, financialImpact, stockImpact };
  });
}

async function requireAnomaly(tenantId: string, id: string) {
  return withTenant(tenantId, async (db) => {
    const anomaly = await db.anomaly.findFirst({ where: { id }, include: anomalyInclude });
    if (!anomaly) throw notFound('Anomalie introuvable');
    return anomaly;
  });
}

/**
 * Exécute une callback avec un client tenant-scopé. Ce module n'a pas
 * toujours la requête Fastify sous la main (`req.db!`) — les handlers de
 * catégorie l'appellent aussi hors contexte HTTP — donc on reconstruit le
 * même client via `forTenant`, la même barrière d'isolation que partout
 * ailleurs dans l'application.
 */
async function withTenant<T>(tenantId: string, fn: (db: TenantPrisma) => Promise<T>): Promise<T> {
  return fn(forTenant(tenantId));
}
