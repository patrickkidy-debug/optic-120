import { AnomalyCategory, AnomalyCorrectionType } from '@oculo/shared-types';

/**
 * Calcule les 4 impacts d'une anomalie (financier, stock, caisse, assurance).
 * Toujours l'écart avant/après RÉEL de l'entité cible — jamais la somme des
 * impacts par champ (qui compterait en double si prix ET remise changent
 * ensemble sur la même vente). Signe aligné sur StockMovement.quantity
 * (+ = gain). Une seule et même formule sert à l'aperçu (déclaration, à
 * partir des valeurs saisies) et au gel définitif (application, à partir de
 * l'avant/après réel) — voir `previewImpact`/`appliedImpact` plus bas.
 */
export interface AnomalyImpact {
  financialImpact: number;
  stockImpact: number;
  cashImpact: number;
  insuranceImpact: number;
}

const ZERO: AnomalyImpact = { financialImpact: 0, stockImpact: 0, cashImpact: 0, insuranceImpact: 0 };

export interface ImpactChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ImpactContext {
  /** Prix d'achat du produit concerné (catégorie STOCK). */
  buyPrice?: number;
  /** Valeur d'un point de fidélité (catégorie CLIENT). */
  loyaltyPointValue?: number;
  /** Vrai si le moyen de paiement corrigé est CASH (catégorie PAIEMENT). */
  isCashPayment?: boolean;
}

function num(v: string | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function delta(changes: ImpactChange[], field: string): number {
  const c = changes.find((x) => x.fieldName === field);
  return c ? num(c.newValue) - num(c.oldValue) : 0;
}

/**
 * Aperçu calculé à la déclaration, depuis les valeurs saisies par le
 * déclarant (avant toute application réelle).
 */
export function previewImpact(
  category: AnomalyCategory,
  correctionType: AnomalyCorrectionType,
  changes: ImpactChange[],
  ctx: ImpactContext = {},
): AnomalyImpact {
  switch (correctionType) {
    case AnomalyCorrectionType.STOCK_ADJUSTMENT: {
      const stockImpact = delta(changes, 'quantity');
      return { ...ZERO, stockImpact, financialImpact: stockImpact * (ctx.buyPrice ?? 0) };
    }
    case AnomalyCorrectionType.SALE_CANCELLATION:
    case AnomalyCorrectionType.PRODUCT_RETURN:
      // L'impact réel dépend de l'état de la vente au moment de l'application
      // (stock déjà mouvementé ou non, part réellement encaissée) : non
      // calculable de façon fiable en aperçu, seulement au moment d'agir.
      return ZERO;
    case AnomalyCorrectionType.PAYMENT_REVERSAL: {
      const amountDelta = delta(changes, 'amount');
      return {
        ...ZERO,
        financialImpact: amountDelta,
        cashImpact: ctx.isCashPayment ? amountDelta : 0,
      };
    }
    case AnomalyCorrectionType.REFUND_CORRECTION: {
      const amountDelta = delta(changes, 'receivedAmount') + delta(changes, 'acceptedAmount') + delta(changes, 'requestedAmount');
      return { ...ZERO, insuranceImpact: amountDelta, financialImpact: amountDelta };
    }
    case AnomalyCorrectionType.FIELD_CORRECTION: {
      switch (category) {
        case AnomalyCategory.VENTE:
        case AnomalyCategory.DEVIS:
          return { ...ZERO, financialImpact: delta(changes, 'discountAmount') * -1 };
        case AnomalyCategory.PRODUIT:
          return { ...ZERO, financialImpact: delta(changes, 'sellPrice') };
        case AnomalyCategory.CAISSE: {
          const cashImpact = delta(changes, 'openingAmount') + delta(changes, 'closingAmount');
          return { ...ZERO, cashImpact, financialImpact: cashImpact };
        }
        case AnomalyCategory.COMMANDE_VERRES:
        case AnomalyCategory.SAV:
          return { ...ZERO, financialImpact: delta(changes, 'cost') };
        case AnomalyCategory.CLIENT:
          return { ...ZERO, financialImpact: delta(changes, 'loyaltyPoints') * (ctx.loyaltyPointValue ?? 0) };
        case AnomalyCategory.ASSURANCE: {
          // Ce que l'assureur doit réellement : le montant accepté une fois
          // arbitré, sinon le montant demandé — jamais la somme des deux
          // (qui compterait en double une correction qui arbitre ET corrige
          // le montant demandé en même temps). Même règle que
          // claimExpectedAmount dans le module Assurances.
          const touchesAccepted = changes.some((c) => c.fieldName === 'acceptedAmount');
          const amountDelta = touchesAccepted ? delta(changes, 'acceptedAmount') : delta(changes, 'requestedAmount');
          return { ...ZERO, insuranceImpact: amountDelta, financialImpact: amountDelta };
        }
        default:
          return ZERO;
      }
    }
    default:
      return ZERO;
  }
}

/**
 * Impact figé à l'application, depuis l'état AVANT/APRÈS réellement lu en
 * base — jamais retouché ensuite. Les avant/après sont fournis déjà résolus
 * par le handler de la catégorie (montants numériques, quantités...).
 */
export function appliedImpact(
  category: AnomalyCategory,
  correctionType: AnomalyCorrectionType,
  before: Record<string, number>,
  after: Record<string, number>,
  ctx: ImpactContext = {},
): AnomalyImpact {
  const changes: ImpactChange[] = Object.keys({ ...before, ...after }).map((fieldName) => ({
    fieldName,
    oldValue: before[fieldName] != null ? String(before[fieldName]) : null,
    newValue: after[fieldName] != null ? String(after[fieldName]) : null,
  }));
  if (correctionType === AnomalyCorrectionType.SALE_CANCELLATION) {
    return {
      ...ZERO,
      financialImpact: -(before.totalAmount ?? 0),
      stockImpact: before.restockedQuantity ?? 0,
      cashImpact: -(before.cashPaidAmount ?? 0),
    };
  }
  if (correctionType === AnomalyCorrectionType.PRODUCT_RETURN) {
    return {
      ...ZERO,
      financialImpact: -(before.totalAmount ?? 0),
      stockImpact: before.restockedQuantity ?? 0,
      cashImpact: -(before.cashRefundAmount ?? 0),
    };
  }
  return previewImpact(category, correctionType, changes, ctx);
}
