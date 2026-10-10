import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Factory, KeyRound, Truck } from 'lucide-react';
import { ot } from '../../../features/oculotrack/api';
import { EmptyState, PageLoader, Badge } from '../../../components/ui';
import { apiErrorMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/format';
import { tr } from '../../../lib/tr';

export function AnomaliesTab({ onOpenOrder, onOpenPackage, canManage }: { onOpenOrder: (id: string) => void; onOpenPackage: (id: string) => void; canManage: boolean }) {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['ot', 'anomalies', all], queryFn: () => ot.anomalies(all ? undefined : 'OPEN') });
  const resolve = useMutation({
    mutationFn: (id: string) => ot.resolveAnomaly(id, prompt(tr('ot.resolutionPrompt')) ?? ''),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ot'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });
  return (
    <div>
      <label className="flex items-center gap-2 px-4 py-2 text-sm text-content-muted">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {tr('ot.showResolved')}
      </label>
      {isLoading ? (
        <PageLoader />
      ) : !data?.length ? (
        <EmptyState icon={CheckCircle2} title={tr('ot.noAnomalies')} />
      ) : (
        <ul className="divide-y">
          {data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${a.status === 'OPEN' ? 'bg-red-500/12 text-red-500' : 'bg-emerald-500/12 text-emerald-600'}`}>
                {a.status === 'OPEN' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-content">{tr(`ot.an.${a.type}`)}</p>
                <p className="text-xs text-content-faint">
                  {a.reportedByName} · {formatDateTime(a.createdAt)} ·{' '}
                  {a.lensOrder && <button type="button" className="font-mono font-semibold text-primary hover:underline" onClick={() => onOpenOrder(a.lensOrder!.id)}>{a.lensOrder.trackCode}</button>}
                  {a.package && <button type="button" className="ml-1 font-mono font-semibold text-primary hover:underline" onClick={() => onOpenPackage(a.package!.id)}>{a.package.number}</button>}
                </p>
                {a.comment && <p className="mt-1 text-sm text-content-muted">{a.comment}</p>}
                {a.resolution && <p className="mt-1 text-xs text-content-faint">→ {a.resolution} ({a.resolvedByName})</p>}
              </div>
              {a.status === 'OPEN' && canManage && (
                <button type="button" className="btn-outline h-8 rounded-lg px-3 text-xs" onClick={() => resolve.mutate(a.id)}>{tr('ot.resolve')}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccessesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ot', 'accesses'], queryFn: ot.accesses });
  const revoke = useMutation({ mutationFn: ot.revokeAccess, onSuccess: () => qc.invalidateQueries({ queryKey: ['ot', 'accesses'] }), onError: (e) => alert(apiErrorMessage(e)) });
  if (isLoading) return <PageLoader />;
  if (!data?.length) return <EmptyState icon={KeyRound} title={tr('ot.noAccesses')} />;
  return (
    <ul className="divide-y">
      {data.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            {a.account.kind === 'CARRIER' ? <Truck className="h-4 w-4" /> : <Factory className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-content">{a.account.name} <span className="text-xs font-normal text-content-faint">· {a.account.email}</span></p>
            <p className="text-xs text-content-muted">
              {tr(`ot.kind.${a.account.kind}`)}{a.supplier ? ` · ${a.supplier.name}` : ''}
              {a.account.lastLoginAt ? ` · ${tr('ot.lastLogin', { date: formatDateTime(a.account.lastLoginAt) })}` : ''}
            </p>
          </div>
          <Badge tone={a.account.activated ? 'success' : 'warning'}>{a.account.activated ? tr('ot.activated') : tr('ot.invited')}</Badge>
          <button type="button" className="btn-ghost h-8 rounded-lg px-2 text-xs text-danger" onClick={() => confirm(tr('ot.revokeConfirm')) && revoke.mutate(a.id)}>
            {tr('ot.revoke')}
          </button>
        </li>
      ))}
    </ul>
  );
}
