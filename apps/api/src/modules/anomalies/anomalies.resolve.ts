import { AnomalyTargetEntity } from '@oculo/shared-types';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';

/**
 * Lit la valeur actuelle d'un champ sur la cible réelle — sert au garde-fou
 * anti-dérive avant d'appliquer : si la donnée a changé depuis la
 * déclaration, l'application est refusée plutôt que d'écraser une valeur
 * inattendue (voir anomalies.service.ts `applyCorrection`).
 *
 * VENTE/DEVIS (targetEntity SALE) ne passent pas par ce garde-fou : la mise à
 * jour se fait via `updateSale()`, qui n'écrit que les champs explicitement
 * fournis (jamais un remplacement complet) — un changement concurrent sur un
 * AUTRE champ de la même vente n'est donc jamais écrasé.
 */
export async function resolveCurrentValue(
  db: TenantPrisma,
  targetEntity: AnomalyTargetEntity,
  targetId: string,
  fieldName: string,
): Promise<string | null> {
  const val = (v: unknown): string | null => {
    if (v == null) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object' && 'toNumber' in (v as object)) {
      return String((v as { toNumber: () => number }).toNumber());
    }
    return String(v);
  };

  switch (targetEntity) {
    case AnomalyTargetEntity.STOCK_ITEM: {
      const row = await db.stockItem.findFirst({ where: { id: targetId }, select: { quantity: true } });
      return row ? val(row.quantity) : null;
    }
    case AnomalyTargetEntity.PRODUCT: {
      const row = await db.product.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.CUSTOMER: {
      const row = await db.customer.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.LENS_ORDER: {
      const row = await db.lensOrder.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.REPAIR: {
      const row = await db.repair.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.CASH_REGISTER: {
      const row = await db.cashRegister.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.PAYMENT: {
      const row = await db.payment.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.INSURANCE_CLAIM: {
      const row = await db.insuranceClaim.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.INSURANCE_REFUND: {
      const row = await db.insuranceRefund.findFirst({ where: { id: targetId } });
      return row ? val((row as Record<string, unknown>)[fieldName]) : null;
    }
    case AnomalyTargetEntity.SALE:
    default:
      return null; // pas de garde-fou pour les ventes/devis — voir doc ci-dessus.
  }
}
