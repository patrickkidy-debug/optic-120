import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Printer, RefreshCw } from 'lucide-react';
import {
  getSale,
  getSalesReport,
  type SalesReportParams,
  type SalesReportRow,
} from '../../features/optique/api';
import { listUsers } from '../../features/rbac/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { Button, Modal, PageLoader } from '../../components/ui';
import { FilterBar } from './reports/FilterBar';
import { KpiGrid, KpiGridSkeleton } from './reports/KpiGrid';
import { PerformanceCard, PerformanceCardSkeleton } from './reports/PerformanceCard';
import { PaymentsCard, PaymentsSkeleton } from './reports/PaymentsCard';
import { SalesTable, SalesTableSkeleton } from './reports/SalesTable';
import { ExportsCard } from './reports/ExportsCard';
import {
  defaultFilters,
  describePeriod,
  formatPercent,
  hasActiveFilters,
  methodLabel,
  statusLabel,
  toParams,
  type ReportFilters,
  type StatusKey,
} from './reports/shared';

const PAGE_SIZE = 20;
const FILTERS_KEY = 'oculo_reports_filters';

/** Debounce de la recherche : une frappe ne doit pas déclencher une requête. */
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Filtres mémorisés le temps de la session, pour survivre à une navigation. */
function loadFilters(): ReportFilters {
  try {
    const raw = sessionStorage.getItem(FILTERS_KEY);
    if (!raw) return defaultFilters();
    return { ...defaultFilters(), ...(JSON.parse(raw) as Partial<ReportFilters>) };
  } catch {
    return defaultFilters();
  }
}

/**
 * Rapports & Analyses.
 *
 * Tous les blocs — indicateurs, graphique, répartition, tableau, exports —
 * partagent un seul filtre et une seule requête serveur. C'est ce qui garantit
 * qu'un montant lu en haut de page correspond bien aux lignes du tableau : la
 * version précédente résumait toutes les ventes de la période mais n'en
 * affichait que cinquante, sans le dire.
 */
