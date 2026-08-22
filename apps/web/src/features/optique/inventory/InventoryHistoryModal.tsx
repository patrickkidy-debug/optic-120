import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { listInventoryCounts, type InventoryCount } from './api';
import { formatCurrency, formatDateTime } from '../../../lib/format';
import { Modal, Badge, PageLoader, EmptyState } from '../../../components/ui';
import { InventoryLinesTable } from './InventoryLinesTable';

const STATUS_LABEL: Record<InventoryCount['status'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: 'En cours', tone: 'warning' },
  COMPLETED: { label: 'Terminé', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

export function InventoryHistoryModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-counts', branchId],
    queryFn: () => listInventoryCounts({ branchId, pageSize: 30 }),
  });

  if (detailId) {
    return (
      <Modal open onClose={() => setDetailId(null)} title="Détail de l'inventaire" size="xl">
        <InventoryLinesTable countId={detailId} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Historique des inventaires" size="lg">
      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={History} title="Aucun inventaire réalisé" hint="Les sessions d'inventaire passées apparaîtront ici." />
      ) : (
        <div className="max-h-[520px] overflow-y-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell font-semibold">Réalisé par</th>
                <th className="table-cell text-center font-semibold">Articles</th>
                <th className="table-cell text-center font-semibold">Écarts</th>
                <th className="table-cell text-right font-semibold">Valeur</th>
                <th className="table-cell font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setDetailId(c.id)}
                  className="cursor-pointer border-b last:border-0 hover:bg-surface-2/50"
                >
                  <td className="table-cell text-content">{formatDateTime(c.createdAt)}</td>
                  <td className="table-cell text-content-muted">
                    {c.startedBy ? `${c.startedBy.firstName} ${c.startedBy.lastName}` : '—'}
                  </td>
                  <td className="table-cell text-center text-content-muted">{c._count?.lines ?? '—'}</td>
                  <td className="table-cell text-center text-content-muted">{c.gapCount ?? 0}</td>
                  <td className="table-cell text-right text-content-muted">
                    {formatCurrency(c.netValue ?? 0)}
                  </td>
                  <td className="table-cell">
                    <Badge tone={STATUS_LABEL[c.status].tone}>{STATUS_LABEL[c.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
