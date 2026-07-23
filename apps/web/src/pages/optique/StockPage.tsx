import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, Search, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { getStock, adjustStock, type StockRow } from '../../features/optique/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

const CATEGORIES = [
  { value: 'MONTURE', label: 'Montures' },
  { value: 'VERRE', label: 'Verres' },
  { value: 'LENTILLE', label: 'Lentilles' },
  { value: 'ACCESSOIRE', label: 'Accessoires' },
  { value: 'SERVICE', label: 'Services' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

export function StockPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canAdjust = usePermission('optique.stock.adjust');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<StockRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stock', branchId, lowOnly],
    queryFn: () => getStock(branchId!, lowOnly),
    enabled: Boolean(branchId),
  });

  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalStock: number; lastCreated: string | null }> = {
      MONTURE: { count: 0, totalStock: 0, lastCreated: null },
      VERRE: { count: 0, totalStock: 0, lastCreated: null },
      LENTILLE: { count: 0, totalStock: 0, lastCreated: null },
      ACCESSOIRE: { count: 0, totalStock: 0, lastCreated: null },
      SERVICE: { count: 0, totalStock: 0, lastCreated: null },
    };

    const items = data ?? [];
    items.forEach((r) => {
      const cat = r.category;
      if (stats[cat]) {
        stats[cat].count++;
        stats[cat].totalStock += r.quantity;
        if (r.createdAt) {
          if (!stats[cat].lastCreated || r.createdAt > stats[cat].lastCreated) {
            stats[cat].lastCreated = r.createdAt;
          }
        }
      }
    });

    return stats;
  }, [data]);

  const rows = (data ?? []).filter(
    (r) =>
      (!category || r.category === category) &&
      (r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.sku.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div>
      <PageHeader title={t('stock.title')} subtitle={t('stock.subtitle')} />

      {/* Visual Category Dashboard Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {CATEGORIES.map((c) => {
          const stats = categoryStats[c.value] || { count: 0, totalStock: 0, lastCreated: null };
          const isActive = category === c.value;
          return (
            <div
              key={c.value}
              onClick={() => setCategory(isActive ? '' : c.value)}
              className={`card cursor-pointer p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-md ${
                isActive ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'hover:border-primary-soft'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{c.label}</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-content">
                  {stats.count} <span className="text-xs font-normal text-content-muted">réf(s)</span>
                </span>
                {c.value !== 'VERRE' && c.value !== 'SERVICE' && (
                  <span className="text-xs font-semibold text-content-muted">
                    {stats.totalStock} en stock
                  </span>
                )}
              </div>
              <p className="mt-2 text-[10px] text-content-faint">
                {stats.lastCreated ? (
                  <>Dernier enreg. : <span className="font-medium text-content-muted">{formatDate(stats.lastCreated)}</span></>
                ) : (
                  'Aucun produit enregistré'
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setLowOnly((v) => !v)}
          className={`btn-outline ${lowOnly ? 'border-danger text-danger' : ''}`}
        >
          <AlertTriangle className="h-4 w-4" /> Stock faible
        </button>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory('')}
            className={`badge px-3 py-1.5 ${category === '' ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}
          >
            Tous
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`badge px-3 py-1.5 ${category === c.value ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState icon={Boxes} title={t('stock.noItem')} hint={t('stock.emptyHint')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">{t('common.product')}</th>
                <th className="table-cell font-semibold">{t('common.category')}</th>
                <th className="table-cell text-right font-semibold">{t('common.price')}</th>
                <th className="table-cell text-center font-semibold">{t('common.quantity')}</th>
                <th className="table-cell text-center font-semibold">{t('common.threshold')}</th>
                <th className="table-cell text-right font-semibold">Enregistré le</th>
                <th className="table-cell text-right font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="font-medium text-content">{r.name}</div>
                    <div className="text-xs text-content-faint">{r.sku}</div>
                  </td>
                  <td className="table-cell">
                    <Badge tone="info">{catLabel(r.category)}</Badge>
                  </td>
                  <td className="table-cell text-right text-content-muted">
                    {formatCurrency(r.sellPrice)}
                  </td>
                  <td className="table-cell text-center">
                    {r.unlimited ? (
                      <span className="text-sm font-semibold text-content-muted">Illimité</span>
                    ) : (
                      <span className="font-display text-lg font-bold text-content">{r.quantity}</span>
                    )}
                  </td>
                  <td className="table-cell text-center text-content-muted">{r.unlimited ? '—' : r.minAlert}</td>
                  <td className="table-cell text-right text-content-muted">
                    {r.createdAt ? formatDateTime(r.createdAt) : '—'}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      {r.low && <Badge tone="danger">{t('stock.lowBadge')}</Badge>}
                      {canAdjust && !r.unlimited && (
                        <button onClick={() => setEditing(r)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                          <SlidersHorizontal className="h-3.5 w-3.5" /> Ajuster
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && branchId && (
        <AdjustModal
          row={editing}
          branchId={branchId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['stock'] });
            // La caisse et les devis utilisent leur propre clé de cache.
            qc.invalidateQueries({ queryKey: ['pos-stock'] });
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({
  row,
  branchId,
  onClose,
  onSaved,
}: {
  row: StockRow;
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [delta, setDelta] = useState(0);
  const [minAlert, setMinAlert] = useState(row.minAlert);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => adjustStock({ productId: row.productId, branchId, delta, minAlert }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={`Ajuster — ${row.name}`} size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-center">
          <p className="text-xs text-content-muted">{t('stock.currentQty')}</p>
          <p className="font-display text-2xl font-bold text-content">{row.quantity}</p>
          <p className="mt-1 text-xs text-content-faint">
            Nouvelle quantité : <span className="font-semibold text-content">{row.quantity + delta}</span>
          </p>
        </div>
        <Field label={t('stock.movement')}>
          <div className="flex items-center gap-2">
            <button className="btn-outline h-10 w-10 p-0 text-lg" onClick={() => setDelta((d) => d - 1)}>
              −
            </button>
            <input
              type="number"
              className="input text-center"
              value={delta}
              onChange={(e) => setDelta(parseInt(e.target.value || '0', 10))}
            />
            <button className="btn-outline h-10 w-10 p-0 text-lg" onClick={() => setDelta((d) => d + 1)}>
              +
            </button>
          </div>
        </Field>
        <Field label={t('stock.minAlert')}>
          <input
            type="number"
            className="input"
            value={minAlert}
            onChange={(e) => setMinAlert(parseInt(e.target.value || '0', 10))}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={delta === 0 && minAlert === row.minAlert}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
