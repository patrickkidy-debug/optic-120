import {
  AnomalyStatus,
  ANOMALY_STATUS_LABELS,
  ANOMALY_CATEGORY_LABELS,
  ANOMALY_REASON_LABELS,
  ANOMALY_FIELDS_BY_CATEGORY,
  ANOMALY_CORRECTION_TYPES_BY_CATEGORY,
  type AnomalyCategory,
  type AnomalyCorrectionType,
} from '@oculo/shared-types';
import { Badge } from '../../components/ui';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const STATUS_TONE: Record<AnomalyStatus, Tone> = {
  DECLARED: 'neutral',
  PENDING_VALIDATION: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  CORRECTED: 'success',
  CANCELLED: 'neutral',
};

export function AnomalyStatusBadge({ status }: { status: AnomalyStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{ANOMALY_STATUS_LABELS[status] ?? status}</Badge>;
}

export function AnomalyCategoryBadge({ category }: { category: AnomalyCategory }) {
  return <Badge tone="info">{ANOMALY_CATEGORY_LABELS[category] ?? category}</Badge>;
}

export const CORRECTION_TYPE_LABELS: Record<AnomalyCorrectionType, string> = {
  FIELD_CORRECTION: 'Correction de champ',
  STOCK_ADJUSTMENT: 'Ajustement de stock',
  SALE_CANCELLATION: 'Annulation de vente',
  PRODUCT_RETURN: 'Retour produit',
  PAYMENT_REVERSAL: 'Correction de paiement',
  REFUND_CORRECTION: 'Correction de remboursement',
};

export { ANOMALY_STATUS_LABELS, ANOMALY_CATEGORY_LABELS, ANOMALY_REASON_LABELS, ANOMALY_FIELDS_BY_CATEGORY, ANOMALY_CORRECTION_TYPES_BY_CATEGORY };

/** Vrai si un des impacts de l'anomalie touche l'argent (à afficher clairement avant approbation/application). */
export function hasFinancialStake(a: { financialImpact: string | number; cashImpact: string | number; insuranceImpact: string | number }): boolean {
  return Number(a.financialImpact) !== 0 || Number(a.cashImpact) !== 0 || Number(a.insuranceImpact) !== 0;
}

/** Onglets du module, à l'intérieur d'une seule entrée de menu — même motif que le module Assurances. */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === t.value ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
