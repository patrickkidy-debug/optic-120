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
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  ACTIVE: { get label() { return tr('ui.EmployeesPage.actif'); }, tone: 'success' },
  ON_LEAVE: { get label() { return tr('ui.EmployeesPage.enConge'); }, tone: 'warning' },
  TERMINATED: { get label() { return tr('ui.EmployeesPage.parti'); }, tone: 'danger' },
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
        title={tr('ui.EmployeesPage.personnel')}
        subtitle={tr('ui.EmployeesPage.gestionDesRessourcesHumaines')}
        actions={canCreate && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> {tr('ui.EmployeesPage.nouvelEmploye')}</Button>}
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={UserCog} title={tr('ui.EmployeesPage.aucunEmploye')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">{tr('ui.EmployeesPage.employe')}</th>
                <th className="table-cell font-semibold">{tr('ui.EmployeesPage.poste')}</th>
                <th className="table-cell text-right font-semibold">{tr('ui.EmployeesPage.salaire')}</th>
                <th className="table-cell font-semibold">{tr('ui.EmployeesPage.embauche')}</th>
                <th className="table-cell font-semibold">{tr('ui.EmployeesPage.statut')}</th>
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
    <Modal open onClose={onClose} title={employee ? tr('ui.EmployeesPage.modifierLEmploye') : tr('ui.EmployeesPage.nouvelEmploye')}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('ui.EmployeesPage.prenom')}><input className="input" {...register('firstName')} />{errors.firstName && <p className="mt-1 text-xs text-danger">{trFr(errors.firstName.message)}</p>}</Field>
          <Field label={tr('ui.EmployeesPage.nom')}><input className="input" {...register('lastName')} />{errors.lastName && <p className="mt-1 text-xs text-danger">{trFr(errors.lastName.message)}</p>}</Field>
        </div>
        <Field label={tr('ui.EmployeesPage.poste')}><input className="input" {...register('position')} />{errors.position && <p className="mt-1 text-xs text-danger">{trFr(errors.position.message)}</p>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('ui.EmployeesPage.telephone')}><input className="input" {...register('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" {...register('email')} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={tr('ui.EmployeesPage.salaireFcfa')}><input className="input" type="number" {...register('salary', { valueAsNumber: true })} /></Field>
          <Field label={tr('ui.EmployeesPage.embauche')}><input className="input" type="date" {...register('hireDate')} /></Field>
          <Field label={tr('ui.EmployeesPage.statut')}>
            <select className="input" {...register('status')}>
              <option value="ACTIVE">{tr('ui.EmployeesPage.actif')}</option>
              <option value="ON_LEAVE">{tr('ui.EmployeesPage.enConge')}</option>
              <option value="TERMINATED">{tr('ui.EmployeesPage.parti')}</option>
            </select>
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.EmployeesPage.annuler')}</Button>
          <Button type="submit" loading={mut.isPending}>{tr('ui.EmployeesPage.enregistrer')}</Button>
        </div>
      </form>
    </Modal>
  );
}
