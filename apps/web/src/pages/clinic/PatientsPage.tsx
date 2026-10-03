import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, FileText, Trash2, UserRound } from 'lucide-react';
import { patientCreateSchema, type PatientCreateInput } from '@oculo/shared-types';
import {
  listPatients,
  createPatient,
  updatePatient,
  deletePatient,
  type Patient,
} from '../../features/clinic/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { PatientRecord } from './PatientRecord';
import { tr } from '../../lib/tr';

const GENDERS = [
  { value: 'MALE', get label() { return tr('ui.PatientsPage.homme'); } },
  { value: 'FEMALE', get label() { return tr('ui.PatientsPage.femme'); } },
  { value: 'OTHER', get label() { return tr('ui.PatientsPage.autre'); } },
];

export function PatientsPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const canCreate = usePermission('clinic.patients.create');
  const canUpdate = usePermission('clinic.patients.update');
  const canDelete = usePermission('clinic.patients.delete');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Patient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => listPatients(search || undefined),
  });

  useEffect(() => {
    const patientId = (location.state as { openPatientId?: string } | null)?.openPatientId;
    if (patientId) setRecordId(patientId);
  }, [location.state]);

  const removeMut = useMutation({
    mutationFn: deletePatient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={tr('ui.PatientsPage.dossierMedicalElectronique')}
        actions={
          canCreate && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> {tr('ui.PatientsPage.nouveauPatient')}
            </Button>
          )
        }
      />

      <div className="relative mb-4 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input className="input pl-9" placeholder={tr('ui.PatientsPage.rechercher')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !patients || patients.length === 0 ? (
        <EmptyState icon={UserRound} title={tr('ui.PatientsPage.aucunPatient')} hint={tr('ui.PatientsPage.enregistrezVotrePremierPatient')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Patient</th>
                <th className="table-cell font-semibold">{tr('ui.PatientsPage.telephone')}</th>
                <th className="table-cell font-semibold">{tr('ui.PatientsPage.naissance')}</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-medium text-content">{p.firstName} {p.lastName}</div>
                        <div className="text-xs text-content-faint">
                          {p.gender ? GENDERS.find((g) => g.value === p.gender)?.label : '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-content-muted">{p.phone ?? '—'}</td>
                  <td className="table-cell text-content-muted">{p.dateOfBirth ? formatDate(p.dateOfBirth) : '—'}</td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setRecordId(p.id)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                        <FileText className="h-3.5 w-3.5" /> {tr('ui.PatientsPage.dossier')}
                      </button>
                      {canUpdate && (
                        <button onClick={() => { setEditing(p); setModalOpen(true); }} className="btn-ghost h-8 w-8 rounded-lg p-0">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => { if (confirm(tr('ui.PatientsPage.supprimerFirstnameLastname', { firstName: p.firstName, lastName: p.lastName }))) removeMut.mutate(p.id); }}
                          className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <PatientModal patient={editing} onClose={() => setModalOpen(false)} />}
      {recordId && <PatientRecord patientId={recordId} onClose={() => setRecordId(null)} />}
    </div>
  );
}

function PatientModal({ patient, onClose }: { patient: Patient | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientCreateInput>({
    resolver: zodResolver(patientCreateSchema),
    defaultValues: patient
      ? {
          firstName: patient.firstName,
          lastName: patient.lastName,
          gender: (patient.gender as PatientCreateInput['gender']) ?? undefined,
          dateOfBirth: patient.dateOfBirth?.slice(0, 10) ?? '',
          phone: patient.phone ?? '',
          email: patient.email ?? '',
          address: patient.address ?? '',
          bloodGroup: patient.bloodGroup ?? '',
          allergies: patient.allergies ?? '',
          medicalHistory: patient.medicalHistory ?? '',
        }
      : {},
  });

  const mut = useMutation({
    mutationFn: (v: PatientCreateInput) => (patient ? updatePatient(patient.id, v) : createPatient(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patients'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={patient ? tr('ui.PatientsPage.modifierLePatient') : tr('ui.PatientsPage.nouveauPatient')} size="lg">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('ui.PatientsPage.prenom')}>
            <input className="input" {...register('firstName')} />
            {errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}
          </Field>
          <Field label={tr('ui.PatientsPage.nom')}>
            <input className="input" {...register('lastName')} />
            {errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={tr('ui.PatientsPage.sexe')}>
            <select className="input" {...register('gender')}>
              <option value="">—</option>
              {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </Field>
          <Field label={tr('ui.PatientsPage.dateDeNaissance')}>
            <input className="input" type="date" {...register('dateOfBirth')} />
          </Field>
          <Field label={tr('ui.PatientsPage.groupeSanguin')}>
            <input className="input" placeholder="O+" {...register('bloodGroup')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('ui.PatientsPage.telephone')}>
            <input className="input" {...register('phone')} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" {...register('email')} />
          </Field>
        </div>
        <Field label={tr('ui.PatientsPage.adresse')}>
          <input className="input" {...register('address')} />
        </Field>
        <Field label={tr('ui.PatientsPage.allergies')}>
          <input className="input" {...register('allergies')} />
        </Field>
        <Field label={tr('ui.PatientsPage.antecedentsMedicaux')}>
          <textarea className="input min-h-[80px]" {...register('medicalHistory')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.PatientsPage.annuler')}</Button>
          <Button type="submit" loading={mut.isPending}>{tr('ui.PatientsPage.enregistrer')}</Button>
        </div>
      </form>
    </Modal>
  );
}
