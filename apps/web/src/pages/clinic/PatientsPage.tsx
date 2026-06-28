import { useState } from 'react';
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

const GENDERS = [
  { value: 'MALE', label: 'Homme' },
  { value: 'FEMALE', label: 'Femme' },
  { value: 'OTHER', label: 'Autre' },
];

export function PatientsPage() {
  const qc = useQueryClient();
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

  const removeMut = useMutation({
    mutationFn: deletePatient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Dossier médical électronique"
        actions={
          canCreate && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Nouveau patient
            </Button>
          )
        }
      />

      <div className="relative mb-4 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !patients || patients.length === 0 ? (
        <EmptyState icon={UserRound} title="Aucun patient" hint="Enregistrez votre premier patient." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Patient</th>
                <th className="table-cell font-semibold">Téléphone</th>
                <th className="table-cell font-semibold">Naissance</th>
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
                        <FileText className="h-3.5 w-3.5" /> Dossier
                      </button>
                      {canUpdate && (
                        <button onClick={() => { setEditing(p); setModalOpen(true); }} className="btn-ghost h-8 w-8 rounded-lg p-0">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => { if (confirm(`Supprimer ${p.firstName} ${p.lastName} ?`)) removeMut.mutate(p.id); }}
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
    <Modal open onClose={onClose} title={patient ? 'Modifier le patient' : 'Nouveau patient'} size="lg">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <input className="input" {...register('firstName')} />
            {errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}
          </Field>
          <Field label="Nom">
            <input className="input" {...register('lastName')} />
            {errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sexe">
            <select className="input" {...register('gender')}>
              <option value="">—</option>
              {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </Field>
          <Field label="Date de naissance">
            <input className="input" type="date" {...register('dateOfBirth')} />
          </Field>
          <Field label="Groupe sanguin">
            <input className="input" placeholder="O+" {...register('bloodGroup')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone">
            <input className="input" {...register('phone')} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" {...register('email')} />
          </Field>
        </div>
        <Field label="Adresse">
          <input className="input" {...register('address')} />
        </Field>
        <Field label="Allergies">
          <input className="input" {...register('allergies')} />
        </Field>
        <Field label="Antécédents médicaux">
          <textarea className="input min-h-[80px]" {...register('medicalHistory')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
