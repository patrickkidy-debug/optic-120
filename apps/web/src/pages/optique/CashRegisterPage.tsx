import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Wallet, CheckCircle2, AlertTriangle, Banknote, Smartphone, CreditCard } from 'lucide-react';
import {
  getCurrentRegister,
  getRegisterSummary,
  openRegister,
  closeRegister,
  type CashRegister,
} from '../../features/cashregister/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { PageHeader, PageLoader, Button, Field, Badge } from '../../components/ui';

/** Libellés commerciaux des moyens d'encaissement. */
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  CHEQUE: 'Chèque',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  MOOV_MONEY: 'Moov Money',
  FREE_MONEY: 'Free Money',
  MPESA: 'M-Pesa',
  EMOLA: 'e-Mola',
  MKESH: 'mKesh',
  MULTICAIXA: 'Multicaixa Express',
  UNITEL_MONEY: 'Unitel Money',
  VINTI4: 'Vinti4',
};
const methodIcon = (m: string) => (m === 'CASH' ? Banknote : m === 'CARD' ? CreditCard : Smartphone);

export function CashRegisterPage() {
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canOpen = usePermission('optique.cashregister.open');
  const canClose = usePermission('optique.cashregister.close');

  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [closingTouched, setClosingTouched] = useState(false);
  const [closeResult, setCloseResult] = useState<{ expected: number; counted: number; expenses: number } | null>(null);

  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-current', branchId],
    queryFn: () => getCurrentRegister(branchId!),
    enabled: Boolean(branchId),
  });

  // Résumé en direct des encaissements de la session (par moyen de paiement).
  const { data: summary } = useQuery({
    queryKey: ['cash-summary', register?.id],
    queryFn: () => getRegisterSummary(register!.id),
    enabled: Boolean(register?.id),
  });

  // Le montant de fermeture s'actualise automatiquement avec les espèces reçues
  // (fond + ventes espèces), tant que le caissier ne l'a pas saisi manuellement.
  useEffect(() => {
    if (summary && !closingTouched) setClosing(String(summary.expectedCash));
  }, [summary, closingTouched]);

  const openMut = useMutation({
    mutationFn: () => openRegister(branchId!, Math.max(0, Math.round(Number(opening) || 0))),
    onSuccess: () => {
      setOpening('');
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const closeMut = useMutation({
    mutationFn: (reg: CashRegister) =>
      closeRegister(reg.id, Math.max(0, Math.round(Number(closing) || 0))),
    onSuccess: (res) => {
      setCloseResult({ expected: res.expectedAmount, counted: Number(res.register.closingAmount ?? 0), expenses: res.expensesTotal });
      setClosing('');
      setClosingTouched(false);
      qc.invalidateQueries({ queryKey: ['cash-current'] });
      qc.invalidateQueries({ queryKey: ['cash-summary'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (!branchId) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Session de caisse" subtitle="Ouverture, fermeture et contrôle d'écart (Z)" />

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="mx-auto max-w-lg space-y-4">
          {/* Résultat de la dernière fermeture */}
          {closeResult && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="font-display font-bold text-content">Caisse fermée</h3>
              </div>
              <SummaryRow label="Attendu (fond + espèces)" value={formatCurrency(closeResult.expected)} />
              <SummaryRow label="Dépenses déduites" value={`- ${formatCurrency(closeResult.expenses)}`} />
              <SummaryRow label="Compté" value={formatCurrency(closeResult.counted)} />
              <div className="my-2 border-t" />
              {(() => {
                const diff = closeResult.counted - closeResult.expected;
                const tone = diff === 0 ? 'text-success' : 'text-danger';
                return (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-content-muted">
                      {diff !== 0 && <AlertTriangle className="h-4 w-4 text-danger" />}
                      Écart
                    </span>
                    <span className={`font-display text-lg font-bold ${tone}`}>
                      {diff > 0 ? '+' : ''}
                      {formatCurrency(diff)}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {register ? (
            /* Caisse ouverte → fermeture */
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-content">Caisse ouverte</h3>
                </div>
                <Badge tone="success">OUVERTE</Badge>
              </div>
              <SummaryRow label="Ouverte le" value={formatDateTime(register.openedAt)} />
              <SummaryRow label="Fond de caisse" value={formatCurrency(Number(register.openingAmount))} />

              {/* Détail des encaissements de la session, par moyen de paiement. */}
              <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
                  Encaissements du jour
                </p>
                {!summary || summary.byMethod.length === 0 ? (
                  <p className="text-sm text-content-muted">Aucun encaissement depuis l'ouverture.</p>
                ) : (
                  <div className="space-y-1.5">
                    {summary.byMethod.map((m) => {
                      const Icon = methodIcon(m.method);
                      return (
                        <div key={m.method} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-content-muted">
                            <Icon className="h-4 w-4 text-primary" />
                            {METHOD_LABELS[m.method] ?? m.method}
                            <span className="text-xs text-content-faint">· {m.count}</span>
                          </span>
                          <span className="font-medium text-content">{formatCurrency(m.amount)}</span>
                        </div>
                      );
                    })}
                    <div className="mt-1 flex items-center justify-between border-t pt-1.5">
                      <span className="text-sm font-semibold text-content">Total encaissé</span>
                      <span className="font-display font-bold text-content">{formatCurrency(summary.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content-muted">Dépenses ({summary.expensesCount})</span>
                      <span className="font-medium text-danger">- {formatCurrency(summary.expensesTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1.5">
                      <span className="text-sm font-semibold text-content">Net après dépenses</span>
                      <span className="font-display font-bold text-content">{formatCurrency(summary.netTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ventes annulées de la session : leurs encaissements restent
                  comptés ci-dessus, il faut donc pouvoir les justifier avant
                  de fermer. */}
              {summary && summary.cancelledCount > 0 && (
                <div className="mt-4 rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {summary.cancelledCount} vente(s) annulée(s) depuis l'ouverture
                  </p>
                  <div className="space-y-1.5">
                    {summary.cancelled.map((s) => (
                      <div key={s.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="font-mono text-xs text-content-muted">{s.number}</span>
                          {s.customerName && <span className="text-content-muted"> · {s.customerName}</span>}
                          <span className="block text-xs text-content-faint">
                            {formatDateTime(s.cancelledAt)}
                            {s.methods.length > 0 &&
                              ` · ${s.methods.map((m) => METHOD_LABELS[m] ?? m).join(', ')}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-medium text-content">{formatCurrency(s.total)}</span>
                          {s.cashedAmount > 0 && (
                            <span className="block text-xs font-semibold text-danger">
                              encaissé : {formatCurrency(s.cashedAmount)}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    {summary.cancelledCashedTotal > 0 && (
                      <div className="mt-1 flex items-center justify-between border-t border-[color:var(--danger)]/20 pt-1.5">
                        <span className="text-sm font-semibold text-content">
                          Encaissé sur ventes annulées
                        </span>
                        <span className="font-display font-bold text-danger">
                          {formatCurrency(summary.cancelledCashedTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                  {summary.cancelledCashedTotal > 0 && (
                    <p className="mt-2 text-xs text-content-muted">
                      Ce montant est inclus dans le total encaissé ci-dessus. S'il a été remboursé au
                      client, retirez-le du montant compté.
                    </p>
                  )}
                </div>
              )}

              {canClose ? (
                <div className="mt-4 border-t pt-4">
                  {summary && (
                    <SummaryRow
                      label="Espèces attendues (fond + ventes espèces - dépenses)"
                      value={formatCurrency(summary.expectedCash)}
                    />
                  )}
                  <Field label="Montant compté en caisse (espèces)">
                    <input
                      type="number"
                      min={0}
                      className="input text-right font-semibold"
                      placeholder="0"
                      value={closing}
                      onChange={(e) => {
                        setClosingTouched(true);
                        setClosing(e.target.value);
                      }}
                    />
                  </Field>
                  {summary && !closingTouched && (
                    <p className="mt-1 text-xs text-content-faint">
                      Pré-rempli avec les espèces reçues aujourd'hui — ajustez-le au comptage réel.
                    </p>
                  )}
                  <Button
                    className="mt-3 w-full"
                    loading={closeMut.isPending}
                    disabled={closing === ''}
                    onClick={() => closeMut.mutate(register)}
                  >
                    <Lock className="h-4 w-4" /> Fermer la caisse
                  </Button>
                  <p className="mt-2 text-xs text-content-faint">
                    L'écart tient compte du fond, des ventes espèces et des dépenses enregistrées depuis l'ouverture.
                  </p>
                </div>
              ) : (
                <p className="mt-4 border-t pt-4 text-sm text-content-muted">
                  Vous n'avez pas la permission de fermer la caisse.
                </p>
              )}
            </div>
          ) : (
            /* Aucune caisse ouverte → ouverture */
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-content">Aucune caisse ouverte</h3>
              </div>
              {canOpen ? (
                <>
                  <Field label="Fond de caisse à l'ouverture">
                    <input
                      type="number"
                      min={0}
                      className="input text-right font-semibold"
                      placeholder="0"
                      value={opening}
                      onChange={(e) => setOpening(e.target.value)}
                    />
                  </Field>
                  <Button
                    className="mt-3 w-full"
                    loading={openMut.isPending}
                    disabled={opening === ''}
                    onClick={() => openMut.mutate()}
                  >
                    <Unlock className="h-4 w-4" /> Ouvrir la caisse
                  </Button>
                </>
              ) : (
                <p className="text-sm text-content-muted">
                  Vous n'avez pas la permission d'ouvrir la caisse.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-content-muted">{label}</span>
      <span className="font-medium text-content">{value}</span>
    </div>
  );
}
