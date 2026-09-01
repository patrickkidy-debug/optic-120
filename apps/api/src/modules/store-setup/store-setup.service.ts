import { STORE_SETUP_STEPS, type StoreSetupStepKey } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/http-error.js';

type StepStatus = 'not_started' | 'in_progress' | 'completed';
type Overrides = Partial<Record<StoreSetupStepKey, 'completed' | 'skipped'>>;

export interface StoreSetupStepResult {
  key: StoreSetupStepKey;
  status: StepStatus;
  /** true si le statut vient d'une action manuelle (fait/ignoré), pas d'une détection automatique. */
  overridden: boolean;
}

export interface StoreSetupProgressResult {
  steps: StoreSetupStepResult[];
  currentStep: StoreSetupStepKey | 'final_check';
  completedCount: number;
  totalSteps: number;
  finishedAt: string | null;
  /** true si au moins une étape était déjà satisfaite avant toute interaction avec l'assistant. */
  isExistingTenant: boolean;
}

/** Permission requise pour marquer manuellement chaque étape (même permission que la vraie action). */
export const STORE_SETUP_STEP_PERMISSIONS: Record<StoreSetupStepKey, string> = {
  store_information: 'settings.branches.update',
  team: 'rbac.users.create',
  products: 'optique.products.create',
  inventory: 'optique.stock.adjust',
  cash_and_sales: 'optique.sales.create',
  lens_pricing: 'settings.branches.update',
  insurance: 'insurance.update',
  customers: 'optique.customers.create',
  documents: 'settings.branches.update',
};

/** Signaux bruts (issus des vraies données) nécessaires pour dériver le statut de chaque étape. */
interface RawSignals {
  name: string;
  location: string | null;
  contactPhone: string | null;
  lensPricing: unknown;
  invoiceSettings: unknown;
  userCount: number;
  productCount: number;
  stockItemCount: number;
  saleCount: number;
  insurerCount: number;
  customerCount: number;
}

/** Dérive le statut « détecté automatiquement » de chaque étape à partir des signaux bruts. Pure, réutilisée pour le calcul par tenant ET le résumé en masse (console fondateur). */
function deriveRawStatuses(s: RawSignals): Record<StoreSetupStepKey, StepStatus> {
  return {
    store_information: s.location && s.contactPhone ? 'completed' : s.name ? 'in_progress' : 'not_started',
    team: s.userCount > 1 ? 'completed' : 'not_started',
    products: s.productCount > 0 ? 'completed' : 'not_started',
    inventory: s.stockItemCount > 0 ? 'completed' : 'not_started',
    cash_and_sales: s.saleCount > 0 ? 'completed' : 'not_started',
    lens_pricing: s.lensPricing ? 'completed' : 'not_started',
    insurance: s.insurerCount > 0 ? 'completed' : 'not_started',
    customers: s.customerCount > 0 ? 'completed' : 'not_started',
    documents: s.invoiceSettings ? 'completed' : 'not_started',
  };
}

/** Applique les exceptions manuelles par-dessus les statuts détectés, dans l'ordre fixe des étapes. */
function applyOverrides(raw: Record<StoreSetupStepKey, StepStatus>, overrides: Overrides): StoreSetupStepResult[] {
  return STORE_SETUP_STEPS.map((key) => {
    const override = overrides[key];
    if (override) return { key, status: 'completed' as StepStatus, overridden: true };
    return { key, status: raw[key], overridden: false };
  });
}

async function computeStepStatuses(tenantId: string, overrides: Overrides): Promise<StoreSetupStepResult[]> {
  const [tenant, userCount, productCount, stockItemCount, saleCount, insurerCount, customerCount] =
    await Promise.all([
      prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true, location: true, contactPhone: true, lensPricing: true, invoiceSettings: true },
      }),
      prisma.user.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.stockItem.count({ where: { tenantId } }),
      prisma.sale.count({ where: { tenantId } }),
      prisma.insurer.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId } }),
    ]);

  const raw = deriveRawStatuses({
    name: tenant.name,
    location: tenant.location,
    contactPhone: tenant.contactPhone,
    lensPricing: tenant.lensPricing,
    invoiceSettings: tenant.invoiceSettings,
    userCount,
    productCount,
    stockItemCount,
    saleCount,
    insurerCount,
    customerCount,
  });

  return applyOverrides(raw, overrides);
}

/**
 * Calcule la progression à la volée depuis les vraies données (voir le
 * commentaire du modèle StoreSetupProgress). Crée la ligne au premier appel :
 * si tout est déjà complet à ce moment-là (boutique existante mature), on
 * l'enregistre directement comme terminée pour qu'elle ne voie jamais
 * l'assistant apparaître sur son Dashboard.
 */
