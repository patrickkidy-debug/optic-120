import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog, Pencil } from 'lucide-react';
import { employeeCreateSchema, type EmployeeCreateInput } from '@oculo/shared-types';
import { listEmployees, createEmployee, updateEmployee, type Employee } from '../../features/management/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, initials } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  ACTIVE: { label: 'Actif', tone: 'success' },
  ON_LEAVE: { label: 'En congé', tone: 'warning' },
  TERMINATED: { label: 'Parti', tone: 'danger' },
};

export function EmployeesPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('hr.employees.create');
  const canUpdate = usePermission('hr.employees.update');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['employees'], queryFn: listEmployees });

  return (
    <div>
      <PageHeader
        title="Personnel"
        subtitle="Gestion des ressources humaines"
        actions={canCreate && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvel employé</Button>}
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={UserCog} title="Aucun employé" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Employé</th>
                <th className="table-cell font-semibold">Poste</th>
                <th className="table-cell text-right font-semibold">Salaire</th>
                <th className="table-cell font-semibold">Embauche</th>
                <th className="table-cell font-semibold">Statut</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-xs font-bold text-white">
                        {initials(e.firstName, e.lastName)}
                      </span>
                      <div>
                        <div className="font-medium text-content">{e.firstName} {e.lastName}</div>
                        <div className="text-xs text-content-faint">{e.phone ?? e.email ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-content-muted">{e.position}</td>
                  <td className="table-cell text-right text-content">{e.salary ? formatCurrency(Number(e.salary)) : '—'}</td>
                  <td className="table-cell text-content-muted">{e.hireDate ? formatDate(e.hireDate) : '—'}</td>
                  <td className="table-cell"><Badge tone={STATUS[e.status]?.tone ?? 'success'}>{STATUS[e.status]?.label ?? e.status}</Badge></td>
                  <td className="table-cell text-right">
                    {canUpdate && (
                      <button onClick={() => { setEditing(e); setOpen(true); }} className="btn-ghost h-8 w-8 rounded-lg p-0">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <EmployeeModal employee={editing} onClose={() => setOpen(false)} />}
    </div>
  );
}

function EmployeeModal({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<EmployeeCreateInput>({
    resolver: zodResolver(employeeCreateSchema),
    defaultValues: employee
      ? {
          firstName: employee.firstName,
          lastName: employee.lastName,
          phone: employee.phone ?? '',
          email: employee.email ?? '',
          position: employee.position,
          salary: employee.salary ? Number(employee.salary) : undefined,
          hireDate: employee.hireDate?.slice(0, 10) ?? '',
          status: employee.status as EmployeeCreateInput['status'],
        }
      : { status: 'ACTIVE' },
  });

  const mut = useMutation({
    mutationFn: (v: EmployeeCreateInput) => (employee ? updateEmployee(employee.id, v) : createEmployee(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={employee ? 'Modifier l\'employé' : 'Nouvel employé'}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className="input" {...register('firstName')} />{errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}</Field>
          <Field label="Nom"><input className="input" {...register('lastName')} />{errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}</Field>
        </div>
        <Field label="Poste"><input className="input" {...register('position')} />{errors.position && <p className="mt-1 text-xs text-danger">{errors.position.message}</p>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><input className="input" {...register('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" {...register('email')} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Salaire (FCFA)"><input className="input" type="number" {...register('salary', { valueAsNumber: true })} /></Field>
          <Field label="Embauche"><input className="input" type="date" {...register('hireDate')} /></Field>
          <Field label="Statut">
            <select className="input" {...register('status')}>
              <option value="ACTIVE">Actif</option>
              <option value="ON_LEAVE">En congé</option>
              <option value="TERMINATED">Parti</option>
            </select>
          </Field>
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
