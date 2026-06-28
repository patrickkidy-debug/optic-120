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

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  'optique.products': 'Optique — Produits',
  'optique.stock': 'Optique — Stock',
  'optique.sales': 'Optique — Ventes',
  'optique.quotes': 'Optique — Devis',
  'optique.cashregister': 'Optique — Caisses',
  'optique.customers': 'Optique — Clients',
  'clinic.patients': 'Clinique — Patients',
  'clinic.consultations': 'Clinique — Consultations',
  'clinic.appointments': 'Clinique — Rendez-vous',
  'clinic.surgeries': 'Clinique — Chirurgies',
  'hr.employees': 'Personnel',
  'finance.expenses': 'Finance — Dépenses',
  'finance.reports': 'Finance — Rapports',
  suppliers: 'Fournisseurs',
  insurance: 'Assurances',
  'rbac.roles': 'Rôles',
  'rbac.users': 'Utilisateurs',
  'settings.branches': 'Magasins',
  'settings.payments': 'Paiements',
  'audit.logs': 'Audit',
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
        title="Rôles & permissions"
        subtitle="12 rôles métier prêts à l'emploi, entièrement personnalisables"
        actions={
          canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Nouveau rôle
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
                    {r.name}
                    {PROTECTED.includes(r.code) && <Lock className="h-3 w-3 text-content-faint" />}
                  </div>
                  <div className="text-xs text-content-faint">{r.permissions.length} permissions · {r.userCount} utilisateur(s)</div>
                </div>
              </div>
              {r.isSystem ? <Badge tone="info">Système</Badge> : <Badge tone="accent">Custom</Badge>}
            </button>
          ))}
        </div>

        <div className="card p-5 lg:col-span-2">
          {!selected || !perms ? (
            <p className="text-content-muted">Sélectionnez un rôle.</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-content">{selected.name}</h3>
                  <p className="text-sm text-content-muted">
                    {isProtected
                      ? 'Rôle protégé — accès complet non modifiable'
                      : 'Cochez les permissions accordées'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canDelete && selected.isCustom && (
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        if (confirm(`Supprimer le rôle « ${selected.name} » ?`)) deleteMut.mutate(selected.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canUpdate && !isProtected && (
                    <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}>
                      <Save className="h-4 w-4" /> Enregistrer
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
                            <span className="text-content">{p.label}</span>
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
    <Modal open onClose={onClose} title="Nouveau rôle" size="sm">
      <div className="space-y-4">
        <Field label="Nom du rôle">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Responsable atelier" />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={name.trim().length < 2}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
