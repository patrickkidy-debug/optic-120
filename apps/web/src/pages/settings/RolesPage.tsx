import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldHalf, Plus, Lock, Save, Trash2 } from 'lucide-react';
import {
  listRoles,
  listPermissions,
  createRole,
  updateRole,
  deleteRole,
  type RoleDto,
} from '../../features/rbac/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader, Button, Modal, Field, Badge, PageLoader } from '../../components/ui';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';

const MODULE_LABELS: Record<string, string> = {
  get dashboard() { return tr('ui.RolesPage.tableauDeBord'); },
  get 'optique.products'() { return tr('ui.RolesPage.optiqueProduits'); },
  get 'optique.stock'() { return tr('ui.RolesPage.optiqueStock'); },
  get 'optique.sales'() { return tr('ui.RolesPage.optiqueVentes'); },
  get 'optique.quotes'() { return tr('ui.RolesPage.optiqueDevis'); },
  get 'optique.cashregister'() { return tr('ui.RolesPage.optiqueCaisses'); },
  get 'optique.customers'() { return tr('ui.RolesPage.optiqueClients'); },
  get 'clinic.patients'() { return tr('ui.RolesPage.cliniquePatients'); },
  get 'clinic.consultations'() { return tr('ui.RolesPage.cliniqueConsultations'); },
  get 'clinic.appointments'() { return tr('ui.RolesPage.cliniqueRendezVous'); },
  get 'clinic.surgeries'() { return tr('ui.RolesPage.cliniqueChirurgies'); },
  get 'hr.employees'() { return tr('ui.RolesPage.personnel'); },
  get 'finance.expenses'() { return tr('ui.RolesPage.financeDepenses'); },
  get 'finance.reports'() { return tr('ui.RolesPage.financeRapports'); },
  get suppliers() { return tr('ui.RolesPage.fournisseurs'); },
  get insurance() { return tr('ui.RolesPage.assurances'); },
  get 'rbac.roles'() { return tr('ui.RolesPage.roles'); },
  get 'rbac.users'() { return tr('ui.RolesPage.utilisateurs'); },
  get 'settings.branches'() { return tr('ui.RolesPage.magasins'); },
  get 'settings.payments'() { return tr('ui.RolesPage.paiements'); },
  get 'audit.logs'() { return tr('ui.RolesPage.audit'); },
};
const PROTECTED = ['admin', 'super_admin'];

export function RolesPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('rbac.roles.create');
  const canUpdate = usePermission('rbac.roles.update');
  const canDelete = usePermission('rbac.roles.delete');

  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const { data: perms } = useQuery({ queryKey: ['permissions'], queryFn: listPermissions });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');

  const selected = roles?.find((r) => r.id === selectedId) ?? null;
  const isProtected = selected ? PROTECTED.includes(selected.code) : false;

  useEffect(() => {
    if (roles && roles.length > 0 && !selectedId) setSelectedId(roles[0].id);
  }, [roles, selectedId]);
  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
  }, [selected]);

  const saveMut = useMutation({
    mutationFn: () => updateRole(selected!.id, { permissions: [...draft] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  function toggle(key: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (isLoading || !roles) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title={tr('ui.RolesPage.rolesPermissions')}
        subtitle={tr('ui.RolesPage.n12RolesMetierPretsA')}
        actions={
          canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {tr('ui.RolesPage.nouveauRole')}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`card flex w-full items-center justify-between p-3 text-left transition ${
                r.id === selectedId ? 'border-primary shadow-glow' : 'hover:border-line-strong'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                  <ShieldHalf className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-content">
                    {trFr(r.name)}
                    {PROTECTED.includes(r.code) && <Lock className="h-3 w-3 text-content-faint" />}
                  </div>
                  <div className="text-xs text-content-faint">{r.permissions.length} {tr('ui.RolesPage.permissions')} {r.userCount} utilisateur(s)</div>
                </div>
              </div>
              {r.isSystem ? <Badge tone="info">{tr('ui.RolesPage.systeme')}</Badge> : <Badge tone="accent">{tr('ui.RolesPage.custom')}</Badge>}
            </button>
          ))}
        </div>

        <div className="card p-5 lg:col-span-2">
          {!selected || !perms ? (
            <p className="text-content-muted">{tr('ui.RolesPage.selectionnezUnRole')}</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-content">{selected.name}</h3>
                  <p className="text-sm text-content-muted">
                    {isProtected
                      ? tr('ui.RolesPage.roleProtegeAccesCompletNon')
                      : tr('ui.RolesPage.cochezLesPermissionsAccordees')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canDelete && selected.isCustom && (
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        if (confirm(tr('ui.RolesPage.supprimerLeRoleName', { name: selected.name }))) deleteMut.mutate(selected.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canUpdate && !isProtected && (
                    <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}>
                      <Save className="h-4 w-4" /> {tr('ui.RolesPage.enregistrer')}
                    </Button>
                  )}
                </div>
              </div>

              {error && <p className="mb-3 text-sm text-danger">{error}</p>}

              <div className="space-y-5">
                {Object.entries(perms.grouped).map(([module, items]) => (
                  <div key={module}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
                      {MODULE_LABELS[module] ?? module}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((p) => {
                        const checked = isProtected || draft.has(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                              checked ? 'border-primary/40 bg-primary-soft' : 'bg-surface-2'
                            } ${isProtected || !canUpdate ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--primary)]"
                              checked={checked}
                              disabled={isProtected || !canUpdate}
                              onChange={() => toggle(p.key)}
                            />
                            <span className="text-content">{trFr(p.label)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {createOpen && <CreateRoleModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateRoleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => createRole(name, []),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={tr('ui.RolesPage.nouveauRole')} size="sm">
      <div className="space-y-4">
        <Field label={tr('ui.RolesPage.nomDuRole')}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('ui.RolesPage.exResponsableAtelier')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr('ui.RolesPage.annuler')}</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={name.trim().length < 2}>
            {tr('ui.RolesPage.creer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
