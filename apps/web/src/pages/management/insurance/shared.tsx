import { InsuranceClaimStatus, ProductCategory, GUARANTEE_ALL_CATEGORIES } from '@oculo/shared-types';
import { Badge } from '../../../components/ui';

export const INSURER_TYPES = [
  { value: 'HEALTH_INSURANCE', label: 'Assurance maladie' },
  { value: 'MUTUAL', label: 'Mutuelle' },
  { value: 'PRIVATE', label: 'Assurance privée' },
  { value: 'THIRD_PARTY', label: 'Tiers payant' },
];
export const insurerTypeLabel = (v: string) =>
  INSURER_TYPES.find((t) => t.value === v)?.label ?? v;

export const CONTRACT_STATUSES = [
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'SUSPENDED', label: 'Suspendu' },
  { value: 'EXPIRED', label: 'Expiré' },
];
export const contractStatusLabel = (v: string) =>
  CONTRACT_STATUSES.find((s) => s.value === v)?.label ?? v;

/** Catégories couvrables : les familles produit, plus « toutes catégories ». */
export const GUARANTEE_CATEGORY_OPTIONS = [
  { value: GUARANTEE_ALL_CATEGORIES, label: 'Toutes catégories' },
  { value: ProductCategory.MONTURE, label: 'Montures' },
  { value: ProductCategory.VERRE, label: 'Verres' },
  { value: ProductCategory.LENTILLE, label: 'Lentilles' },
  { value: ProductCategory.ACCESSOIRE, label: 'Accessoires' },
  { value: ProductCategory.ENTRETIEN, label: "Produits d'entretien" },
  { value: ProductCategory.SERVICE, label: 'Services' },
  { value: ProductCategory.AUTRE, label: 'Autres' },
];
export const guaranteeCategoryLabel = (v: string) =>
  GUARANTEE_CATEGORY_OPTIONS.find((c) => c.value === v)?.label ?? v;

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/** Étapes d'un dossier, dans l'ordre où elles se produisent. */
export const CLAIM_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: InsuranceClaimStatus.DRAFT, label: 'Brouillon', tone: 'neutral' },
  { value: InsuranceClaimStatus.PENDING, label: 'En attente', tone: 'warning' },
  { value: InsuranceClaimStatus.ACCEPTED, label: 'Acceptée', tone: 'info' },
  { value: InsuranceClaimStatus.PARTIALLY_ACCEPTED, label: 'Partiellement acceptée', tone: 'info' },
  { value: InsuranceClaimStatus.REJECTED, label: 'Refusée', tone: 'danger' },
  { value: InsuranceClaimStatus.INVOICED, label: 'Facturée', tone: 'accent' },
  { value: InsuranceClaimStatus.PARTIALLY_PAID, label: 'Partiellement payée', tone: 'warning' },
  { value: InsuranceClaimStatus.PAID, label: 'Payée', tone: 'success' },
];

export const claimStatusLabel = (v: string) =>
  CLAIM_STATUSES.find((s) => s.value === v)?.label ?? v;

export function ClaimStatusBadge({ status }: { status: string }) {
  const s = CLAIM_STATUSES.find((x) => x.value === status);
  return <Badge tone={s?.tone ?? 'neutral'}>{s?.label ?? status}</Badge>;
}

/** Onglets du module, à l'intérieur d'une seule entrée de menu. */
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

export const num = (v: unknown): number => Number(v ?? 0);
