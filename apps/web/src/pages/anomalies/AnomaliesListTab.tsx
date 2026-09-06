import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { ANOMALY_CATEGORIES, ANOMALY_STATUSES, type AnomalyCategory, type AnomalyStatus } from '@oculo/shared-types';
import { listAnomalies } from '../../features/anomalies/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageLoader, EmptyState } from '../../components/ui';
import { AnomalyStatusBadge, AnomalyCategoryBadge, ANOMALY_CATEGORY_LABELS, ANOMALY_STATUS_LABELS } from './shared';

export function AnomaliesListTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [hasFinancialImpact, setHasFinancialImpact] = useState(false);
  const [hasStockImpact, setHasStockImpact] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['anomalies', category, status, hasFinancialImpact, hasStockImpact, page],
    queryFn: () =>
      listAnomalies({
        category: (category as AnomalyCategory) || undefined,
        status: (status as AnomalyStatus) || undefined,
        hasFinancialImpact: hasFinancialImpact || undefined,
        hasStockImpact: hasStockImpact || undefined,
        page,
      }),
  });

  const s = search.trim().toLowerCase();
  const items = (data?.items ?? []).filter(
    (a) => !s || a.number.toLowerCase().includes(s) || a.targetReference.toLowerCase().includes(s) || a.description.toLowerCase().includes(s),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input h-9 w-56" placeholder="Numéro, élément, description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input h-9 w-auto" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">Toutes catégories</option>
          {ANOMALY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ANOMALY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className="input h-9 w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {ANOMALY_STATUSES.map((st) => (
            <option key={st} value={st}>
              {ANOMALY_STATUS_LABELS[st]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-content-muted">
          <input type="checkbox" checked={hasFinancialImpact} onChange={(e) => { setHasFinancialImpact(e.target.checked); setPage(1); }} />
          Impact financier
        </label>
        <label className="flex items-center gap-1.5 text-xs text-content-muted">
          <input type="checkbox" checked={hasStockImpact} onChange={(e) => { setHasStockImpact(e.target.checked); setPage(1); }} />
          Impact stock
        </label>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Aucune anomalie" hint="Déclarez une anomalie pour commencer le suivi." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-surface-2/60 text-left text-xs uppercase tracking-wide text-content-muted">
                <th className="table-cell font-semibold">Numéro</th>
                <th className="table-cell font-semibold">Catégorie</th>
                <th className="table-cell font-semibold">Élément</th>
                <th className="table-cell font-semibold">Déclarant</th>
                <th className="table-cell text-right font-semibold">Impact financier</th>
                <th className="table-cell text-right font-semibold">Impact stock</th>
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer border-b last:border-0 transition hover:bg-surface-2">
                  <td className="table-cell font-medium text-content">{a.number}</td>
                  <td className="table-cell">
                    <AnomalyCategoryBadge category={a.category} />
                  </td>
                  <td className="table-cell text-content-muted">{a.targetReference}</td>
                  <td className="table-cell text-content-muted">{a.declaredBy ? `${a.declaredBy.firstName} ${a.declaredBy.lastName}` : '—'}</td>
                  <td className="table-cell text-right text-content">{formatCurrency(Number(a.financialImpact))}</td>
                  <td className="table-cell text-right text-content">{a.stockImpact}</td>
                  <td className="table-cell text-content-muted">{formatDate(a.declaredAt)}</td>
                  <td className="table-cell">
                    <AnomalyStatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-content-muted">
              <span>
                {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} sur {data.total}
              </span>
              <div className="flex gap-1">
                <button className="btn-outline h-7 rounded-md px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </button>
                <button
                  className="btn-outline h-7 rounded-md px-2"
                  disabled={page * data.pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
