import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingDown } from 'lucide-react';
import {
  cashTransferCreateSchema,
  expenseCreateSchema,
  TRANSFER_DIRECTION_LABELS,
  type CashTransferCreateInput,
  type ExpenseCreateInput,
} from '@oculo/shared-types';
import {
  listCashTransfers,
  createCashTransfer,
  deleteCashTransfer,
  listExpenses,
  createExpense,
  deleteExpense,
} from '../../features/management/api';
import { listBranches } from '../../features/optique/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, StatCard, PageLoader, EmptyState } from '../../components/ui';

const EXPENSE_CATEGORIES = [
  { value: 'RENT', label: 'Loyer' },
  { value: 'SALARIES', label: 'Salaires' },
  { value: 'ELECTRICITY', label: 'Électricité' },
  { value: 'WATER', label: 'Eau' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'SUPPLIES', label: 'Fournitures' },
  { value: 'MAINTENANCE', label: 'Entretien' },
  { value: 'TAXES', label: 'Taxes' },
  { value: 'OTHER', label: 'Autre' },
];
const expenseCatLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

type Tab = 'transfers' | 'expenses';

/**
 * Dépenses et versements d'une boutique : les charges d'exploitation d'un
 * côté, les mouvements d'argent qui n'en sont pas (apports du propriétaire,
 * retraits vers la banque) de l'autre. Volontairement séparé de la page
 * Finance, qui garde l'analyse (résultat, amortissement, graphiques).
 */
