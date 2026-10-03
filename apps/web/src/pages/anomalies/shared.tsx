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
import { tr } from '../../lib/tr';

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
  get FIELD_CORRECTION() { return tr('ui.shared.correctionDeChamp'); },
  get STOCK_ADJUSTMENT() { return tr('ui.shared.ajustementDeStock'); },
  get SALE_CANCELLATION() { return tr('ui.shared.annulationDeVente'); },
  get PRODUCT_RETURN() { return tr('ui.shared.retourProduit'); },
  get PAYMENT_REVERSAL() { return tr('ui.shared.correctionDePaiement'); },
  get REFUND_CORRECTION() { return tr('ui.shared.correctionDeRemboursement'); },
};

export const ANOMALY_ACTION_LABELS: Record<string, string> = {
  get ANOMALY_DECLARED() { return tr('ui.shared.declaration'); },
  get ANOMALY_MODIFIED() { return tr('ui.shared.modification'); },
  get ANOMALY_SUBMITTED() { return tr('ui.shared.soumissionPourValidation'); },
  get ANOMALY_APPROVED() { return tr('ui.shared.approbation'); },
  get ANOMALY_REJECTED() { return tr('ui.shared.rejet'); },
  get ANOMALY_CORRECTION_APPLIED() { return tr('ui.shared.correctionAppliquee'); },
  get ANOMALY_CANCELLED() { return tr('ui.shared.annulation'); },
};

export const ANOMALY_FIELD_LABEL_MAP: Record<string, string> = {
  get items() { return tr('ui.shared.articlesProduitQuantitePrix'); },
  get discountAmount() { return tr('ui.shared.remise'); },
  get insuranceAmount() { return tr('ui.shared.priseEnChargeAssurance'); },
  get insurerId() { return tr('ui.shared.assureur'); },
  customerId: 'Client',
  get vatRate() { return tr('ui.shared.tauxDeTva'); },
  get createdAt() { return tr('ui.shared.dateDeLaVente'); },
  get cashierId() { return tr('ui.shared.vendeur'); },
  sku: 'Référence / SKU',
  category: 'Catégorie',
  get brand() { return tr('ui.shared.marque'); },
  name: 'Nom / Modèle',
  get buyPrice() { return tr('ui.shared.prixDAchat'); },
  get sellPrice() { return tr('ui.shared.prixDeVente'); },
  get quantity() { return tr('ui.shared.quantite'); },
  get openingAmount() { return tr('ui.shared.fondDeCaisse'); },
  get closingAmount() { return tr('ui.shared.montantDeCloture'); },
  method: 'Moyen de paiement',
  get amount() { return tr('ui.shared.montant'); },
  get supplierName() { return tr('ui.shared.fournisseur'); },
  description: 'Description',
  get cost() { return tr('ui.shared.cout'); },
  notes: 'Notes',
  get firstName() { return tr('ui.shared.prenom'); },
  get lastName() { return tr('ui.shared.nom'); },
  get phone() { return tr('ui.shared.telephone'); },
  email: 'Email',
  get loyaltyPoints() { return tr('ui.shared.pointsDeFidelite'); },
  get requestedAmount() { return tr('ui.shared.montantDemande'); },
  get acceptedAmount() { return tr('ui.shared.montantAccepte'); },
  get receivedAmount() { return tr('ui.shared.montantRecu'); },
  get cashRefund() { return tr('ui.shared.remboursementEspeces'); },
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
