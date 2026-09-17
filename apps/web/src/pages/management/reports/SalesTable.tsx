import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { SalesReport, SalesReportParams, SalesReportRow } from '../../../features/optique/api';
import { formatCurrency } from '../../../lib/format';
import { Badge, Button, DropdownMenu, EmptyState } from '../../../components/ui';
import { Skeleton, STATUS_META, STATUS_ORDER, methodLabel } from './shared';
import type { StatusKey } from './shared';
import { FileText } from 'lucide-react';

type SortBy = NonNullable<SalesReportParams['sortBy']>;

const COLUMNS: { key: SortBy | null; label: string; align?: 'right'; sortable: boolean }[] = [
  { key: 'number', label: 'N°', sortable: true },
  { key: 'customer', label: 'Client', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
  { key: null, label: 'Vendeur', sortable: false },
  { key: 'total', label: 'Total', align: 'right', sortable: true },
  { key: 'paid', label: 'Payé', align: 'right', sortable: true },
  { key: 'balance', label: 'Reste', align: 'right', sortable: true },
  { key: null, label: 'Statut', sortable: false },
  { key: null, label: 'Mode de paiement', sortable: false },
];

export function SalesTableSkeleton() {
  return (
    <section className="card mb-4 p-4">
      <Skeleton className="mb-3 h-5 w-32" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="mb-2 h-10 w-full" />
      ))}
    </section>
  );
}

export function SalesTable({
  report,
  statusFilter,
  onPickStatus,
  sortBy,
  sortDir,
  onSort,
  page,
  onPage,
  onOpen,
  onReset,
  isFetching,
}: {
  report: SalesReport;
  statusFilter: StatusKey[];
  onPickStatus: (next: StatusKey[]) => void;
  sortBy: SortBy;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortBy) => void;
  page: number;
  onPage: (p: number) => void;
  onOpen: (row: SalesReportRow) => void;
  onReset: () => void;
  isFetching: boolean;
}) {
  const { rows, total, pageSize } = report;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  // `balance` et `customer` ne sont pas triables en base : l'un est calculé,
  // l'autre vit sur la relation client. Le tri porte alors sur la page chargée,
  // et on le dit plutôt que de laisser croire à un classement global.
  const localSort = sortBy === 'balance' || sortBy === 'customer';

  return (
    <section className="card mb-4" aria-label="Ventes de la période">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div>
          <h3 className="font-display text-base font-bold text-content">Ventes</h3>
          <p className="text-xs text-content-faint">
            {total === 0
              ? 'Aucune vente'
              : `${total} vente${total > 1 ? 's' : ''} correspondant aux filtres`}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtre rapide par statut">
          <button
            type="button"
            onClick={() => onPickStatus([])}
            aria-pressed={statusFilter.length === 0}
            className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              statusFilter.length === 0
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-content-muted hover:bg-surface-3'
            }`}
          >
            Toutes
          </button>
          {STATUS_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onPickStatus([key])}
              aria-pressed={statusFilter.length === 1 && statusFilter[0] === key}
              className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                statusFilter.length === 1 && statusFilter[0] === key
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3'
              }`}
            >
              {STATUS_META[key].label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={FileText}
            title="Aucune donnée disponible"
            hint="Aucune vente ne correspond à la période ou aux filtres sélectionnés."
            action={
              <Button variant="outline" onClick={onReset}>
                Réinitialiser les filtres
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  {COLUMNS.map((c) => (
                    <th
                      key={c.label}
                      className={`table-cell font-semibold ${c.align === 'right' ? 'text-right' : ''}`}
                      aria-sort={
                        c.key && c.key === sortBy
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      {c.sortable && c.key ? (
                        <button
                          type="button"
                          onClick={() => onSort(c.key as SortBy)}
                          className={`inline-flex items-center gap-1 hover:text-content ${
                            c.align === 'right' ? 'flex-row-reverse' : ''
                          }`}
                        >
                          {c.label}
                          <SortIcon active={c.key === sortBy} dir={sortDir} />
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                  <th className="table-cell text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status as StatusKey];
                  const Icon = meta?.icon;
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2/50">
                      <td className="table-cell font-medium text-content">{r.number}</td>
                      <td className="table-cell text-content-muted">{r.customer || 'Client de passage'}</td>
                      <td className="table-cell text-content-muted">
                        {new Date(r.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="table-cell text-content-muted">{r.cashier || '—'}</td>
                      <td className="table-cell text-right font-semibold text-content">
                        {formatCurrency(r.total)}
                      </td>
                      <td className="table-cell text-right text-content-muted">{formatCurrency(r.paid)}</td>
                      <td
                        className={`table-cell text-right font-semibold ${
                          r.balance > 0 ? 'text-warning' : 'text-content-faint'
                        }`}
                      >
                        {formatCurrency(r.balance)}
                      </td>
                      <td className="table-cell">
                        <Badge tone={meta?.tone ?? 'neutral'}>
                          <span className="inline-flex items-center gap-1">
                            {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
                            {meta?.label ?? r.status}
                          </span>
                        </Badge>
                      </td>
                      <td className="table-cell text-content-muted">
                        {r.methods.length > 0 ? r.methods.map(methodLabel).join(', ') : '—'}
                      </td>
                      <td className="table-cell text-right">
                        <DropdownMenu
                          items={[{ label: 'Voir le détail', onClick: () => onOpen(r) }]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
            <p className="text-xs text-content-faint">
              Affichage de {first} à {last} sur {total} vente{total > 1 ? 's' : ''}
              {localSort && ' — tri appliqué à la page affichée'}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost h-8 w-8 rounded-lg p-0 disabled:opacity-40"
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm text-content-muted">
                Page {page} / {pageCount}
              </span>
              <button
                type="button"
                className="btn-ghost h-8 w-8 rounded-lg p-0 disabled:opacity-40"
                onClick={() => onPage(page + 1)}
                disabled={page >= pageCount}
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-content-faint" aria-hidden="true" />;
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-primary" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3 w-3 text-primary" aria-hidden="true" />
  );
}