export function CashFlowPage() {
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canCreate = usePermission('finance.expenses.create');
  const canDelete = usePermission('finance.expenses.delete');

  const [tab, setTab] = useState<Tab>('transfers');
  const [transferOpen, setTransferOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const { data: cash, isLoading: loadingCash } = useQuery({
    queryKey: ['cash-transfers', branchId],
    queryFn: () => listCashTransfers(branchId ?? undefined),
  });
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: listExpenses,
  });

  const delTransfer = useMutation({
    mutationFn: deleteCashTransfer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-transfers'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const delExpense = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const expensesTotal = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div>
      <PageHeader
        title="Dépenses / Versements"
        subtitle="Charges de la boutique et mouvements de caisse hors ventes"
        actions={
          canCreate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setExpenseOpen(true)}>
                <Plus className="h-4 w-4" /> Dépense
              </Button>
              <Button onClick={() => setTransferOpen(true)}>
                <Plus className="h-4 w-4" /> Versement
              </Button>
            </div>
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ArrowDownCircle}
          label="Apports (entrées)"
          value={formatCurrency(cash?.totals.in ?? 0)}
          tone="success"
        />
        <StatCard
          icon={ArrowUpCircle}
          label="Retraits (sorties)"
          value={formatCurrency(cash?.totals.out ?? 0)}
          tone="danger"
        />
        <StatCard
          icon={Wallet}
          label="Solde des versements"
          value={formatCurrency(cash?.totals.net ?? 0)}
          tone={(cash?.totals.net ?? 0) >= 0 ? 'primary' : 'danger'}
        />
        <StatCard
          icon={TrendingDown}
          label="Dépenses enregistrées"
          value={formatCurrency(expensesTotal)}
          tone="danger"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b">
        {([
          { key: 'transfers' as Tab, label: 'Versements' },
          { key: 'expenses' as Tab, label: 'Dépenses' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'transfers' ? (
        loadingCash ? (
          <PageLoader />
        ) : !cash || cash.transfers.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Aucun versement enregistré"
            hint="Enregistrez les apports d'argent dans la boutique et les retraits vers la banque ou le propriétaire."
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Libellé</th>
                  <th className="table-cell font-semibold">Sens</th>
                  <th className="table-cell font-semibold">Date</th>
                  <th className="table-cell text-right font-semibold">Montant</th>
                  {canDelete && <th className="table-cell text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {cash.transfers.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <div className="font-medium text-content">{t.label}</div>
                      {t.notes && <div className="text-xs text-content-faint">{t.notes}</div>}
                    </td>
                    <td className="table-cell">
                      <Badge tone={t.direction === 'IN' ? 'success' : 'warning'}>
                        {TRANSFER_DIRECTION_LABELS[t.direction]}
                      </Badge>
                    </td>
                    <td className="table-cell text-content-muted">{formatDate(t.date)}</td>
                    <td
                      className={`table-cell text-right font-semibold ${
                        t.direction === 'IN' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {t.direction === 'IN' ? '+' : '-'} {formatCurrency(Number(t.amount))}
                    </td>
                    {canDelete && (
                      <td className="table-cell text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer le versement « ${t.label} » ?`)) {
                              delTransfer.mutate(t.id);
                            }
                          }}
                          className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : loadingExpenses ? (
        <PageLoader />
      ) : !expenses || expenses.length === 0 ? (
        <EmptyState icon={TrendingDown} title="Aucune dépense enregistrée" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Libellé</th>
                <th className="table-cell font-semibold">Catégorie</th>
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell text-right font-semibold">Montant</th>
                {canDelete && <th className="table-cell text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((x) => (
                <tr key={x.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{x.label}</td>
                  <td className="table-cell">
                    <Badge tone="accent">{expenseCatLabel(x.category)}</Badge>
                  </td>
                  <td className="table-cell text-content-muted">{formatDate(x.date)}</td>
                  <td className="table-cell text-right font-semibold text-danger">
                    - {formatCurrency(Number(x.amount))}
                  </td>
                  {canDelete && (
                    <td className="table-cell text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer la dépense « ${x.label} » ?`)) delExpense.mutate(x.id);
                        }}
                        className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transferOpen && <TransferModal onClose={() => setTransferOpen(false)} />}
      {expenseOpen && <ExpenseModal onClose={() => setExpenseOpen(false)} />}
    </div>
  );
}

function TransferModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CashTransferCreateInput>({
    resolver: zodResolver(cashTransferCreateSchema),
    defaultValues: { direction: 'IN' },
  });

  const mut = useMutation({
    mutationFn: (v: CashTransferCreateInput) => createCashTransfer(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-transfers'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Nouveau versement" size="sm">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Sens du mouvement">
          <select className="input" {...register('direction')}>
            <option value="IN">Apport — argent ajouté à la boutique</option>
            <option value="OUT">Retrait — argent sorti de la boutique</option>
          </select>
        </Field>
        <Field label="Libellé">
          <input className="input" placeholder="Ex : dépôt en banque, apport du gérant" {...register('label')} />
          {errors.label && <p className="mt-1 text-xs text-danger">{errors.label.message}</p>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)">
            <input className="input" type="number" {...register('amount', { valueAsNumber: true })} />
            {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
          </Field>
          <Field label="Date">
            <input className="input" type="date" {...register('date')} />
          </Field>
        </div>
        <Field label="Boutique">
          <select className="input" {...register('branchId')}>
            <option value="">— Toutes / non précisé —</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <input className="input" {...register('notes')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseCreateInput>({
    resolver: zodResolver(expenseCreateSchema),
    defaultValues: { category: 'RENT' },
  });

  const mut = useMutation({
    mutationFn: (v: ExpenseCreateInput) => createExpense(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Nouvelle dépense" size="sm">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Libellé">
          <input className="input" {...register('label')} />
          {errors.label && <p className="mt-1 text-xs text-danger">{errors.label.message}</p>}
        </Field>
        <Field label="Catégorie">
          <select className="input" {...register('category')}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)">
            <input className="input" type="number" {...register('amount', { valueAsNumber: true })} />
            {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
          </Field>
          <Field label="Date">
            <input className="input" type="date" {...register('date')} />
          </Field>
        </div>
        <Field label="Note">
          <input className="input" {...register('notes')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
