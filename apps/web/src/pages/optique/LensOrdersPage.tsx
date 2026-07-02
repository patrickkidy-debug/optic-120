import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Glasses, Wand2 } from 'lucide-react';
import type { LensOrderCreateInput, LensOrderStatus } from '@oculo/shared-types';
import { LENS_ORDER_STATUSES } from '@oculo/shared-types';
import {
  listLensOrders,
  createLensOrder,
  setLensOrderStatus,
  listCustomers,
} from '../../features/optique/api';
import { apiErrorMessage } from '../../lib/api';
import { usePermission } from '../../store/auth';
import { PageHeader, Button, Field, Modal, Badge, PageLoader, EmptyState } from '../../components/ui';

const STATUS: Record<LensOrderStatus, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  ORDERED: { label: 'Commandé', tone: 'info' },
  RECEIVED: { label: 'Reçu', tone: 'warning' },
  MOUNTED: { label: 'Monté', tone: 'warning' },
  DELIVERED: { label: 'Livré', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

function formatDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('fr-FR') : '—';
}

export function LensOrdersPage() {
  const qc = useQueryClient();
  const canManage = usePermission('optique.sales.create');
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['lens-orders'], queryFn: () => listLensOrders() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['lens-orders'] });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LensOrderStatus }) => setLensOrderStatus(id, status),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Commandes de verres"
        subtitle="Suivi des commandes au laboratoire / fournisseur"
        actions={
          canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(true)}>
                <Wand2 className="h-4 w-4" /> Configurateur
              </Button>
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Nouvelle commande
              </Button>
            </div>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Glasses} title="Aucune commande de verres" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">N°</th>
                <th className="table-cell font-semibold">Client</th>
                <th className="table-cell font-semibold">Description</th>
                <th className="table-cell font-semibold">Fournisseur</th>
                <th className="table-cell font-semibold">Échéance</th>
                <th className="table-cell font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{o.number}</td>
                  <td className="table-cell text-content-muted">
                    {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '—'}
                  </td>
                  <td className="table-cell text-content-muted">{o.description}</td>
                  <td className="table-cell text-content-muted">{o.supplierName ?? '—'}</td>
                  <td className="table-cell text-content-muted">{formatDate(o.expectedAt)}</td>
                  <td className="table-cell">
                    {canManage ? (
                      <select
                        className="input h-8 py-0 text-xs"
                        value={o.status}
                        onChange={(e) => statusMut.mutate({ id: o.id, status: e.target.value as LensOrderStatus })}
                      >
                        {LENS_ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS[s].label}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <LensOrderModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); invalidate(); }} />}
      {configOpen && <ConfiguratorModal onClose={() => setConfigOpen(false)} onCreated={() => { setConfigOpen(false); invalidate(); }} />}
    </div>
  );
}

/* --- Configurateur de verres : calcule un prix et crée la commande --- */
const LENS_TYPES = [
  { id: 'unifocal', label: 'Unifocal', base: 15000 },
  { id: 'progressif', label: 'Progressif', base: 45000 },
  { id: 'degressif', label: 'Dégressif (bureau)', base: 30000 },
] as const;
const LENS_INDEX = [
  { id: '1.5', label: '1.5 (standard)', mult: 1 },
  { id: '1.6', label: '1.6 (aminci)', mult: 1.3 },
  { id: '1.67', label: '1.67 (extra-aminci)', mult: 1.7 },
  { id: '1.74', label: '1.74 (ultra-aminci)', mult: 2.2 },
] as const;
const TREATMENTS = [
  { id: 'ar', label: 'Anti-reflet', price: 5000 },
  { id: 'blue', label: 'Anti-lumière bleue', price: 8000 },
  { id: 'photo', label: 'Photochromique', price: 15000 },
  { id: 'hard', label: 'Durci anti-rayures', price: 3000 },
] as const;

function ConfiguratorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<(typeof LENS_TYPES)[number]['id']>('progressif');
  const [index, setIndex] = useState<(typeof LENS_INDEX)[number]['id']>('1.6');
  const [treats, setTreats] = useState<string[]>(['ar']);
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState('');
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });

  const typeDef = LENS_TYPES.find((t) => t.id === type)!;
  const indexDef = LENS_INDEX.find((i) => i.id === index)!;
  const treatSum = TREATMENTS.filter((t) => treats.includes(t.id)).reduce((s, t) => s + t.price, 0);
  // Prix pour la PAIRE (2 verres).
  const price = Math.round((typeDef.base * indexDef.mult + treatSum) * 2);
  const treatLabels = TREATMENTS.filter((t) => treats.includes(t.id)).map((t) => t.label);
  const description =
    `Verres ${typeDef.label.toLowerCase()} indice ${index}` +
    (treatLabels.length ? ` — ${treatLabels.join(', ')}` : '') +
    ' (paire)';

  const mut = useMutation({
    mutationFn: () => createLensOrder({ customerId: customerId || '', description, cost: price }),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e, 'Création impossible')),
  });

  const toggle = (id: string) =>
    setTreats((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <Modal open onClose={onClose} title="Configurateur de verres">
      <div className="space-y-4">
        <Field label="Type de verres">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {LENS_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Indice (amincissement)">
          <select className="input" value={index} onChange={(e) => setIndex(e.target.value as typeof index)}>
            {LENS_INDEX.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </Field>
        <div>
          <span className="label">Traitements</span>
          <div className="grid grid-cols-2 gap-2">
            {TREATMENTS.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  treats.includes(t.id) ? 'border-primary bg-primary-soft text-content' : 'border-line text-content-muted'
                }`}
              >
                <input type="checkbox" checked={treats.includes(t.id)} onChange={() => toggle(t.id)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <Field label="Client (optionnel)">
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— Aucun —</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </Field>

        <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
          <div className="text-sm text-content-muted">{description}</div>
          <div className="mt-1 font-display text-2xl font-extrabold text-gradient">
            {new Intl.NumberFormat('fr-FR').format(price)} FCFA
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending}>Créer la commande</Button>
        </div>
      </div>
    </Modal>
  );
}

function LensOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { register, handleSubmit } = useForm<LensOrderCreateInput>();
  const [error, setError] = useState('');
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });
  const mut = useMutation({
    mutationFn: (v: LensOrderCreateInput) => createLensOrder(v),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e, 'Création impossible')),
  });

  return (
    <Modal open onClose={onClose} title="Nouvelle commande de verres">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label="Client (optionnel)">
          <select className="input" {...register('customerId')}>
            <option value="">— Aucun —</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input className="input" placeholder="Ex : Verres progressifs 1.6 anti-reflet" {...register('description')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fournisseur / labo"><input className="input" {...register('supplierName')} /></Field>
          <Field label="Échéance"><input className="input" type="date" {...register('expectedAt')} /></Field>
        </div>
        <Field label="Coût (FCFA)"><input className="input" type="number" min={0} {...register('cost')} /></Field>
        <Field label="Notes"><input className="input" {...register('notes')} /></Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Créer la commande</Button>
        </div>
      </form>
    </Modal>
  );
}
