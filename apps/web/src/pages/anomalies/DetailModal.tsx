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
import { invalidateAfterCorrection } from '../../lib/queryInvalidation';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { Modal, Button, PageLoader } from '../../components/ui';
import {
  AnomalyStatusBadge,
  AnomalyCategoryBadge,
  ANOMALY_REASON_LABELS,
  CORRECTION_TYPE_LABELS,
  ANOMALY_ACTION_LABELS,
  ANOMALY_FIELD_LABEL_MAP,
  hasFinancialStake,
} from './shared';

/**
 * Une transition d'anomalie ne change que l'anomalie… sauf l'application d'une
 * correction, qui modifie une vraie donnée métier (vente, stock, paiement…).
 * Comme cette modale sert les deux, elle réactualise dans le doute toutes les
 * vues chiffrées : c'est précisément leur absence ici qui laissait la liste des
 * ventes et le tableau de bord afficher l'ancien montant après une correction.
 */
function refresh(qc: ReturnType<typeof useQueryClient>) {
  invalidateAfterCorrection(qc);
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
          {anomaly.description && <p className="mt-2 text-content">{anomaly.description}</p>}
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
            <h4 className="mb-2 text-sm font-semibold text-content">Valeurs corrigées</h4>
            <div className="space-y-2">
              {anomaly.entries.map((e) => (
                <div key={e.id} className="rounded-xl border bg-surface p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-content">{ANOMALY_FIELD_LABEL_MAP[e.fieldName] ?? e.fieldName}</span>
                    <span className="text-xs text-content-faint">{e.fieldName}</span>
                  </div>
                  <div className={`grid ${e.fieldName === 'items' ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-2.5'}`}>
                    <div className="rounded-lg bg-surface-2/80 p-2.5 text-xs">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-content-muted">Valeur initiale</p>
                      <div className="text-content">{formatCorrectionValue(e.fieldName, e.oldValue)}</div>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-primary">Valeur corrigée souhaitée</p>
                      <div className="text-content font-medium">{formatCorrectionValue(e.fieldName, e.newValue)}</div>
                    </div>
                  </div>
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
          {/* APPROVED inclus : sans issue de secours, une correction approuvée
              mais inapplicable bloque pour toujours la vente concernée. */}
          {['DECLARED', 'PENDING_VALIDATION', 'APPROVED'].includes(anomaly.status) && canCancel && !showCancel && (
            <Button variant="ghost" onClick={() => setShowCancel(true)}>
              <Ban className="h-4 w-4" /> Annuler l'anomalie
            </Button>
          )}
        </div>

        {timeline && timeline.length > 0 && (
          <div className="rounded-xl border bg-surface p-3">
            <h4 className="mb-2 text-sm font-semibold text-content">Journal</h4>
            <div className="space-y-2 text-xs">
              {timeline.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 border-b border-surface-2 pb-1.5 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-content">{e.userName ?? 'Système'}</span>
                    <span className="text-content-faint">—</span>
                    <span className="rounded-md bg-surface-2 px-2 py-0.5 font-medium text-content-muted">
                      {ANOMALY_ACTION_LABELS[e.action] ?? e.action}
                    </span>
                  </div>
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

function formatCorrectionValue(fieldName: string, rawVal: string | null | undefined): React.ReactNode {
  if (rawVal == null || rawVal === '' || rawVal === '—') {
    return <span className="text-content-faint italic">Non renseigné</span>;
  }

  // 1. Articles / Lignes de vente (JSON)
  if (fieldName === 'items') {
    try {
      const parsed = JSON.parse(rawVal);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return (
          <div className="space-y-1.5 pt-0.5">
            {parsed.map((item: { productId?: string; productName?: string; reference?: string; quantity?: number; unitPrice?: number }, idx: number) => {
              const qty = Number(item.quantity) || 1;
              const unitPrice = Number(item.unitPrice) || 0;
              const total = qty * unitPrice;
              const name = item.productName || item.reference || (item.productId ? `Article #${idx + 1}` : 'Article');
              return (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-surface px-2.5 py-1.5 text-xs shadow-xs">
                  <span className="font-medium text-content">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-content-muted">{qty} × {formatCurrency(unitPrice)}</span>
                    <span className="font-semibold text-content">{formatCurrency(total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    } catch {
      // Fallback
    }
  }

  // 2. Dates / Horodatages
  if (fieldName === 'createdAt' || fieldName === 'date' || (typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVal))) {
    const d = new Date(rawVal);
    if (!isNaN(d.getTime())) {
      return <span>{formatDateTime(d)}</span>;
    }
  }

  // 3. Montants
  if (
    [
      'discountAmount',
      'buyPrice',
      'sellPrice',
      'openingAmount',
      'closingAmount',
      'amount',
      'cost',
      'requestedAmount',
      'acceptedAmount',
      'receivedAmount',
      'cashRefund',
      'totalAmount',
    ].includes(fieldName)
  ) {
    const numVal = Number(rawVal);
    if (!isNaN(numVal)) {
      return <span className="font-semibold text-content">{formatCurrency(numVal)}</span>;
    }
  }

  // 4. Taux TVA
  if (fieldName === 'vatRate') {
    const numVal = Number(rawVal);
    return <span>{!isNaN(numVal) && numVal > 0 ? `${numVal} %` : '0 % (Exonéré)'}</span>;
  }

  // 5. Client / Vendeur non renseigné
  if ((fieldName === 'customerId' || fieldName === 'cashierId') && (rawVal === '0' || rawVal === '')) {
    return <span className="text-content-faint italic">Non assigné</span>;
  }

  return <span>{rawVal}</span>;
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
