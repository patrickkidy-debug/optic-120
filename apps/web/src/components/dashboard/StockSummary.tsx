import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Glasses, Frame as FrameIcon, AlertTriangle, XCircle } from 'lucide-react';
import { getStock } from '../../features/optique/api';
import { MiniMetric } from './MiniMetric';
import { tr } from '../../lib/tr';

/** Résumé stock (montures / verres / stock faible / ruptures), même cache que la page Stock. */
export function StockSummary({ branchId, enabled }: { branchId?: string | null; enabled: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock', branchId, false],
    queryFn: () => getStock(branchId!, false),
    enabled: enabled && Boolean(branchId),
  });
  const rows = data ?? [];
  const frameQty = rows.filter((r) => r.category === 'MONTURE').reduce((s, r) => s + r.quantity, 0);
  const lensRefs = rows.filter((r) => r.category === 'VERRE').length;
  const lowRows = rows.filter((r) => r.low);
  const outRows = rows.filter((r) => !r.unlimited && r.quantity === 0);

  if (!enabled || !branchId) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-content">Stock</h3>
        <Link to="/optique/stock" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          {tr('ui.StockSummary.voirLeStock')}
        </Link>
      </div>
      {isLoading ? (
        <p className="text-sm text-content-muted">{tr('ui.StockSummary.chargement')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniMetric icon={FrameIcon} label={tr('ui.StockSummary.monturesEnStock')} value={frameQty} tone="primary" />
            <MiniMetric icon={Glasses} label={tr('ui.StockSummary.referencesVerres')} value={lensRefs} tone="accent" />
            <MiniMetric
              icon={AlertTriangle}
              label={tr('ui.StockSummary.stockFaible')}
              value={lowRows.length}
              tone={lowRows.length > 0 ? 'warning' : 'success'}
            />
            <MiniMetric
              icon={XCircle}
              label={tr('ui.StockSummary.ruptures')}
              value={outRows.length}
              tone={outRows.length > 0 ? 'danger' : 'success'}
            />
          </div>
          {lowRows.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-faint">{tr('ui.StockSummary.aReapprovisionner')}</p>
              {lowRows.slice(0, 5).map((r) => (
                <div key={r.productId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-content">{r.name}</span>
                  <span className="shrink-0 text-xs text-content-faint">
                    {r.quantity} / min {r.minAlert}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