export async function getProgress(tenantId: string): Promise<StoreSetupProgressResult> {
  let row = await prisma.storeSetupProgress.findUnique({ where: { tenantId } });
  const overrides = (row?.stepOverrides as Overrides | null) ?? {};
  const steps = await computeStepStatuses(tenantId, overrides);
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const allDone = completedCount === STORE_SETUP_STEPS.length;

  if (!row) {
    row = await prisma.storeSetupProgress.create({
      data: { tenantId, finishedAt: allDone ? new Date() : null },
    });
  }

  const firstIncomplete = steps.find((s) => s.status !== 'completed');
  const currentStep: StoreSetupStepKey | 'final_check' = firstIncomplete ? firstIncomplete.key : 'final_check';

  return {
    steps,
    currentStep,
    completedCount,
    totalSteps: STORE_SETUP_STEPS.length,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    isExistingTenant: completedCount > 0,
  };
}

export async function setStepOverride(
  tenantId: string,
  stepKey: StoreSetupStepKey,
  status: 'completed' | 'skipped' | 'reset',
): Promise<StoreSetupProgressResult> {
  const row = await prisma.storeSetupProgress.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
  const overrides = { ...((row.stepOverrides as Overrides | null) ?? {}) };
  if (status === 'reset') {
    delete overrides[stepKey];
  } else {
    overrides[stepKey] = status;
  }
  await prisma.storeSetupProgress.update({
    where: { tenantId },
    data: { stepOverrides: overrides as object },
  });
  return getProgress(tenantId);
}

export async function finishSetup(tenantId: string): Promise<StoreSetupProgressResult> {
  const progress = await getProgress(tenantId);
  if (progress.completedCount < progress.totalSteps) {
    throw badRequest('Toutes les étapes doivent être terminées ou ignorées avant de finaliser.');
  }
  await prisma.storeSetupProgress.upsert({
    where: { tenantId },
    create: { tenantId, finishedAt: new Date() },
    update: { finishedAt: new Date() },
  });
  return getProgress(tenantId);
}

export interface StoreSetupTenantSummary {
  tenantId: string;
  tenantName: string;
  completedCount: number;
  totalSteps: number;
  currentStep: StoreSetupStepKey | 'final_check';
  finishedAt: string | null;
  createdAt: string;
}

/**
 * Progression de TOUS les tenants (hors démo) en un minimum de requêtes
 * (comptages groupés, pas une boucle par tenant) — pour la console fondateur.
 * Lecture seule : ne crée jamais de ligne StoreSetupProgress (contrairement à
 * getProgress), une simple consultation admin ne doit pas avoir d'effet de bord.
 */
export async function getAllTenantsSummary(): Promise<StoreSetupTenantSummary[]> {
  const toCountMap = (rows: { tenantId: string; _count: number }[]) =>
    new Map(rows.map((r) => [r.tenantId, r._count]));

  const [tenants, progressRows, userRows, productRows, stockRows, saleRows, insurerRows, customerRows] =
    await Promise.all([
      prisma.tenant.findMany({
        where: { isDemo: false },
        select: {
          id: true,
          name: true,
          location: true,
          contactPhone: true,
          lensPricing: true,
          invoiceSettings: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.storeSetupProgress.findMany(),
      prisma.user.groupBy({ by: ['tenantId'], _count: true }),
      prisma.product.groupBy({ by: ['tenantId'], _count: true }),
      prisma.stockItem.groupBy({ by: ['tenantId'], _count: true }),
      prisma.sale.groupBy({ by: ['tenantId'], _count: true }),
      prisma.insurer.groupBy({ by: ['tenantId'], _count: true }),
      prisma.customer.groupBy({ by: ['tenantId'], _count: true }),
    ]);

  const progressByTenant = new Map(progressRows.map((r) => [r.tenantId, r]));
  const userMap = toCountMap(userRows);
  const productMap = toCountMap(productRows);
  const stockMap = toCountMap(stockRows);
  const saleMap = toCountMap(saleRows);
  const insurerMap = toCountMap(insurerRows);
  const customerMap = toCountMap(customerRows);

  return tenants.map((tenant) => {
    const progressRow = progressByTenant.get(tenant.id);
    const overrides = (progressRow?.stepOverrides as Overrides | null) ?? {};
    const raw = deriveRawStatuses({
      name: tenant.name,
      location: tenant.location,
      contactPhone: tenant.contactPhone,
      lensPricing: tenant.lensPricing,
      invoiceSettings: tenant.invoiceSettings,
      userCount: userMap.get(tenant.id) ?? 0,
      productCount: productMap.get(tenant.id) ?? 0,
      stockItemCount: stockMap.get(tenant.id) ?? 0,
      saleCount: saleMap.get(tenant.id) ?? 0,
      insurerCount: insurerMap.get(tenant.id) ?? 0,
      customerCount: customerMap.get(tenant.id) ?? 0,
    });
    const steps = applyOverrides(raw, overrides);
    const completedCount = steps.filter((s) => s.status === 'completed').length;
    const firstIncomplete = steps.find((s) => s.status !== 'completed');

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      completedCount,
      totalSteps: STORE_SETUP_STEPS.length,
      currentStep: firstIncomplete ? firstIncomplete.key : 'final_check',
      finishedAt: progressRow?.finishedAt ? progressRow.finishedAt.toISOString() : null,
      createdAt: tenant.createdAt.toISOString(),
    };
  });
}
