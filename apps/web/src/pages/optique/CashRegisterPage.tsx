import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  Unlock,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Smartphone,
  CreditCard,
  PlusCircle,
  Receipt,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CURRENCY_FORMAT,
  expenseCreateSchema,
  type ExpenseCreateInput,
  type SupportedCurrency,
} from '@oculo/shared-types';
import {
  getCurrentRegister,
  getRegisterSummary,
  openRegister,
  closeRegister,
  type CashRegister,
} from '../../features/cashregister/api';
import { createExpense } from '../../features/management/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { invalidateFinancialViews } from '../../lib/queryInvalidation';
import { formatCurrency, formatDateTime, getActiveCurrency } from '../../lib/format';
import { EXPENSE_CATEGORY_CODES, expenseCategoryLabel, paymentMethodLabel } from '../../lib/labels';
import { PageHeader, PageLoader, Button, Field, Badge, Modal } from '../../components/ui';
import { trFr } from '../../lib/sharedLabels';

const methodIcon = (m: string) => (m === 'CASH' ? Banknote : m === 'CARD' ? CreditCard : Smartphone);

export function CashRegisterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canOpen = usePermission('optique.cashregister.open');
  const canClose = usePermission('optique.cashregister.close');
  const canAddExpense = usePermission('finance.expenses.create');

  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [closingTouched, setClosingTouched] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [closeResult, setCloseResult] = useState<{
    expected: number;
    counted: number;
    expenses: number;
    opening: number;
    cashSales: number;
    transfersNet?: number;
    salesTotal?: number;
    netTotal?: number;
  } | null>(null);

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
  // (fond + ventes espèces - dépenses), tant que le caissier ne l'a pas saisi manuellement.
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
      setCloseResult({
        expected: res.expectedAmount,
        counted: Number(res.register.closingAmount ?? 0),
        expenses: res.expensesTotal,
        opening: res.openingAmount ?? Number(register?.openingAmount ?? 0),
        cashSales: res.cashSalesTotal ?? (summary?.cash ?? 0),
        transfersNet: res.transfersNet,
        salesTotal: res.salesTotal,
        netTotal: res.netTotal,
      });
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
      <PageHeader
        title={t('cash.title')}
        subtitle={t('cash.subtitle')}
        actions={
          register && canAddExpense ? (
            <Button variant="outline" onClick={() => setExpenseModalOpen(true)}>
              <PlusCircle className="h-4 w-4" /> {t('cash.addExpense')}
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="mx-auto max-w-lg space-y-4">
          {/* Résultat de la dernière fermeture */}
          {closeResult && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="font-display font-bold text-content">{t('cash.closedSuccess')}</h3>
              </div>
              {closeResult.salesTotal !== undefined && closeResult.netTotal !== undefined && (
                <>
                  <SummaryRow label={t('cash.dayTotal')} value={formatCurrency(closeResult.salesTotal)} />
                  {closeResult.expenses > 0 && (
                    <SummaryRow label={t('cash.expenses')} value={`- ${formatCurrency(closeResult.expenses)}`} />
                  )}
                  <SummaryRow label={t('cash.netAfterExpenses')} value={formatCurrency(closeResult.netTotal)} />
                  <div className="my-1 border-t" />
                </>
              )}
              <SummaryRow label={t('cash.openingFloat')} value={formatCurrency(closeResult.opening)} />
              <SummaryRow label={t('cash.cashSales')} value={`+ ${formatCurrency(closeResult.cashSales)}`} />
              {closeResult.transfersNet !== undefined && closeResult.transfersNet !== 0 && (
                <SummaryRow
                  label={t('cash.netTransfers')}
                  value={`${closeResult.transfersNet > 0 ? '+' : '-'} ${formatCurrency(Math.abs(closeResult.transfersNet))}`}
                />
              )}
              {closeResult.expenses > 0 && (
                <SummaryRow label={t('cash.expensesDeducted')} value={`- ${formatCurrency(closeResult.expenses)}`} />
              )}
              <div className="my-1 border-t" />
              <SummaryRow label={t('cash.expectedInRegister')} value={formatCurrency(closeResult.expected)} />
              <SummaryRow label={t('cash.countedAmount')} value={formatCurrency(closeResult.counted)} />
              <div className="my-2 border-t" />
              {(() => {
                const diff = closeResult.counted - closeResult.expected;
                const tone = diff === 0 ? 'text-success' : 'text-danger';
                return (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-content-muted">
                      {diff !== 0 && <AlertTriangle className="h-4 w-4 text-danger" />}
                      {t('cash.variance')}
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
                  <h3 className="font-display font-bold text-content">{t('cash.registerOpen')}</h3>
                </div>
                <Badge tone="success">{t('cash.openBadge')}</Badge>
              </div>
              <SummaryRow label={t('cash.openedAt')} value={formatDateTime(register.openedAt)} />
              <SummaryRow label={t('cash.openingFloat')} value={formatCurrency(Number(register.openingAmount))} />

              {/* Détail des encaissements de la session, par moyen de paiement. */}
              <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
                  {t('cash.todayPayments')}
                </p>
                {!summary || summary.byMethod.length === 0 ? (
                  <p className="text-sm text-content-muted">{t('cash.noPayments')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {summary.byMethod.map((m) => {
                      const Icon = methodIcon(m.method);
                      return (
                        <div key={m.method} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-content-muted">
                            <Icon className="h-4 w-4 text-primary" />
                            {paymentMethodLabel(m.method)}
                            <span className="text-xs text-content-faint">· {m.count}</span>
                          </span>
                          <span className="font-medium text-content">{formatCurrency(m.amount)}</span>
                        </div>
                      );
                    })}
                    <div className="mt-1 flex items-center justify-between border-t pt-1.5">
                      <span className="text-sm font-semibold text-content">{t('cash.totalCollected')}</span>
                      <span className="font-display font-bold text-content">{formatCurrency(summary.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content-muted">{t('cash.expensesCount', { count: summary.expensesCount })}</span>
                      <span className="font-medium text-danger">- {formatCurrency(summary.expensesTotal)}</span>
                    </div>
                    {summary.transfersNet !== undefined && summary.transfersNet !== 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-content-muted">{t('cash.netTransfers')}</span>
                        <span className={`font-medium ${summary.transfersNet >= 0 ? 'text-success' : 'text-danger'}`}>
                          {summary.transfersNet > 0 ? '+' : ''}
                          {formatCurrency(summary.transfersNet)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t pt-1.5">
                      <span className="text-sm font-semibold text-content">{t('cash.netAfterExpenses')}</span>
                      <span className="font-display font-bold text-content">{formatCurrency(summary.netTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Détail des dépenses enregistrées pendant la session */}
              {summary && summary.expenses && summary.expenses.length > 0 && (
                <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-danger flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" />
                      {t('cash.sessionExpenses', { count: summary.expenses.length })}
                    </p>
                    <span className="font-display text-xs font-bold text-danger">
                      - {formatCurrency(summary.expensesTotal)}
                    </span>
                  </div>
                  <div className="space-y-1.5 divide-y divide-line/40">
                    {summary.expenses.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between pt-1 text-sm first:pt-0">
                        <div>
                          <span className="font-medium text-content">{exp.label}</span>
                          <span className="block text-xs text-content-faint">
                            {formatDateTime(exp.createdAt)}
                          </span>
                        </div>
                        <span className="font-medium text-danger">- {formatCurrency(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ventes annulées de la session : leurs encaissements restent
                  comptés ci-dessus, il faut donc pouvoir les justifier avant
                  de fermer. */}
              {summary && summary.cancelledCount > 0 && (
                <div className="mt-4 rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t('cash.cancelledSince', { count: summary.cancelledCount })}
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
                              ` · ${s.methods.map((m) => paymentMethodLabel(m)).join(', ')}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-medium text-content">{formatCurrency(s.total)}</span>
                          {s.cashedAmount > 0 && (
                            <span className="block text-xs font-semibold text-danger">
                              {t('cash.cashed', { amount: formatCurrency(s.cashedAmount) })}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    {summary.cancelledCashedTotal > 0 && (
                      <div className="mt-1 flex items-center justify-between border-t border-[color:var(--danger)]/20 pt-1.5">
                        <span className="text-sm font-semibold text-content">
                          {t('cash.cashedOnCancelled')}
                        </span>
                        <span className="font-display font-bold text-danger">
                          {formatCurrency(summary.cancelledCashedTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                  {summary.cancelledCashedTotal > 0 && (
                    <p className="mt-2 text-xs text-content-muted">
                      {t('cash.cancelledHint')}
                    </p>
                  )}
                </div>
              )}

              {canClose ? (
                <div className="mt-4 border-t pt-4">
                  {summary && (
                    <SummaryRow
                      label={t('cash.expectedCash')}
                      value={formatCurrency(summary.expectedCash)}
                    />
                  )}
                  <Field label={t('cash.countedCash')}>
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
                      {t('cash.prefilledHint')}
                    </p>
                  )}
                  <Button
                    className="mt-3 w-full"
                    loading={closeMut.isPending}
                    disabled={closing === ''}
                    onClick={() => closeMut.mutate(register)}
                  >
                    <Lock className="h-4 w-4" /> {t('cash.closeRegister')}
                  </Button>
                  <p className="mt-2 text-xs text-content-faint">
                    {t('cash.varianceHint')}
                  </p>
                </div>
              ) : (
                <p className="mt-4 border-t pt-4 text-sm text-content-muted">
                  {t('cash.noPermissionClose')}
                </p>
              )}
            </div>
          ) : (
            /* Aucune caisse ouverte → ouverture */
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-content">{t('cash.noRegisterOpen')}</h3>
              </div>
              {canOpen ? (
                <>
                  <Field label={t('cash.openingFloatField')}>
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
                    <Unlock className="h-4 w-4" /> {t('cash.openRegister')}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-content-muted">
                  {t('cash.noPermissionOpen')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal d'ajout direct d'une dépense / sortie de caisse */}
      {expenseModalOpen && register && (
        <RegisterExpenseModal
          branchId={register.branchId}
          onClose={() => setExpenseModalOpen(false)}
        />
      )}
    </div>
  );
}

function RegisterExpenseModal({
  branchId,
  onClose,
}: {
  branchId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseCreateInput>({
    resolver: zodResolver(expenseCreateSchema),
    defaultValues: { category: 'SUPPLIES', branchId },
  });

  const mut = useMutation({
    mutationFn: (v: ExpenseCreateInput) => createExpense({ ...v, branchId }),
    onSuccess: () => {
      invalidateFinancialViews(qc);
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={t('cash.expenseModalTitle')} size="sm">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label={t('cash.expenseLabel')}>
          <input
            className="input"
            placeholder={t('cash.expenseLabelPlaceholder')}
            {...register('label')}
          />
          {errors.label && <p className="mt-1 text-xs text-danger">{trFr(errors.label.message)}</p>}
        </Field>
        <Field label={t('cash.category')}>
          <select className="input" {...register('category')}>
            {EXPENSE_CATEGORY_CODES.map((c) => (
              <option key={c} value={c}>
                {expenseCategoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t('cash.amountWithdrawn')} (${CURRENCY_FORMAT[getActiveCurrency() as SupportedCurrency]?.symbol ?? getActiveCurrency()})`}>
          <input
            className="input"
            type="number"
            min={1}
            placeholder="0"
            {...register('amount', { valueAsNumber: true })}
          />
          {errors.amount && <p className="mt-1 text-xs text-danger">{trFr(errors.amount.message)}</p>}
        </Field>
        <Field label={t('cash.noteOptional')}>
          <input className="input" placeholder={t('cash.notePlaceholder')} {...register('notes')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={mut.isPending}>
            {t('cash.saveExpense')}
          </Button>
        </div>
      </form>
    </Modal>
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
