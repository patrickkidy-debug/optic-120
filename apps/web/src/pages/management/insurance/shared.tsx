import { InsuranceClaimStatus, ProductCategory, GUARANTEE_ALL_CATEGORIES } from '@oculo/shared-types';
import { Badge } from '../../../components/ui';
import { tr } from '../../../lib/tr';

export const INSURER_TYPES = [
  { value: 'HEALTH_INSURANCE', get label() { return tr('ui.shared.assuranceMaladie'); } },
  { value: 'MUTUAL', get label() { return tr('ui.shared.mutuelle'); } },
  { value: 'PRIVATE', get label() { return tr('ui.shared.assurancePrivee'); } },
  { value: 'THIRD_PARTY', get label() { return tr('ui.shared.tiersPayant'); } },
];
export const insurerTypeLabel = (v: string) =>
  INSURER_TYPES.find((t) => t.value === v)?.label ?? v;

export const CONTRACT_STATUSES = [
  { value: 'ACTIVE', get label() { return tr('ui.shared.actif'); } },
  { value: 'SUSPENDED', get label() { return tr('ui.shared.suspendu'); } },
  { value: 'EXPIRED', get label() { return tr('ui.shared.expire'); } },
];
export const contractStatusLabel = (v: string) =>
  CONTRACT_STATUSES.find((s) => s.value === v)?.label ?? v;

/** Catégories couvrables : les familles produit, plus « toutes catégories ». */
export const GUARANTEE_CATEGORY_OPTIONS = [
  { value: GUARANTEE_ALL_CATEGORIES, get label() { return tr('ui.shared.toutesCategories'); } },
  { value: ProductCategory.MONTURE, get label() { return tr('ui.shared.montures'); } },
  { value: ProductCategory.VERRE, get label() { return tr('ui.shared.verres'); } },
  { value: ProductCategory.LENTILLE, get label() { return tr('ui.shared.lentilles'); } },
  { value: ProductCategory.ACCESSOIRE, get label() { return tr('ui.shared.accessoires'); } },
  { value: ProductCategory.ENTRETIEN, get label() { return tr('ui.shared.produitsDEntretien'); } },
  { value: ProductCategory.SERVICE, label: 'Services' },
  { value: ProductCategory.AUTRE, get label() { return tr('ui.shared.autres'); } },
];
export const guaranteeCategoryLabel = (v: string) =>
  GUARANTEE_CATEGORY_OPTIONS.find((c) => c.value === v)?.label ?? v;

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/** Étapes d'un dossier, dans l'ordre où elles se produisent. */
export const CLAIM_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: InsuranceClaimStatus.DRAFT, get label() { return tr('ui.shared.brouillon'); }, tone: 'neutral' },
  { value: InsuranceClaimStatus.PENDING, get label() { return tr('ui.shared.enAttente'); }, tone: 'warning' },
  { value: InsuranceClaimStatus.ACCEPTED, get label() { return tr('ui.shared.acceptee'); }, tone: 'info' },
  { value: InsuranceClaimStatus.PARTIALLY_ACCEPTED, get label() { return tr('ui.shared.partiellementAcceptee'); }, tone: 'info' },
  { value: InsuranceClaimStatus.REJECTED, get label() { return tr('ui.shared.refusee'); }, tone: 'danger' },
  { value: InsuranceClaimStatus.INVOICED, get label() { return tr('ui.shared.facturee'); }, tone: 'accent' },
  { value: InsuranceClaimStatus.PARTIALLY_PAID, get label() { return tr('ui.shared.partiellementPayee'); }, tone: 'warning' },
  { value: InsuranceClaimStatus.PAID, get label() { return tr('ui.shared.payee'); }, tone: 'success' },
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
