import { Search, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui';
import { METHOD_LABEL, RANGE_LABEL, STATUS_META, STATUS_ORDER, describePeriod, rangeBounds } from './shared';
import type { RangeKey, ReportFilters, StatusKey } from './shared';

const QUICK_RANGES: RangeKey[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'custom',
];

export interface SellerOption {
  id: string;
  name: string;
}

/**
 * Barre de filtres. Chaque changement remonte au parent, qui relance la requête :
 * indicateurs, graphique et tableau restent donc toujours calculés sur le même
 * périmètre — c'est la condition pour qu'un chiffre du haut de page corresponde
 * au tableau du bas.
 */
export function FilterBar({
  filters,
  onChange,
  onReset,
  sellers,
  methods,
  showAdvanced,
  onToggleAdvanced,
  dirty,
}: {
  filters: ReportFilters;
  onChange: (next: Partial<ReportFilters>) => void;
  onReset: () => void;
  sellers: SellerOption[];
  methods: string[];
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  dirty: boolean;
}) {
  function pickRange(range: RangeKey) {
    if (range === 'custom') {
      onChange({ range });
      return;
    }
    const { from, to } = rangeBounds(range);
    onChange({ range, from, to });
  }

  function toggleStatus(status: StatusKey) {
    const next = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onChange({ status: next });
  }

  return (
    <section className="card mb-4 p-4" aria-label="Filtres du rapport">
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_RANGES.map((key) => {
          const active = filters.range === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pickRange(key)}
              aria-pressed={active}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
              }`}
            >
              {RANGE_LABEL[key]}
            </button>
          );
        })}
      </div>

      {filters.range === 'custom' && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-content-muted">
            Date de début
            <input
              type="date"
              className="input mt-1"
              value={filters.from}
              max={filters.to}
              onChange={(e) => onChange({ from: e.target.value })}
            />
          </label>
          <label className="text-xs text-content-muted">
            Date de fin
            <input
              type="date"
              className="input mt-1"
              value={filters.to}
              min={filters.from}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          </label>
        </div>
      )}

      <p className="mt-3 text-sm font-medium text-content" aria-live="polite">
        {describePeriod(filters.from, filters.to)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Rechercher une vente, un client ou un numéro…"
            aria-label="Rechercher une vente, un client ou un numéro"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>

        <Button variant="outline" onClick={onToggleAdvanced} aria-expanded={showAdvanced}>
          <SlidersHorizontal className="h-4 w-4" /> Plus de filtres
        </Button>

        {dirty && (
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> Réinitialiser les filtres
          </Button>
        )}
      </div>

      {showAdvanced && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
          <fieldset>
            <legend className="mb-1.5 text-xs text-content-muted">Statut du paiement</legend>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((key) => {
                const active = filters.status.includes(key);
                const Icon = STATUS_META[key].icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleStatus(key)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-primary-soft text-primary'
                        : 'bg-surface-2 text-content-muted hover:bg-surface-3'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {STATUS_META[key].label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="text-xs text-content-muted">
            Vendeur
            <select
              className="input mt-1"
              value={filters.cashierId}
              onChange={(e) => onChange({ cashierId: e.target.value })}
            >
              <option value="">Tous les vendeurs</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-content-muted">
            Mode de paiement
            <select
              className="input mt-1"
              value={filters.method}
              onChange={(e) => onChange({ method: e.target.value })}
            >
              <option value="">Tous les modes</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m] ?? m}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
