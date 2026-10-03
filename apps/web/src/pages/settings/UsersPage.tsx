import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserX, Users as UsersIcon, Pencil, KeyRound, Copy, Check } from 'lucide-react';
import { userCreateSchema, type UserCreateInput } from '@oculo/shared-types';
import { listUsers, createUser, updateUser, deactivateUser, resetUserPassword, listRoles, type UserDto } from '../../features/rbac/api';
import { listBranches } from '../../features/optique/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate, initials } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';

export function UsersPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('rbac.users.create');
  const canUpdate = usePermission('rbac.users.update');
  const canDeactivate = usePermission('rbac.users.deactivate');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [resetResult, setResetResult] = useState<{ user: UserDto; tempPassword: string } | null>(null);

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const deactivateMut = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const resetPasswordMut = useMutation({
    mutationFn: resetUserPassword,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title={tr('ui.UsersPage.utilisateurs')}
        subtitle={tr('ui.UsersPage.gerezLesComptesEmployesEt')}
        actions={
          canCreate && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> {tr('ui.UsersPage.nouvelUtilisateur')}
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !users || users.length === 0 ? (
        <EmptyState icon={UsersIcon} title={tr('ui.UsersPage.aucunUtilisateur')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">{tr('ui.UsersPage.employe')}</th>
                <th className="table-cell font-semibold">{tr('ui.UsersPage.role')}</th>
                <th className="table-cell font-semibold">{tr('ui.UsersPage.magasins')}</th>
                <th className="table-cell font-semibold">{tr('ui.UsersPage.statut')}</th>
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
                    <Badge tone="info">{trFr(u.role.name)}</Badge>
                  </td>
                  <td className="table-cell text-sm text-content-muted">
                    {u.branches.map((b) => b.name).join(', ') || '—'}
                  </td>
                  <td className="table-cell">
                    {u.isActive ? <Badge tone="success">{tr('ui.UsersPage.actif')}</Badge> : <Badge tone="danger">{tr('ui.UsersPage.inactif')}</Badge>}
                  </td>
                  <td className="table-cell text-right text-xs text-content-faint">
                    <span className="align-middle">{u.lastLoginAt ? formatDate(u.lastLoginAt) : tr('ui.UsersPage.jamaisConnecte')}</span>
                    {canUpdate && (
                      <button
                        onClick={() => setEditUser(u)}
                        className="btn-ghost ml-2 h-8 w-8 rounded-lg p-0 text-content-muted"
                        title={tr('ui.UsersPage.modifierLeRoleLesMagasins')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canUpdate && u.isActive && (
                      <button
                        onClick={() => {
                          if (confirm(tr('ui.UsersPage.genererUnNouveauMotDe', { firstName: u.firstName, lastName: u.lastName }))) {
                            resetPasswordMut.mutate(u.id, {
                              onSuccess: (res) => setResetResult({ user: u, tempPassword: res.tempPassword }),
                            });
                          }
                        }}
                        className="btn-ghost ml-1 h-8 w-8 rounded-lg p-0 text-content-muted"
                        title={tr('ui.UsersPage.reinitialiserLeMotDePasse')}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    )}
                    {canDeactivate && u.isActive && (
                      <button
                        onClick={() => {
                          if (confirm(tr('ui.UsersPage.desactiverFirstnameLastname', { firstName: u.firstName, lastName: u.lastName }))) deactivateMut.mutate(u.id);
                        }}
                        className="btn-ghost ml-1 h-8 w-8 rounded-lg p-0 text-danger"
                        title={tr('ui.UsersPage.desactiver')}
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
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      {resetResult && (
        <ResetPasswordResultModal
          user={resetResult.user}
          tempPassword={resetResult.tempPassword}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  );
}

/**
 * Affiche le mot de passe temporaire généré UNE SEULE FOIS (il n'est jamais
 * stocké en clair côté serveur). À transmettre soi-même à l'employé —
 * solution fiable tant que l'envoi automatique par email reste aléatoire.
 */
function ResetPasswordResultModal({
  user,
  tempPassword,
  onClose,
}: {
  user: UserDto;
  tempPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible (contexte non sécurisé) : l'utilisateur copie manuellement.
    }
  }

  return (
    <Modal open onClose={onClose} title={tr('ui.UsersPage.motDePasseTemporaire')} size="sm">
      <p className="text-sm text-content-muted">
        {tr('ui.UsersPage.nouveauMotDePassePour')} <b className="text-content">{user.firstName} {user.lastName}</b>{' '}
        ({user.email}{tr('ui.UsersPage.transmettezLeVousMemeWhatsapp')}
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border bg-surface-2 p-3">
        <span className="flex-1 select-all font-mono text-lg font-bold tracking-wider text-content">{tempPassword}</span>
        <button onClick={copy} className="btn-ghost h-9 w-9 rounded-lg p-0" title={tr('ui.UsersPage.copier')}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-3 text-xs text-content-faint">
        Ses sessions actives ont été déconnectées ; il devra se reconnecter avec ce mot de passe.
      </p>
      <Button className="mt-5 w-full" onClick={onClose}>
        {tr('ui.UsersPage.jAiNoteLeMot')}
      </Button>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.role.id);
  const [branchIds, setBranchIds] = useState<string[]>(user.branches.map((b) => b.id));
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

  const toggleBranch = (id: string) =>
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const mut = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        roleId,
        branchIds,
        // Email envoyé seulement s'il change (correction de faute de frappe).
        ...(email.trim() && email.trim() !== user.email ? { email: email.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={tr('ui.UsersPage.modifierFirstnameLastname', { firstName: user.firstName, lastName: user.lastName })}>
      <div className="space-y-4">
        <Field label={tr('ui.UsersPage.emailIdentifiantDeConnexion')}>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-1 text-xs text-content-faint">
            {tr('ui.UsersPage.corrigerUneFauteDeFrappe')}
          </p>
        </Field>
        <Field label={tr('ui.UsersPage.role')}>
          <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>{trFr(r.name)}</option>
            ))}
          </select>
        </Field>
        <Field label={tr('ui.UsersPage.magasinsAssignes')}>
          <div className="space-y-1.5 rounded-xl bg-surface-2 p-2">
            {branches?.map((b) => (
              <label key={b.id} className="flex items-center gap-2 px-1 text-sm text-content">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={branchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                />
                {b.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-content-faint">
            {tr('ui.UsersPage.sansEffetPourLesRoles')}
          </p>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.UsersPage.annuler')}</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending}>{tr('ui.UsersPage.enregistrer')}</Button>
        </div>
      </div>
    </Modal>
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
    <Modal open onClose={onClose} title={tr('ui.UsersPage.nouvelUtilisateur')}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('ui.UsersPage.prenom')}>
            <input className="input" {...register('firstName')} />
            {errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}
          </Field>
          <Field label={tr('ui.UsersPage.nom')}>
            <input className="input" {...register('lastName')} />
            {errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}
          </Field>
        </div>
        <Field label="Email">
          <input className="input" type="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.telephoneWhatsapp')}>
          <input
            className="input"
            type="tel"
            placeholder="+225 07 00 00 00 00"
            {...register('phone')}
          />
          {errors.phone && <p className="mt-1 text-xs text-danger">{errors.phone.message}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.motDePasseTemporaire')}>
          <input className="input" type="text" {...register('password')} placeholder={tr('ui.UsersPage.auMoins8Caracteres')} />
          {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.role')}>
          <select className="input" {...register('roleId')}>
            <option value="">{tr('ui.UsersPage.choisir')}</option>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>{trFr(r.name)}</option>
            ))}
          </select>
          {errors.roleId && <p className="mt-1 text-xs text-danger">{errors.roleId.message}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.magasinsAssignes')}>
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
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.UsersPage.annuler')}</Button>
          <Button type="submit" loading={mut.isPending}>{tr('ui.UsersPage.creer')}</Button>
        </div>
      </form>
    </Modal>
  );
}
