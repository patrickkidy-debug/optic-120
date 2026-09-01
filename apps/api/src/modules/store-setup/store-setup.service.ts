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

/** Sous-ensemble utile de Tenant.paymentConfig (voir payment.service.ts). */
interface StoredPaymentConfigSlice {
  provider?: string;
  collectNumber?: string;
}

/** Permission requise pour marquer manuellement chaque étape (même permission que la vraie action). */
export const STORE_SETUP_STEP_PERMISSIONS: Record<StoreSetupStepKey, string> = {
  store_information: 'settings.branches.update',
  team: 'rbac.users.create',
  products: 'optique.products.create',
  inventory: 'optique.stock.adjust',
  payments: 'settings.payments.update',
  customers: 'optique.customers.create',
  documents: 'settings.branches.update',
};

async function computeStepStatuses(tenantId: string, overrides: Overrides): Promise<StoreSetupStepResult[]> {
  const [tenant, userCount, productCount, stockItemCount, customerCount] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, location: true, contactPhone: true, paymentConfig: true, invoiceSettings: true },
    }),
    prisma.user.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.stockItem.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
  ]);

  const paymentConfig = (tenant.paymentConfig as StoredPaymentConfigSlice | null) ?? null;
  const hasPaymentSetup = Boolean(paymentConfig?.collectNumber || paymentConfig?.provider);

  const raw: Record<StoreSetupStepKey, StepStatus> = {
    store_information:
      tenant.location && tenant.contactPhone ? 'completed' : tenant.name ? 'in_progress' : 'not_started',
    team: userCount > 1 ? 'completed' : 'not_started',
    products: productCount > 0 ? 'completed' : 'not_started',
    inventory: stockItemCount > 0 ? 'completed' : 'not_started',
    payments: hasPaymentSetup ? 'completed' : 'not_started',
    customers: customerCount > 0 ? 'completed' : 'not_started',
    documents: tenant.invoiceSettings ? 'completed' : 'not_started',
  };

  return STORE_SETUP_STEPS.map((key) => {
    const override = overrides[key];
    if (override) return { key, status: 'completed' as StepStatus, overridden: true };
    return { key, status: raw[key], overridden: false };
  });
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
