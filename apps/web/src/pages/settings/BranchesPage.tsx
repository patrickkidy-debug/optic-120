import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Store } from 'lucide-react';
import { listBranches, createBranch } from '../../features/optique/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { tr } from '../../lib/tr';

export function BranchesPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('settings.branches.create');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');

  const { data: branches, isLoading } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

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
        title={tr('ui.BranchesPage.magasinsSuccursales')}
        subtitle={tr('ui.BranchesPage.architectureMultiMagasinsDeVotre')}
        actions={
          canCreate && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {tr('ui.BranchesPage.nouveauMagasin')}
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !branches || branches.length === 0 ? (
        <EmptyState icon={Store} title={tr('ui.BranchesPage.aucunMagasin')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Store className="h-5 w-5" />
                </span>
                {b.isActive ? <Badge tone="success">{tr('ui.BranchesPage.actif')}</Badge> : <Badge tone="neutral">{tr('ui.BranchesPage.inactif')}</Badge>}
              </div>
              <h3 className="mt-3 font-display font-bold text-content">{b.name}</h3>
              <p className="text-sm text-content-muted">{b.city || '—'}</p>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal open onClose={() => setOpen(false)} title={tr('ui.BranchesPage.nouveauMagasin')} size="sm">
          <div className="space-y-4">
            <Field label={tr('ui.BranchesPage.nomDuMagasin')}>
              <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={tr('ui.BranchesPage.ville')}>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>{tr('ui.BranchesPage.annuler')}</Button>
              <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={name.trim().length < 2}>
                {tr('ui.BranchesPage.creer')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
