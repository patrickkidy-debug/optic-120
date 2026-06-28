import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, Pencil, Globe, MapPin } from 'lucide-react';
import { supplierCreateSchema, type SupplierCreateInput } from '@oculo/shared-types';
import { listSuppliers, createSupplier, updateSupplier, type Supplier } from '../../features/management/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

export function SuppliersPage() {
  const canCreate = usePermission('suppliers.create');
  const canUpdate = usePermission('suppliers.update');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        subtitle="Partenaires locaux et internationaux"
        actions={canCreate && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nouveau fournisseur</Button>}
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Truck} title="Aucun fournisseur" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Truck className="h-5 w-5" />
                </span>
                <Badge tone={s.type === 'INTERNATIONAL' ? 'accent' : 'info'}>
                  {s.type === 'INTERNATIONAL' ? 'International' : 'Local'}
                </Badge>
              </div>
              <h3 className="mt-3 font-display font-bold text-content">{s.name}</h3>
              {s.contactName && <p className="text-sm text-content-muted">{s.contactName}</p>}
              <div className="mt-2 space-y-1 text-xs text-content-faint">
                {s.phone && <p>{s.phone}</p>}
                {s.email && <p className="flex items-center gap-1"><Globe className="h-3 w-3" /> {s.email}</p>}
                {s.address && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.address}</p>}
              </div>
              {canUpdate && (
                <button onClick={() => { setEditing(s); setOpen(true); }} className="btn-outline mt-3 h-8 w-full rounded-lg text-xs">
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open && <SupplierModal supplier={editing} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<SupplierCreateInput>({
    resolver: zodResolver(supplierCreateSchema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          type: supplier.type as SupplierCreateInput['type'],
          contactName: supplier.contactName ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          address: supplier.address ?? '',
          notes: supplier.notes ?? '',
        }
      : { type: 'LOCAL' },
  });

  const mut = useMutation({
    mutationFn: (v: SupplierCreateInput) => (supplier ? updateSupplier(supplier.id, v) : createSupplier(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Nom"><input className="input" {...register('name')} />{errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" {...register('type')}>
              <option value="LOCAL">Local</option>
              <option value="INTERNATIONAL">International</option>
            </select>
          </Field>
          <Field label="Contact"><input className="input" {...register('contactName')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><input className="input" {...register('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" {...register('email')} /></Field>
        </div>
        <Field label="Adresse"><input className="input" {...register('address')} /></Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
