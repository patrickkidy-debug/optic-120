import { ProductCategory, type Prisma } from '@prisma/client';
import { WARRANTY_PLAN } from '@oculo/shared-types';

type Tx = Prisma.TransactionClient;

/**
 * Formule de garantie verres/monture : en avant-première, réservée à ces
 * comptes (même liste que côté web, lib/beta.ts → useWarrantyPlan).
 */
const WARRANTY_PLAN_EMAILS = new Set(['patrickkidy@gmail.com']);

export async function canUseWarrantyPlan(tx: Tx, userId: string): Promise<boolean> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
  return WARRANTY_PLAN_EMAILS.has((user?.email ?? '').toLowerCase());
}

/** Lignes de supplément : fiches SERVICE masquées du catalogue (isActive false). */
export function isWarrantyPlanSku(sku: string): boolean {
  return sku === WARRANTY_PLAN.lensSku || sku === WARRANTY_PLAN.frameSku;
}

/** Fiche produit du supplément, créée à la première utilisation. */
export async function warrantyPlanProduct(tx: Tx, tenantId: string, kind: 'lens' | 'frame') {
  const sku = kind === 'lens' ? WARRANTY_PLAN.lensSku : WARRANTY_PLAN.frameSku;
  const name = kind === 'lens' ? 'Garantie verres 1 an (+15 %)' : 'Protection monture 6 mois (+10 %)';
  return tx.product.upsert({
    where: { tenantId_sku: { tenantId, sku } },
    update: {},
    create: { tenantId, sku, name, category: ProductCategory.SERVICE, buyPrice: 0, sellPrice: 0, isActive: false, trackStock: false },
  });
}
