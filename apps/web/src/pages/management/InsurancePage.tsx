import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Pencil, CheckCircle2 } from 'lucide-react';
import { insurerCreateSchema, type InsurerCreateInput } from '@oculo/shared-types';
import { listInsurers, createInsurer, updateInsurer, getInsurerUpcoming, markInsurancePaid, type Insurer } from '../../features/management/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

const TYPES = [
  { value: 'HEALTH_INSURANCE', label: 'Assurance maladie' },
  { value: 'MUTUAL', label: 'Mutuelle' },
  { value: 'PRIVATE', label: 'Assurance privée' },
  { value: 'THIRD_PARTY', label: 'Tiers payant' },
];
const typeLabel = (v: string) => TYPES.find((t) => t.value === v)?.label ?? v;

export function InsurancePage() {
  const qc = useQueryClient();
  const canCreate = usePermission('insurance.create');
  const canUpdate = usePermission('insurance.update');
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [open, setOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<{ insurerId: string; name: string; amount: number } | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, isLoading } = useQuery({ queryKey: ['insurers'], queryFn: listInsurers });
  const { data: upcoming } = useQuery({ queryKey: ['insurer-upcoming', month], queryFn: () => getInsurerUpcoming(month) });
  const pendingFor = (id: string) => upcoming?.items.find((x) => x.insurerId === id);
  const paymentMut = useMutation({
    mutationFn: ({ insurerId, monthStart, amount }: { insurerId: string; monthStart: string; amount?: number }) =>
      markInsurancePaid(insurerId, monthStart, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurer-upcoming'] });
      qc.invalidateQueries({ queryKey: ['insurance-summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setPaymentFor(null);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Assurances"
        subtitle="Mutuelles, tiers payant et prises en charge"
        actions={canCreate && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle assurance</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary-soft/25 p-3">
        <div>
          <p className="text-sm font-semibold text-content">Remboursements assurance par mois</p>
          <p className="text-xs text-content-muted">Saisissez le montant réellement reçu dès réception.</p>
        </div>
        <input aria-label="Mois de remboursement" className="input h-9 w-auto" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {upcoming && (
          <Badge tone="info">
            À recevoir : {formatCurrency(upcoming.total)} · reçu : {formatCurrency(upcoming.receivedTotal ?? 0)} · échéance {formatDate(upcoming.dueDate)}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Aucune assurance" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((i) => (
            <div key={i.id} className="card p-5">
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--success)]/15 text-success">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <Badge tone="info">{typeLabel(i.type)}</Badge>
              </div>
              <h3 className="mt-3 font-display font-bold text-content">{i.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold text-success">{i.coveragePercent}%</span>
                <span className="text-xs text-content-muted">de prise en charge</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-content-faint">
                {i.phone && <p>{i.phone}</p>}
                {i.email && <p>{i.email}</p>}
              </div>
              {(() => {
                const p = pendingFor(i.id);
                return p ? (
                  <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-2 text-xs">
                    <div>
                      <span className="text-content-muted">Restant ce mois : </span>
                      <span className="font-semibold text-content">{formatCurrency(p.remainingAmount ?? p.amount)}</span>
                      <span className="text-content-faint"> · {p.salesCount} vente(s)</span>
                    </div>
                    <div className="mt-1 text-content-faint">
                      Attendu : {formatCurrency(p.expectedAmount ?? p.amount)}
                      {(p.receivedAmount ?? 0) > 0 ? ` · Reçu : ${formatCurrency(p.receivedAmount)}` : ''}
                    </div>
                    {canUpdate && upcoming && (
                      <button
                        onClick={() => setPaymentFor({ insurerId: i.id, name: i.name, amount: p.remainingAmount ?? p.amount })}
                        disabled={paymentMut.isPending}
                        className="btn-outline mt-2 h-7 w-full rounded-md text-xs text-success disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Saisir un montant reçu
                      </button>
                    )}
                  </div>
                ) : null;
              })()}
              {canUpdate && (
                <button onClick={() => { setEditing(i); setOpen(true); }} className="btn-outline mt-3 h-8 w-full rounded-lg text-xs">
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open && <InsurerModal insurer={editing} onClose={() => setOpen(false)} />}
      {paymentFor && upcoming && (
        <InsurancePaymentModal
          insurerName={paymentFor.name}
          maxAmount={paymentFor.amount}
          loading={paymentMut.isPending}
          onClose={() => setPaymentFor(null)}
          onSubmit={(amount) =>
            paymentMut.mutate({ insurerId: paymentFor.insurerId, monthStart: upcoming.monthStart, amount })
          }
        />
      )}
    </div>
  );
}

function InsurancePaymentModal({
  insurerName,
  maxAmount,
  loading,
  onClose,
  onSubmit,
}: {
  insurerName: string;
  maxAmount: number;
  loading: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(() => String(Math.round(maxAmount)));
  const parsed = Number(amount);
  const invalid = !Number.isFinite(parsed) || parsed <= 0 || parsed > maxAmount;

  return (
    <Modal open onClose={onClose} title={`Paiement reçu — ${insurerName}`} size="sm">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) onSubmit(parsed);
        }}
      >
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-content-muted">Restant à recevoir</span>
            <span className="font-display font-bold text-content">{formatCurrency(maxAmount)}</span>
          </div>
        </div>
        <Field label="Montant reçu">
          <input
            className="input"
            type="number"
            min="1"
            max={maxAmount}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          {invalid && <p className="mt-1 text-xs text-danger">Saisissez un montant entre 1 et {formatCurrency(maxAmount)}.</p>}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={loading} disabled={invalid}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function InsurerModal({ insurer, onClose }: { insurer: Insurer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<InsurerCreateInput>({
    resolver: zodResolver(insurerCreateSchema),
    defaultValues: insurer
      ? {
          name: insurer.name,
          type: insurer.type as InsurerCreateInput['type'],
          coveragePercent: insurer.coveragePercent,
          phone: insurer.phone ?? '',
          email: insurer.email ?? '',
          notes: insurer.notes ?? '',
        }
      : { type: 'HEALTH_INSURANCE', coveragePercent: 80 },
  });

  const mut = useMutation({
    mutationFn: (v: InsurerCreateInput) => (insurer ? updateInsurer(insurer.id, v) : createInsurer(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurers'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={insurer ? 'Modifier l\'assurance' : 'Nouvelle assurance'}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Nom"><input className="input" {...register('name')} />{errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" {...register('type')}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Prise en charge (%)">
            <select className="input" {...register('coveragePercent', { valueAsNumber: true })}>
              {Array.from({ length: 101 }, (_, i) => (
                <option key={i} value={i}>
                  {i} %
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><input className="input" {...register('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" {...register('email')} /></Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
