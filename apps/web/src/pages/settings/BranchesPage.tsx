import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Store } from 'lucide-react';
import { listBranches, createBranch } from '../../features/optique/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { useSubscriptionPlan } from '../../features/billing/useSubscriptionPlan';
import { useUpgradeModalStore } from '../../store/upgradeModal';

export function BranchesPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('settings.branches.create');
  const { hasFeature } = useSubscriptionPlan();
  const openUpgrade = useUpgradeModalStore((s) => s.open);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');

  const { data: branches, isLoading } = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const canAddBranch = hasFeature('multiBranch');

  const mut = useMutation({
    mutationFn: () => createBranch({ name, city }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setOpen(false);
      setName('');
      setCity('');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Magasins & succursales"
        subtitle="Architecture multi-magasins de votre établissement"
        actions={
          canCreate && (
            <Button onClick={() => (canAddBranch ? setOpen(true) : openUpgrade('multiBranch'))}>
              <Plus className="h-4 w-4" /> Nouveau magasin {!canAddBranch && '🔒'}
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !branches || branches.length === 0 ? (
        <EmptyState icon={Store} title="Aucun magasin" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Store className="h-5 w-5" />
                </span>
                {b.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">Inactif</Badge>}
              </div>
              <h3 className="mt-3 font-display font-bold text-content">{b.name}</h3>
              <p className="text-sm text-content-muted">{b.city || '—'}</p>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Nouveau magasin" size="sm">
          <div className="space-y-4">
            <Field label="Nom du magasin">
              <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Ville">
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={name.trim().length < 2}>
                Créer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
