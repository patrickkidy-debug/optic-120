import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Contact, Glasses } from 'lucide-react';
import { customerCreateSchema, type CustomerCreateInput } from '@oculo/shared-types';
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  type Customer,
} from '../../features/optique/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader, Button, Modal, Field, PageLoader, EmptyState } from '../../components/ui';
import { ClientRecord } from './ClientRecord';

export function ClientsPage() {
  const canCreate = usePermission('optique.customers.create');
  const canUpdate = usePermission('optique.customers.update');
  const canSeeRx = usePermission('optique.prescriptions.view');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => listCustomers(search || undefined),
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Fichier clients et ordonnances optiques"
        actions={
          canCreate && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Nouveau client
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
      ) : !customers || customers.length === 0 ? (
        <EmptyState
          icon={Contact}
          title="Aucun client"
          hint="Enregistrez votre premier client pour créer ses ordonnances."
          action={canCreate && <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Nouveau client</Button>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Client</th>
                <th className="table-cell font-semibold">Téléphone</th>
                <th className="table-cell font-semibold">Email</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                        <Contact className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-content">{c.firstName} {c.lastName}</span>
                    </div>
                  </td>
                  <td className="table-cell text-content-muted">{c.phone ?? '—'}</td>
                  <td className="table-cell text-content-muted">{c.email ?? '—'}</td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      {canSeeRx && (
                        <button onClick={() => setRecordId(c.id)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                          <Glasses className="h-3.5 w-3.5" /> Ordonnances
                        </button>
                      )}
                      {canUpdate && (
                        <button onClick={() => { setEditing(c); setModalOpen(true); }} className="btn-ghost h-8 w-8 rounded-lg p-0">
                          <Pencil className="h-4 w-4" />
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

      {modalOpen && <CustomerModal customer={editing} onClose={() => setModalOpen(false)} />}
      {recordId && <ClientRecord customerId={recordId} onClose={() => setRecordId(null)} />}
    </div>
  );
}

function CustomerModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerCreateInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: customer
      ? { firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone ?? '', email: customer.email ?? '' }
      : {},
  });

  const mut = useMutation({
    mutationFn: (v: CustomerCreateInput) => (customer ? updateCustomer(customer.id, v) : createCustomer(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={customer ? 'Modifier le client' : 'Nouveau client'}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className="input" {...register('firstName')} />{errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}</Field>
          <Field label="Nom"><input className="input" {...register('lastName')} />{errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><input className="input" {...register('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" {...register('email')} /></Field>
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
