import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, Banknote, Target } from 'lucide-react';
import { expenseCreateSchema, type ExpenseCreateInput } from '@oculo/shared-types';
import {
  listExpenses,
  createExpense,
  deleteExpense,
  getFinanceSummary,
} from '../../features/management/api';
import { getBranding, updateBranding } from '../../features/settings/api';
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

      {canCreate && <PaybackCard monthlyNet={summary?.net ?? 0} />}

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

/**
 * Projection d'amortissement de l'investissement initial.
 *
 * Rythme = résultat net du mois en cours. C'est une estimation « au rythme
 * actuel » : un mois exceptionnel (bon ou mauvais) déplace la projection. À
 * lire comme un ordre de grandeur, pas comme une garantie.
 */
function PaybackCard({ monthlyNet }: { monthlyNet: number }) {
  const qc = useQueryClient();
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding });
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (branding && !hydrated) {
      setAmount(branding.initialInvestment ? String(branding.initialInvestment) : '');
      setHydrated(true);
    }
  }, [branding, hydrated]);

  const investment = Number(amount) || 0;
  const months = investment > 0 && monthlyNet > 0 ? investment / monthlyNet : null;
  const recoupDate =
    months != null ? new Date(Date.now() + months * 30 * 24 * 3600 * 1000) : null;

  async function save() {
    setBusy(true);
    try {
      await updateBranding({ initialInvestment: investment });
      qc.invalidateQueries({ queryKey: ['branding'] });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-6 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-content">Amortissement de l'investissement</h3>
      </div>
      <p className="mb-4 text-xs text-content-faint">
        Estimation du temps nécessaire pour récupérer votre investissement de départ,
        au rythme du résultat net actuel.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Investissement initial">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              className="input text-right"
              placeholder="Ex : 5 000 000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button onClick={save} loading={busy}>Enregistrer</Button>
          </div>
        </Field>

        <div className="flex flex-col justify-center rounded-xl bg-surface-2 p-4">
          {investment <= 0 ? (
            <p className="text-sm text-content-muted">
              Saisissez votre investissement pour voir la projection.
            </p>
          ) : monthlyNet <= 0 ? (
            <p className="text-sm text-danger">
              Résultat net négatif ce mois : amortissement non calculable au rythme actuel.
            </p>
          ) : (
            <>
              <div className="text-sm text-content-muted">Récupéré dans environ</div>
              <div className="font-display text-2xl font-extrabold text-content">
                {Math.ceil(months!)} mois
                <span className="ml-2 text-sm font-normal text-content-muted">
                  (~{(months! / 12).toFixed(1)} ans)
                </span>
              </div>
              {recoupDate && (
                <div className="mt-1 text-xs text-content-faint">
                  soit vers {recoupDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </div>
              )}
              <div className="mt-2 text-xs text-content-faint">
                Au rythme de {formatCurrency(monthlyNet)} de résultat net par mois.
              </div>
            </>
          )}
        </div>
      </div>
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
