import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Scissors, Plus, CheckCircle2 } from 'lucide-react';
import type { SurgeryCreateInput } from '@oculo/shared-types';
import { listSurgeries, createSurgery, updateSurgery, listPatients } from '../../features/clinic/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' | 'info' }> = {
  PLANNED: { label: 'Planifiée', tone: 'info' },
  DONE: { label: 'Réalisée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
};
const EYES: Record<string, string> = { OD: 'Œil droit', OG: 'Œil gauche', OU: 'Les deux yeux' };

export function SurgeriesPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('clinic.surgeries.create');
  const canUpdate = usePermission('clinic.surgeries.update');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['surgeries'], queryFn: () => listSurgeries() });

  const doneMut = useMutation({
    mutationFn: (id: string) => updateSurgery(id, { status: 'DONE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surgeries'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Chirurgies"
        subtitle="Interventions & suivi postopératoire"
        actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Planifier</Button>}
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Scissors} title="Aucune chirurgie planifiée" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Patient</th>
                <th className="table-cell font-semibold">Intervention</th>
                <th className="table-cell font-semibold">Œil</th>
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell font-semibold">Statut</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">
                    {s.patient ? `${s.patient.firstName} ${s.patient.lastName}` : '—'}
                  </td>
                  <td className="table-cell text-content-muted">{s.type}</td>
                  <td className="table-cell text-content-muted">{EYES[s.eye] ?? s.eye}</td>
                  <td className="table-cell text-content-muted">{s.scheduledAt ? formatDate(s.scheduledAt) : '—'}</td>
                  <td className="table-cell"><Badge tone={STATUS[s.status]?.tone ?? 'neutral'}>{STATUS[s.status]?.label ?? s.status}</Badge></td>
                  <td className="table-cell text-right">
                    {canUpdate && s.status === 'PLANNED' && (
                      <button onClick={() => doneMut.mutate(s.id)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Réalisée
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <NewSurgeryModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewSurgeryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data: patients } = useQuery({ queryKey: ['patients', ''], queryFn: () => listPatients() });
  const { register, handleSubmit, formState: { errors } } = useForm<SurgeryCreateInput>({ defaultValues: { eye: 'OU' } });

  const mut = useMutation({
    mutationFn: (v: SurgeryCreateInput) => createSurgery(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surgeries'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Planifier une chirurgie" size="md">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Patient">
          <select className="input" {...register('patientId', { required: true })}>
            <option value="">— Choisir —</option>
            {patients?.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </Field>
        <Field label="Type d'intervention">
          <input className="input" placeholder="Cataracte, glaucome…" {...register('type', { required: true })} />
          {errors.type && <p className="mt-1 text-xs text-danger">Type requis</p>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Œil">
            <select className="input" {...register('eye')}>
              <option value="OU">Les deux yeux</option>
              <option value="OD">Œil droit</option>
              <option value="OG">Œil gauche</option>
            </select>
          </Field>
          <Field label="Date prévue"><input className="input" type="date" {...register('scheduledAt')} /></Field>
        </div>
        <Field label="Chirurgien"><input className="input" {...register('surgeonName')} /></Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Planifier</Button>
        </div>
      </form>
    </Modal>
  );
}
