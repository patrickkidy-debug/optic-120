import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, Banknote } from 'lucide-react';
import { expenseCreateSchema, type ExpenseCreateInput } from '@oculo/shared-types';
import {
  listExpenses,
  createExpense,
  deleteExpense,
  getFinanceSummary,
} from '../../features/management/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, StatCard, PageLoader, EmptyState } from '../../components/ui';

const CATEGORIES = [
  { value: 'RENT', label: 'Loyer' },
  { value: 'SALARIES', label: 'Salaires' },
  { value: 'ELECTRICITY', label: 'Électricité' },
  { value: 'WATER', label: 'Eau' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'SUPPLIES', label: 'Fournitures' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'TAXES', label: 'Impôts & taxes' },
  { value: 'OTHER', label: 'Divers' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

export function FinancePage() {
  const qc = useQueryClient();
  const canCreate = usePermission('finance.expenses.create');
  const canDelete = usePermission('finance.expenses.delete');
  const [open, setOpen] = useState(false);

  const { data: summary } = useQuery({ queryKey: ['finance-summary'], queryFn: getFinanceSummary });
  const { data: expenses, isLoading } = useQuery({ queryKey: ['expenses'], queryFn: listExpenses });

  const removeMut = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Recettes, dépenses et résultat du mois"
        actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle dépense</Button>}
      />

      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={TrendingUp} label="Recettes du mois" value={formatCurrency(summary.monthRevenue)} tone="success" />
          <StatCard icon={TrendingDown} label="Dépenses du mois" value={formatCurrency(summary.monthExpenses)} tone="danger" />
          <StatCard icon={Wallet} label="Résultat net" value={formatCurrency(summary.net)} tone={summary.net >= 0 ? 'primary' : 'danger'} />
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : !expenses || expenses.length === 0 ? (
        <EmptyState icon={Banknote} title="Aucune dépense enregistrée" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Libellé</th>
                <th className="table-cell font-semibold">Catégorie</th>
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell text-right font-semibold">Montant</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((x) => (
                <tr key={x.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{x.label}</td>
                  <td className="table-cell"><Badge tone="accent">{catLabel(x.category)}</Badge></td>
                  <td className="table-cell text-content-muted">{formatDate(x.date)}</td>
                  <td className="table-cell text-right font-semibold text-content">{formatCurrency(Number(x.amount))}</td>
                  <td className="table-cell text-right">
                    {canDelete && (
                      <button onClick={() => { if (confirm('Supprimer cette dépense ?')) removeMut.mutate(x.id); }} className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <ExpenseModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<ExpenseCreateInput>({
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
        <Field label="Libellé"><input className="input" {...register('label')} />{errors.label && <p className="mt-1 text-xs text-danger">{errors.label.message}</p>}</Field>
        <Field label="Catégorie">
          <select className="input" {...register('category')}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)"><input className="input" type="number" {...register('amount', { valueAsNumber: true })} />{errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}</Field>
          <Field label="Date"><input className="input" type="date" {...register('date')} /></Field>
        </div>
        <Field label="Note"><input className="input" {...register('notes')} /></Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
