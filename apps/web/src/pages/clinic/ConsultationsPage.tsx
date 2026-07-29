import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stethoscope, Plus, Glasses } from 'lucide-react';
import type { ConsultationCreateInput } from '@oculo/shared-types';
import { lensBaseOptions, lensLabel, DEFAULT_LENS_PRICING } from '@oculo/shared-types';
import { listConsultations, createConsultation, listPatients } from '../../features/clinic/api';
import { usePermission, useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

export function ConsultationsPage() {
  const canCreate = usePermission('clinic.consultations.create');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['consultations'], queryFn: () => listConsultations() });

  return (
    <div>
      <PageHeader
        title="Consultations"
        subtitle="Examens ophtalmologiques"
        actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle consultation</Button>}
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Aucune consultation" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell font-semibold">Patient</th>
                <th className="table-cell font-semibold">Diagnostic</th>
                <th className="table-cell font-semibold">Verres</th>
                <th className="table-cell font-semibold">AV OD / OG</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell text-content-muted">{formatDateTime(c.date)}</td>
                  <td className="table-cell font-medium text-content">
                    {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : '—'}
                  </td>
                  <td className="table-cell">{c.diagnosis ? <Badge tone="info">{c.diagnosis}</Badge> : '—'}</td>
                  <td className="table-cell text-content-muted">{c.lensType ?? '—'}</td>
                  <td className="table-cell text-content-muted">
                    {c.visualAcuityRight ?? '—'} / {c.visualAcuityLeft ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <NewConsultationModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewConsultationModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;
  const lensOptions = lensBaseOptions(pricing);
  const { data: patients } = useQuery({ queryKey: ['patients', ''], queryFn: () => listPatients() });
  const { register, handleSubmit } = useForm<ConsultationCreateInput>();

  const mut = useMutation({
    mutationFn: (v: ConsultationCreateInput) => createConsultation(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consultations'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Nouvelle consultation" size="lg">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Patient">
          <select className="input" {...register('patientId', { required: true })}>
            <option value="">— Choisir —</option>
            {patients?.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Acuité visuelle OD"><input className="input" {...register('visualAcuityRight')} /></Field>
          <Field label="Acuité visuelle OG"><input className="input" {...register('visualAcuityLeft')} /></Field>
          <Field label="Tonométrie OD"><input className="input" {...register('tonometryRight')} /></Field>
          <Field label="Tonométrie OG"><input className="input" {...register('tonometryLeft')} /></Field>
        </div>
        <Field label="Diagnostic"><input className="input" {...register('diagnosis')} /></Field>

        {/* Ordonnance optique : réfraction par œil + type de verres recommandé. */}
        <div className="rounded-xl border border-line bg-surface-2/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-content">
            <Glasses className="h-4 w-4 text-primary" /> Ordonnance
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Réfraction OD (sph/cyl/axe/add)">
              <input className="input" placeholder="ex : -1.25 (-0.50 × 90°) Add +2.00" {...register('refractionRight')} />
            </Field>
            <Field label="Réfraction OG (sph/cyl/axe/add)">
              <input className="input" placeholder="ex : -1.00 (-0.75 × 85°) Add +2.00" {...register('refractionLeft')} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Type de verres recommandé">
              <select className="input" {...register('lensType')}>
                <option value="">— Aucun —</option>
                {lensOptions.map((b) => {
                  const label = lensLabel(pricing, b.key, []);
                  return <option key={b.key} value={label}>{label}</option>;
                })}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Prescription / remarques">
              <textarea className="input min-h-[60px]" {...register('prescription')} />
            </Field>
          </div>
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
