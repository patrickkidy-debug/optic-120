import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Pencil } from 'lucide-react';
import { insurerCreateSchema, type InsurerCreateInput } from '@oculo/shared-types';
import { listInsurers, createInsurer, updateInsurer, getInsurerUpcoming, type Insurer } from '../../features/management/api';
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
  const canCreate = usePermission('insurance.create');
  const canUpdate = usePermission('insurance.update');
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['insurers'], queryFn: listInsurers });
  // Paiements trimestriels à venir (les assurances règlent chaque trimestre).
  const { data: upcoming } = useQuery({ queryKey: ['insurer-upcoming'], queryFn: getInsurerUpcoming });
  const pendingFor = (id: string) => upcoming?.items.find((x) => x.insurerId === id);

  return (
    <div>
      <PageHeader
        title="Assurances"
        subtitle="Mutuelles, tiers payant et prises en charge"
        actions={canCreate && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle assurance</Button>}
      />

      {upcoming && upcoming.total > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary-soft/25 p-3">
          <p className="text-sm text-content">
            <span className="font-semibold">Paiements à venir ce trimestre :</span>{' '}
            {formatCurrency(upcoming.total)}
          </p>
          <Badge tone="info">Échéance : {formatDate(upcoming.dueDate)}</Badge>
        </div>
      )}

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
                  <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
                    <span className="text-content-muted">En attente ce trimestre : </span>
                    <span className="font-semibold text-content">{formatCurrency(p.amount)}</span>
                    <span className="text-content-faint"> · {p.salesCount} vente(s)</span>
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
    </div>
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
            <input className="input" type="number" min={0} max={100} {...register('coveragePercent', { valueAsNumber: true })} />
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
