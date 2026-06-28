import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Check, X } from 'lucide-react';
import type { AppointmentCreateInput } from '@oculo/shared-types';
import { listAppointments, createAppointment, updateAppointment, listPatients } from '../../features/clinic/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  SCHEDULED: { label: 'Planifié', tone: 'info' },
  CONFIRMED: { label: 'Confirmé', tone: 'success' },
  COMPLETED: { label: 'Terminé', tone: 'neutral' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
  NO_SHOW: { label: 'Absent', tone: 'warning' },
};

export function AppointmentsPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('clinic.appointments.create');
  const canUpdate = usePermission('clinic.appointments.update');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['appointments'], queryFn: () => listAppointments() });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateAppointment(id, { status: status as AppointmentCreateInput['status'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Rendez-vous"
        subtitle="Agenda des consultations"
        actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouveau rendez-vous</Button>}
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Aucun rendez-vous" />
      ) : (
        <div className="space-y-2">
          {data.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium text-content">
                    {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Patient'}
                  </div>
                  <div className="text-sm text-content-muted">
                    {formatDateTime(a.scheduledAt)} · {a.reason ?? 'Consultation'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS[a.status]?.tone ?? 'neutral'}>{STATUS[a.status]?.label ?? a.status}</Badge>
                {canUpdate && a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && (
                  <>
                    <button onClick={() => statusMut.mutate({ id: a.id, status: 'COMPLETED' })} className="btn-ghost h-8 w-8 rounded-lg p-0 text-success" title="Marquer terminé">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => statusMut.mutate({ id: a.id, status: 'CANCELLED' })} className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger" title="Annuler">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <NewAppointmentModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewAppointmentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data: patients } = useQuery({ queryKey: ['patients', ''], queryFn: () => listPatients() });
  const { register, handleSubmit, formState: { errors } } = useForm<AppointmentCreateInput>();

  const mut = useMutation({
    mutationFn: (v: AppointmentCreateInput) => createAppointment(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Nouveau rendez-vous" size="md">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Patient">
          <select className="input" {...register('patientId', { required: true })}>
            <option value="">— Choisir —</option>
            {patients?.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </Field>
        <Field label="Date et heure">
          <input className="input" type="datetime-local" {...register('scheduledAt', { required: true })} />
          {errors.scheduledAt && <p className="mt-1 text-xs text-danger">Date requise</p>}
        </Field>
        <Field label="Motif"><input className="input" placeholder="Contrôle de la vue" {...register('reason')} /></Field>
        <Field label="Praticien"><input className="input" {...register('practitionerName')} /></Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Planifier</Button>
        </div>
      </form>
    </Modal>
  );
}