export function ReportsPage() {
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canStock = usePermission('optique.stock.view');
  const canExpenses = usePermission('finance.expenses.view');
  const canCustomers = usePermission('optique.customers.view');
  const canSeeUsers = usePermission('rbac.users.view');

  const [filters, setFilters] = useState<ReportFilters>(loadFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<NonNullable<SalesReportParams['sortBy']>>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const debouncedSearch = useDebounced(filters.search);
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const params = useMemo(() => toParams(effectiveFilters, branchId), [effectiveFilters, branchId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      /* Mode privé ou stockage refusé : les filtres ne survivront pas, sans plus. */
    }
  }, [filters]);

  // Tout changement de périmètre ramène à la première page : rester en page 4
  // d'un résultat qui n'en compte plus qu'une afficherait un tableau vide.
  useEffect(() => {
    setPage(1);
  }, [params.from, params.to, params.status, params.cashierId, params.method, params.search, branchId]);

  const { data: report, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['sales-report', params, page, sortBy, sortDir],
    queryFn: () => getSalesReport({ ...params, page, pageSize: PAGE_SIZE, sortBy, sortDir }),
  });

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: canSeeUsers });

  useEffect(() => {
    if (dataUpdatedAt) setRefreshedAt(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const sellers = useMemo(
    () => (users ?? []).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    [users],
  );
  // Modes proposés au filtre : ceux réellement rencontrés sur la période, plus
  // celui déjà sélectionné, pour qu'un filtre actif ne disparaisse jamais de sa
  // propre liste.
  const methods = useMemo(() => {
    const set = new Set<string>(report?.rows.flatMap((r) => r.methods) ?? []);
    if (filters.method) set.add(filters.method);
    return [...set].sort((a, b) => methodLabel(a).localeCompare(methodLabel(b)));
  }, [report, filters.method]);

  function update(next: Partial<ReportFilters>) {
    setFilters((f) => ({ ...f, ...next }));
  }
  function reset() {
    setFilters(defaultFilters());
    setShowAdvanced(false);
  }
  function sort(key: NonNullable<SalesReportParams['sortBy']>) {
    if (key === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir('desc');
  }
  function showUnpaid() {
    update({ status: ['PARTIALLY_PAID', 'CONFIRMED'] });
    setShowAdvanced(true);
  }

  const dirty = hasActiveFilters(filters);

  return (
    <div className="print:bg-white">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-content">Rapports &amp; Analyses</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-content-muted">
            Analysez les performances de votre magasin et suivez vos ventes, encaissements et
            paiements.
          </p>
          {refreshedAt && (
            <p className="mt-1 text-xs text-content-faint">
              Dernière mise à jour : aujourd'hui à{' '}
              {refreshedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={isFetching}
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['sales-report'] });
              void refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimer le rapport
          </Button>
        </div>
      </header>

      <div className="print:hidden">
        <FilterBar
          filters={filters}
          onChange={update}
          onReset={reset}
          sellers={sellers}
          methods={methods}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          dirty={dirty}
        />
      </div>

      {isError ? (
        <section className="card grid place-items-center p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
          <p className="mt-3 font-medium text-content">Impossible de charger les rapports</p>
          <p className="mt-1 max-w-md text-sm text-content-muted">{apiErrorMessage(error)}</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </section>
      ) : isLoading || !report ? (
        <>
          <KpiGridSkeleton />
          <PerformanceCardSkeleton />
          <PaymentsSkeleton />
          <SalesTableSkeleton />
        </>
      ) : (
        <>
          <Synthesis
            period={describePeriod(filters.from, filters.to)}
            summary={report.summary}
          />

          <KpiGrid
            summary={report.summary}
            previous={report.previousSummary}
            onShowUnpaid={showUnpaid}
            onShowAll={() => update({ status: [] })}
          />

          <div className="print:hidden">
            <PerformanceCard series={report.series} granularity={report.granularity} />

            <PaymentsCard
              breakdown={report.statusBreakdown}
              summary={report.summary}
              onPickStatus={(status) => update({ status: [status] })}
            />

            <SalesTable
              report={report}
              statusFilter={filters.status}
              onPickStatus={(status: StatusKey[]) => update({ status })}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={sort}
              page={page}
              onPage={setPage}
              onOpen={(row: SalesReportRow) => setDetailId(row.id)}
              onReset={reset}
              isFetching={isFetching}
            />

            <ExportsCard
              params={params}
              matchedCount={report.total}
              branchId={branchId}
              canStock={canStock}
              canExpenses={canExpenses}
              canCustomers={canCustomers}
            />
          </div>
        </>
      )}

      {detailId && <SaleDetail saleId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

/** Synthèse imprimable : le seul bloc conservé par `window.print()`. */
function Synthesis({
  period,
  summary,
}: {
  period: string;
  summary: {
    revenue: number;
    collected: number;
    outstanding: number;
    count: number;
    avgBasket: number;
    collectionRate: number;
  };
}) {
  const lines = [
    ["Chiffre d'affaires", formatCurrency(summary.revenue)],
    ['Encaissements', formatCurrency(summary.collected)],
    ['Reste à encaisser', formatCurrency(summary.outstanding)],
    ['Ventes', String(summary.count)],
    ['Panier moyen', formatCurrency(summary.avgBasket)],
    ["Taux d'encaissement", formatPercent(summary.collectionRate)],
  ];
  return (
    <section className="card mb-4 hidden p-4 print:block" aria-label="Synthèse de la période">
      <h2 className="font-display text-lg font-bold text-content">Synthèse de la période</h2>
      <p className="mb-3 text-sm text-content-muted">{period}</p>
      <dl className="grid grid-cols-2 gap-3">
        {lines.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs uppercase tracking-wide text-content-muted">{label}</dt>
            <dd className="font-display text-lg font-bold text-content">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Détail d'une vente : articles, montants et historique des encaissements. */
function SaleDetail({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const { data: sale, isLoading, isError, error } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => getSale(saleId),
  });

  return (
    <Modal open onClose={onClose} title={sale ? `Vente ${sale.number}` : 'Vente'} size="lg">
      {isError ? (
        <p className="text-sm text-danger">{apiErrorMessage(error)}</p>
      ) : isLoading || !sale ? (
        <PageLoader />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium text-content">
              {sale.customer
                ? `${sale.customer.firstName} ${sale.customer.lastName}`
                : 'Client de passage'}
              {sale.customer?.phone ? ` · ${sale.customer.phone}` : ''}
            </p>
            <p className="text-xs text-content-muted">
              {new Date(sale.createdAt).toLocaleString('fr-FR')} · {statusLabel(sale.status)}
            </p>
          </div>

          <div>
            <h4 className="mb-1.5 font-semibold text-content">Articles</h4>
            <ul className="space-y-1">
              {sale.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 rounded-lg border px-3 py-1.5">
                  <span className="min-w-0 truncate text-content-muted">
                    {i.product?.name ?? '—'} × {i.quantity}
                  </span>
                  <span className="shrink-0 font-medium text-content">
                    {formatCurrency(Number(i.lineTotal))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-surface-2 p-3">
            <Line label="Total" value={formatCurrency(Number(sale.totalAmount))} strong />
            <Line label="Déjà encaissé" value={formatCurrency(Number(sale.paidAmount))} />
            <Line
              label="Reste à payer"
              value={formatCurrency(
                Math.max(0, Number(sale.totalAmount) - Number(sale.paidAmount)),
              )}
              strong
            />
          </div>

          <div>
            <h4 className="mb-1.5 font-semibold text-content">Historique des encaissements</h4>
            {(sale.payments ?? []).length === 0 ? (
              <p className="rounded-lg bg-surface-2 p-3 text-content-muted">
                Aucun encaissement enregistré pour cette vente.
              </p>
            ) : (
              <ul className="space-y-1">
                {(sale.payments ?? []).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 rounded-lg border px-3 py-1.5">
                    <span className="text-content-muted">
                      {methodLabel(p.method)} · {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="font-medium text-content">{formatCurrency(Number(p.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-content-muted">{label}</span>
      <span className={strong ? 'font-display font-bold text-content' : 'text-content'}>{value}</span>
    </div>
  );
}
