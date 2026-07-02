import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wrench } from 'lucide-react';
import type { RepairCreateInput, RepairStatus } from '@oculo/shared-types';
import { REPAIR_STATUSES } from '@oculo/shared-types';
import { listRepairs, createRepair, setRepairStatus, listCustomers } from '../../features/optique/api';
import { apiErrorMessage } from '../../lib/api';
import { usePermission } from '../../store/auth';
import { PageHeader, Button, Field, Modal, Badge, PageLoader, EmptyState } from '../../components/ui';

const STATUS: Record<RepairStatus, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  RECEIVED: { label: 'Reçu', tone: 'info' },
  IN_PROGRESS: { label: 'En cours', tone: 'warning' },
  READY: { label: 'Prêt', tone: 'success' },
  DELIVERED: { label: 'Livré', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

export function RepairsPage() {
  const qc = useQueryClient();
  const canManage = usePermission('optique.sales.create');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['repairs'], queryFn: () => listRepairs() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['repairs'] });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RepairStatus }) => setRepairStatus(id, status),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="SAV & réparations"
        subtitle="Suivi des réparations de montures et équipements"
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Nouvelle réparation
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Wrench} title="Aucune réparation" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">N°</th>
                <th className="table-cell font-semibold">Client</th>
                <th className="table-cell font-semibold">Description</th>
                <th className="table-cell font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{r.number}</td>
                  <td className="table-cell text-content-muted">
                    {r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : '—'}
                  </td>
                  <td className="table-cell text-content-muted">{r.description}</td>
                  <td className="table-cell">
                    {canManage ? (
                      <select
                        className="input h-8 py-0 text-xs"
                        value={r.status}
                        onChange={(e) => statusMut.mutate({ id: r.id, status: e.target.value as RepairStatus })}
                      >
                        {REPAIR_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS[s].label}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <RepairModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); invalidate(); }} />}
    </div>
  );
}

function RepairModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { register, handleSubmit } = useForm<RepairCreateInput>();
  const [error, setError] = useState('');
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });
  const mut = useMutation({
    mutationFn: (v: RepairCreateInput) => createRepair(v),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e, 'Création impossible')),
  });

  return (
    <Modal open onClose={onClose} title="Nouvelle réparation">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Client (optionnel)">
          <select className="input" {...register('customerId')}>
            <option value="">— Aucun —</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </Field>
        <Field label="Description du problème">
          <input className="input" placeholder="Ex : Branche cassée, changement de vis…" {...register('description')} />
        </Field>
        <Field label="Coût estimé (FCFA)"><input className="input" type="number" min={0} {...register('cost')} /></Field>
        <Field label="Notes"><input className="input" {...register('notes')} /></Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Créer la réparation</Button>
        </div>
      </form>
    </Modal>
  );
}
