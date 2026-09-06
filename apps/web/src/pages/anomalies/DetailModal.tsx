import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Ban, PlayCircle, Send } from 'lucide-react';
import { anomalyApplyPermission } from '@oculo/shared-types';
import {
  getAnomaly,
  getAnomalyTimeline,
  submitAnomaly,
  approveAnomaly,
  rejectAnomaly,
  cancelAnomaly,
  applyAnomalyCorrection,
  type Anomaly,
} from '../../features/anomalies/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { Modal, Button, PageLoader } from '../../components/ui';
import { AnomalyStatusBadge, AnomalyCategoryBadge, ANOMALY_REASON_LABELS, CORRECTION_TYPE_LABELS, hasFinancialStake } from './shared';

function refresh(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['anomalies'] });
  qc.invalidateQueries({ queryKey: ['anomaly'] });
  qc.invalidateQueries({ queryKey: ['anomalies-dashboard'] });
  qc.invalidateQueries({ queryKey: ['anomalies-journal'] });
}

export function DetailModal({ anomalyId, onClose }: { anomalyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const canModify = usePermission('anomalies.modify');
  const canApprove = usePermission('anomalies.approve');
  const canReject = usePermission('anomalies.reject');
  const canApply = usePermission('anomalies.apply');
  const canCancel = usePermission('anomalies.cancel');

  const { data: anomaly, isLoading } = useQuery({ queryKey: ['anomaly', anomalyId], queryFn: () => getAnomaly(anomalyId) });
  const { data: timeline } = useQuery({ queryKey: ['anomaly-timeline', anomalyId], queryFn: () => getAnomalyTimeline(anomalyId) });
  const domainPermission = anomaly ? anomalyApplyPermission(anomaly.category, anomaly.correctionType) : '';
  const canApplyHere = usePermission(domainPermission || 'anomalies.apply');

  const run = useMutation({
    mutationFn: (action: () => Promise<Anomaly>) => action(),
    onSuccess: () => {
      refresh(qc);
      setShowReject(false);
      setShowCancel(false);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading || !anomaly) {
    return (
      <Modal open onClose={onClose} title="Anomalie">
        <PageLoader />
      </Modal>
    );
  }

  const financiallySensitive = hasFinancialStake(anomaly);

  return (
    <Modal open onClose={onClose} title={`Anomalie ${anomaly.number}`} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <AnomalyCategoryBadge category={anomaly.category} />
          <AnomalyStatusBadge status={anomaly.status} />
          <span className="text-xs text-content-faint">{CORRECTION_TYPE_LABELS[anomaly.correctionType]}</span>
        </div>

        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Line label="Élément concerné" value={anomaly.targetReference} />
            <Line label="Déclarée par" value={anomaly.declaredBy ? `${anomaly.declaredBy.firstName} ${anomaly.declaredBy.lastName}` : '—'} />
            <Line label="Motif" value={`${ANOMALY_REASON_LABELS[anomaly.reasonCode]}${anomaly.reasonNote ? ` — ${anomaly.reasonNote}` : ''}`} />
            <Line label="Déclarée le" value={formatDateTime(anomaly.declaredAt)} />
          </div>
          <p className="mt-2 text-content">{anomaly.description}</p>
          {anomaly.comment && <p className="mt-1 text-xs text-content-faint">{anomaly.comment}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Impact label="Financier" value={anomaly.financialImpact} />
          <Impact label="Stock" value={anomaly.stockImpact} isCount />
          <Impact label="Caisse" value={anomaly.cashImpact} />
          <Impact label="Assurance" value={anomaly.insuranceImpact} />
        </div>

        {anomaly.entries.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-sm font-semibold text-content">Valeurs corrigées</h4>
            <div className="space-y-1">
              {anomaly.entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm">
                  <span className="text-content-muted">{e.fieldName}</span>
                  <span className="font-medium text-content">
                    {e.oldValue || '—'} → {e.newValue || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {anomaly.status === 'REJECTED' && (
          <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">
            Rejetée{anomaly.rejectedBy ? ` par ${anomaly.rejectedBy.firstName} ${anomaly.rejectedBy.lastName}` : ''} —{' '}
            {anomaly.rejectionReason}
          </p>
        )}
        {anomaly.status === 'CANCELLED' && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-content-muted">
            Annulée{anomaly.cancelledBy ? ` par ${anomaly.cancelledBy.firstName} ${anomaly.cancelledBy.lastName}` : ''} —{' '}
            {anomaly.cancellationReason}
          </p>
        )}
        {anomaly.status === 'CORRECTED' && (
          <p className="rounded-lg bg-[color:var(--success)]/10 px-3 py-2 text-sm text-success">
            Corrigée{anomaly.appliedBy ? ` par ${anomaly.appliedBy.firstName} ${anomaly.appliedBy.lastName}` : ''} le{' '}
            {anomaly.appliedAt ? formatDateTime(anomaly.appliedAt) : ''}
          </p>
        )}

        {financiallySensitive && ['PENDING_VALIDATION', 'APPROVED'].includes(anomaly.status) && (
          <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm font-medium text-danger">
            Cette action modifiera les données financières.
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {showReject && (
          <div className="rounded-lg border p-3">
            <textarea
              className="input min-h-[60px]"
              placeholder="Motif du rejet (obligatoire)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowReject(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                loading={run.isPending}
                disabled={rejectReason.trim().length === 0}
                onClick={() => run.mutate(() => rejectAnomaly(anomaly.id, rejectReason))}
              >
                Confirmer le rejet
              </Button>
            </div>
          </div>
        )}
        {showCancel && (
          <div className="rounded-lg border p-3">
            <textarea
              className="input min-h-[60px]"
              placeholder="Motif de l'annulation (obligatoire)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCancel(false)}>
                Retour
              </Button>
              <Button
                variant="danger"
                loading={run.isPending}
                disabled={cancelReason.trim().length === 0}
                onClick={() => run.mutate(() => cancelAnomaly(anomaly.id, cancelReason))}
              >
                Confirmer l'annulation
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {anomaly.status === 'DECLARED' && canModify && (
            <Button loading={run.isPending} onClick={() => run.mutate(() => submitAnomaly(anomaly.id))}>
              <Send className="h-4 w-4" /> Soumettre pour validation
            </Button>
          )}
          {anomaly.status === 'PENDING_VALIDATION' && canReject && !showReject && (
            <Button variant="outline" onClick={() => setShowReject(true)}>
              <XCircle className="h-4 w-4" /> Rejeter
            </Button>
          )}
          {anomaly.status === 'PENDING_VALIDATION' && canApprove && (
            <Button loading={run.isPending} onClick={() => run.mutate(() => approveAnomaly(anomaly.id))}>
              <CheckCircle2 className="h-4 w-4" /> Approuver
            </Button>
          )}
          {anomaly.status === 'APPROVED' && canApply && canApplyHere && (
            <Button loading={run.isPending} onClick={() => run.mutate(() => applyAnomalyCorrection(anomaly.id))}>
              <PlayCircle className="h-4 w-4" /> Appliquer la correction
            </Button>
          )}
          {anomaly.status === 'APPROVED' && canApply && !canApplyHere && (
            <p className="text-xs text-content-faint">
              Permission requise pour appliquer : {domainPermission}
            </p>
          )}
          {['DECLARED', 'PENDING_VALIDATION'].includes(anomaly.status) && canCancel && !showCancel && (
            <Button variant="ghost" onClick={() => setShowCancel(true)}>
              <Ban className="h-4 w-4" /> Annuler l'anomalie
            </Button>
          )}
        </div>

        {timeline && timeline.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-sm font-semibold text-content">Journal</h4>
            <div className="space-y-1 text-xs text-content-muted">
              {timeline.map((e) => (
                <div key={e.id} className="flex justify-between gap-2">
                  <span>
                    {e.userName ?? 'Système'} — {e.action}
                  </span>
                  <span className="shrink-0 text-content-faint">{formatDateTime(e.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-content-muted">{label}</p>
      <p className="truncate font-medium text-content">{value}</p>
    </div>
  );
}

function Impact({ label, value, isCount }: { label: string; value: string | number; isCount?: boolean }) {
  const n = Number(value);
  const tone = n > 0 ? 'text-success' : n < 0 ? 'text-danger' : 'text-content-muted';
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <p className="text-xs text-content-faint">{label}</p>
      <p className={`font-display text-lg font-bold ${tone}`}>{isCount ? n : formatCurrency(n)}</p>
    </div>
  );
}
