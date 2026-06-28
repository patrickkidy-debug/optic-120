import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stethoscope, CalendarDays, Scissors, Plus, Eye } from 'lucide-react';
import type { ConsultationCreateInput } from '@oculo/shared-types';
import { getPatient, createConsultation } from '../../features/clinic/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { Modal, Button, Badge, PageLoader, Field } from '../../components/ui';

export function PatientRecord({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const canConsult = usePermission('clinic.consultations.create');
  const [adding, setAdding] = useState(false);

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId),
  });

  return (
    <Modal open onClose={onClose} title="Dossier médical" size="lg">
      {isLoading || !patient ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-content">
                  {patient.firstName} {patient.lastName}
                </h3>
                <p className="text-sm text-content-muted">
                  {patient.dateOfBirth ? `Né(e) le ${formatDate(patient.dateOfBirth)}` : 'Date de naissance non renseignée'}
                  {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
                </p>
              </div>
              {canConsult && !adding && (
                <Button onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Consultation
                </Button>
              )}
            </div>
            {patient.allergies && (
              <p className="mt-2 text-sm text-danger">⚠ Allergies : {patient.allergies}</p>
            )}
            {patient.medicalHistory && (
              <p className="mt-1 text-sm text-content-muted">Antécédents : {patient.medicalHistory}</p>
            )}
          </div>

          {adding && (
            <ConsultationForm
              patientId={patientId}
              onClose={() => setAdding(false)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['patient', patientId] });
                qc.invalidateQueries({ queryKey: ['consultations'] });
                setAdding(false);
              }}
            />
          )}

          <Section icon={Stethoscope} title={`Consultations (${patient.consultations.length})`}>
            {patient.consultations.length === 0 ? (
              <p className="text-sm text-content-muted">Aucune consultation.</p>
            ) : (
              patient.consultations.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-content">{formatDateTime(c.date)}</span>
                    {c.diagnosis && <Badge tone="info">{c.diagnosis}</Badge>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-content-muted">
                    {c.visualAcuityRight && <span>AV OD : {c.visualAcuityRight}</span>}
                    {c.visualAcuityLeft && <span>AV OG : {c.visualAcuityLeft}</span>}
                    {c.tonometryRight && <span>TO OD : {c.tonometryRight}</span>}
                    {c.tonometryLeft && <span>TO OG : {c.tonometryLeft}</span>}
                  </div>
                  {c.prescription && (
                    <p className="mt-2 text-xs text-content"><strong>Prescription :</strong> {c.prescription}</p>
                  )}
                </div>
              ))
            )}
          </Section>

          <Section icon={CalendarDays} title={`Rendez-vous (${patient.appointments.length})`}>
            {patient.appointments.length === 0 ? (
              <p className="text-sm text-content-muted">Aucun rendez-vous.</p>
            ) : (
              patient.appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span className="text-content">{formatDateTime(a.scheduledAt)} — {a.reason ?? 'Consultation'}</span>
                  <Badge tone="neutral">{a.status}</Badge>
                </div>
              ))
            )}
          </Section>

          <Section icon={Scissors} title={`Chirurgies (${patient.surgeries.length})`}>
            {patient.surgeries.length === 0 ? (
              <p className="text-sm text-content-muted">Aucune chirurgie.</p>
            ) : (
              patient.surgeries.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span className="text-content">{s.type} ({s.eye})</span>
                  <Badge tone="neutral">{s.status}</Badge>
                </div>
              ))
            )}
          </Section>
        </div>
      )}
    </Modal>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Eye;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-content">{title}</h4>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ConsultationForm({
  patientId,
  onClose,
  onSaved,
}: {
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<ConsultationCreateInput>({
    defaultValues: { patientId },
  });
  const mut = useMutation({
    mutationFn: (v: ConsultationCreateInput) => createConsultation({ ...v, patientId }),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
      <h4 className="flex items-center gap-2 font-semibold text-content">
        <Eye className="h-4 w-4 text-primary" /> Nouvelle consultation ophtalmologique
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Acuité visuelle OD"><input className="input" placeholder="10/10" {...register('visualAcuityRight')} /></Field>
        <Field label="Acuité visuelle OG"><input className="input" placeholder="10/10" {...register('visualAcuityLeft')} /></Field>
        <Field label="Réfraction OD"><input className="input" placeholder="-1.25 (180°)" {...register('refractionRight')} /></Field>
        <Field label="Réfraction OG"><input className="input" placeholder="-1.00 (175°)" {...register('refractionLeft')} /></Field>
        <Field label="Tonométrie OD (mmHg)"><input className="input" placeholder="15" {...register('tonometryRight')} /></Field>
        <Field label="Tonométrie OG (mmHg)"><input className="input" placeholder="16" {...register('tonometryLeft')} /></Field>
      </div>
      <Field label="Biomicroscopie"><textarea className="input min-h-[60px]" {...register('biomicroscopy')} /></Field>
      <Field label="Fond d'œil"><textarea className="input min-h-[60px]" {...register('fundus')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="OCT"><input className="input" {...register('oct')} /></Field>
        <Field label="Champ visuel"><input className="input" {...register('visualField')} /></Field>
      </div>
      <Field label="Diagnostic"><input className="input" {...register('diagnosis')} /></Field>
      <Field label="Prescription"><textarea className="input min-h-[60px]" {...register('prescription')} /></Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mut.isPending}>Enregistrer la consultation</Button>
      </div>
    </form>
  );
}
