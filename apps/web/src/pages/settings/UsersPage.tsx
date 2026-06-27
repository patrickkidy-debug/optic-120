import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserX, Users as UsersIcon } from 'lucide-react';
import { userCreateSchema, type UserCreateInput } from '@oculo/shared-types';
import { listUsers, createUser, deactivateUser, listRoles } from '../../features/rbac/api';
import { listBranches } from '../../features/optique/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate, initials } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

export function UsersPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('rbac.users.create');
  const canDeactivate = usePermission('rbac.users.deactivate');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const deactivateMut = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérez les comptes employés et leurs accès"
        actions={
          canCreate && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Nouvel utilisateur
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !users || users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Aucun utilisateur" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Employé</th>
                <th className="table-cell font-semibold">Rôle</th>
                <th className="table-cell font-semibold">Magasins</th>
                <th className="table-cell font-semibold">Statut</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-xs font-bold text-white">
                        {initials(u.firstName, u.lastName)}
                      </span>
                      <div>
                        <div className="font-medium text-content">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-content-faint">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <Badge tone="info">{u.role.name}</Badge>
                  </td>
                  <td className="table-cell text-sm text-content-muted">
                    {u.branches.map((b) => b.name).join(', ') || '—'}
                  </td>
                  <td className="table-cell">
                    {u.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Inactif</Badge>}
                  </td>
                  <td className="table-cell text-right text-xs text-content-faint">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Jamais connecté'}
                    {canDeactivate && u.isActive && (
                      <button
                        onClick={() => {
                          if (confirm(`Désactiver ${u.firstName} ${u.lastName} ?`)) deactivateMut.mutate(u.id);
                        }}
                        className="btn-ghost ml-2 h-8 w-8 rounded-lg p-0 text-danger"
                        title="Désactiver"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <CreateUserModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { branchIds: [] },
  });

  const mut = useMutation({
    mutationFn: (v: UserCreateInput) => createUser(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Nouvel utilisateur">
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
        <Field label="Email">
          <input className="input" type="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
        </Field>
        <Field label="Mot de passe temporaire">
          <input className="input" type="text" {...register('password')} placeholder="Au moins 8 caractères" />
          {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
        </Field>
        <Field label="Rôle">
          <select className="input" {...register('roleId')}>
            <option value="">— Choisir —</option>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {errors.roleId && <p className="mt-1 text-xs text-danger">{errors.roleId.message}</p>}
        </Field>
        <Field label="Magasins assignés">
          <div className="space-y-1.5 rounded-xl bg-surface-2 p-2">
            {branches?.map((b) => (
              <label key={b.id} className="flex items-center gap-2 px-1 text-sm text-content">
                <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" value={b.id} {...register('branchIds')} />
                {b.name}
              </label>
            ))}
          </div>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
}
