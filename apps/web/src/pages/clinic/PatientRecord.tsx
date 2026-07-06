import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stethoscope, CalendarDays, Scissors, Plus, Eye, Printer, Activity } from 'lucide-react';
import type { ConsultationCreateInput } from '@oculo/shared-types';
import { getPatient, createConsultation, type Consultation } from '../../features/clinic/api';
import { printMedicalPrescription } from '../../features/clinic/clinicDocument';
import type { CompanyInfo } from '../../features/optique/saleDocument';
import { usePermission, useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { Modal, Button, Badge, PageLoader, Field } from '../../components/ui';

export function PatientRecord({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const canConsult = usePermission('clinic.consultations.create');
  const user = useAuthStore((s) => s.user);
  const [adding, setAdding] = useState(false);

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId),
  });

  const company: CompanyInfo = {
    name: user?.tenantName ?? 'OculoSaaS',
    logoUrl: user?.tenantLogoUrl,
    location: user?.tenantLocation,
    contactPhone: user?.tenantContactPhone,
    contactEmail: user?.tenantContactEmail,
    ...user?.tenantInvoiceSettings,
  };

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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-content">{formatDateTime(c.date)}</span>
                    <div className="flex items-center gap-2">
                      {c.diagnosis && <Badge tone="info">{c.diagnosis}</Badge>}
                      <button
                        onClick={() => printMedicalPrescription(c, patient, company)}
                        className="btn-ghost h-7 w-7 rounded-lg p-0"
                        title="Imprimer l'ordonnance"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

          <IopSection consultations={patient.consultations} />

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

/** Suivi de la tension oculaire (TO/IOP) sur l'historique des consultations. */
function IopSection({ consultations }: { consultations: Consultation[] }) {
  const rows = consultations.filter((c) => c.tonometryRight || c.tonometryLeft);
  if (rows.length === 0) return null;
  const val = (v: string | null) => {
    const n = parseFloat((v ?? '').replace(',', '.'));
    const high = Number.isFinite(n) && n > 21;
    return <span className={high ? 'font-bold text-danger' : 'text-content'}>{v ?? '—'}</span>;
  };
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-content">Suivi de la tension oculaire</h4>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-content-faint">
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 text-center font-semibold">TO OD (mmHg)</th>
              <th className="px-3 py-2 text-center font-semibold">TO OG (mmHg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-3 py-2 text-content-muted">{formatDate(c.date)}</td>
                <td className="px-3 py-2 text-center">{val(c.tonometryRight)}</td>
                <td className="px-3 py-2 text-center">{val(c.tonometryLeft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-content-faint">
        Valeurs &gt; 21 mmHg en rouge (risque de glaucome — à surveiller).
      </p>
    </div>
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
