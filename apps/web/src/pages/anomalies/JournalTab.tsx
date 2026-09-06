import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { getAnomalyJournal } from '../../features/anomalies/api';
import { formatDateTime } from '../../lib/format';
import { PageLoader, EmptyState, Badge, Button } from '../../components/ui';

const ACTION_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  ANOMALY_DECLARED: 'info',
  ANOMALY_MODIFIED: 'neutral',
  ANOMALY_SUBMITTED: 'warning',
  ANOMALY_APPROVED: 'info',
  ANOMALY_REJECTED: 'danger',
  ANOMALY_CORRECTION_APPLIED: 'success',
  ANOMALY_CANCELLED: 'danger',
};

/** Journal d'activité du module : qui a fait quoi, quand — mêmes entrées que le journal général, filtrées sur les anomalies. */
export function JournalTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['anomalies-journal', page], queryFn: () => getAnomalyJournal(page) });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="Aucune activité enregistrée" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Action</th>
                  <th className="table-cell font-semibold">Utilisateur</th>
                  <th className="table-cell text-right font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <Badge tone={ACTION_TONE[log.action] ?? 'neutral'}>{log.action}</Badge>
                      {log.metadata && (
                        <p className="mt-0.5 text-xs text-content-faint">{JSON.stringify(log.metadata)}</p>
                      )}
                    </td>
                    <td className="table-cell text-content-muted">{log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}</td>
                    <td className="table-cell text-right text-content-muted">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-content-muted">
            <span>{data.total} entrée(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
