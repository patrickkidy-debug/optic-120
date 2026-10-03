import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { getAuditLogs } from '../../features/settings/api';
import { formatDateTime } from '../../lib/format';
import { PageHeader, Badge, PageLoader, EmptyState, Button } from '../../components/ui';
import { tr } from '../../lib/tr';

const ACTION_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  LOGIN_SUCCESS: 'success',
  TENANT_SIGNUP: 'success',
  SALE_CREATED: 'info',
  LOGIN_FAILED: 'warning',
  LOGIN_LOCKED: 'danger',
  SALE_CANCELLED: 'danger',
  USER_DEACTIVATED: 'danger',
  SECURITY_REFRESH_REUSE_DETECTED: 'danger',
  ANOMALY_DECLARED: 'info',
  ANOMALY_SUBMITTED: 'warning',
  ANOMALY_APPROVED: 'info',
  ANOMALY_REJECTED: 'danger',
  ANOMALY_CORRECTION_APPLIED: 'success',
  ANOMALY_CANCELLED: 'danger',
};

export function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['audit', page],
    queryFn: () => getAuditLogs(page),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader title={tr('ui.AuditPage.journalDActivite')} subtitle={tr('ui.AuditPage.tracabiliteDesActionsSensibles')} />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title={tr('ui.AuditPage.aucuneActiviteEnregistree')} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">{tr('ui.AuditPage.action')}</th>
                  <th className="table-cell font-semibold">{tr('ui.AuditPage.utilisateur')}</th>
                  <th className="table-cell font-semibold">{tr('ui.AuditPage.entite')}</th>
                  <th className="table-cell font-semibold">IP</th>
                  <th className="table-cell text-right font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <Badge tone={ACTION_TONE[log.action] ?? 'neutral'}>{log.action}</Badge>
                    </td>
                    <td className="table-cell text-content-muted">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : tr('ui.AuditPage.systeme')}
                    </td>
                    <td className="table-cell text-content-faint">{log.entity ?? '—'}</td>
                    <td className="table-cell font-mono text-xs text-content-faint">{log.ipAddress ?? '—'}</td>
                    <td className="table-cell text-right text-content-muted">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-content-muted">
            <span>{data.total} {tr('ui.AuditPage.entreeS')}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {tr('ui.AuditPage.precedent')}
              </Button>
              <span>{page} / {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {tr('ui.AuditPage.suivant')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
