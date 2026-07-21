import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, UserPlus, Glasses, Plus } from 'lucide-react';
import {
  customerCreateSchema,
  type CustomerCreateInput,
  LENS_BASES,
  LENS_TREATMENTS,
  computeLensPrice,
  type LensBaseKey,
  type LensTreatmentKey,
  type LensPricing,
} from '@oculo/shared-types';
import { listCustomers, createCustomer, ensureLensProduct, type Customer } from './api';
import { Button, Modal, Field } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/format';

/**
 * Sélecteur de client par recherche (nom ou téléphone), avec création à la volée.
 * Remplace le menu déroulant : on tape, on choisit, on peut créer sans quitter la vente.
 */
export function CustomerSearch({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null, c?: Customer) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });
  const selected = customers?.find((c) => c.id === value) ?? null;

  const filtered = (customers ?? [])
    .filter((c) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return `${c.firstName} ${c.lastName}`.toLowerCase().includes(s) || (c.phone ?? '').includes(s);
    })
    .slice(0, 8);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-xl border bg-surface-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-content">
            {selected.firstName} {selected.lastName}
          </p>
          {selected.phone && <p className="text-xs text-content-faint">{selected.phone}</p>}
        </div>
        <button type="button" className="btn-ghost h-7 w-7 rounded-lg p-0" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input
          className="input pl-9"
          placeholder="Rechercher un client (nom, téléphone)…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-surface shadow-card-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-content-faint">Aucun client trouvé</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id, c);
                  setOpen(false);
                  setQ('');
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="text-content">
                  {c.firstName} {c.lastName}
                </span>
                {c.phone && <span className="text-xs text-content-faint">{c.phone}</span>}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-medium text-primary hover:bg-surface-2"
          >
            <UserPlus className="h-4 w-4" /> Nouveau client
          </button>
        </div>
      )}
      {creating && (
        <NewCustomerModal
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            qc.invalidateQueries({ queryKey: ['customers'] });
            onChange(c.id, c);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function NewCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Customer) => void;
}) {
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerCreateInput>({ resolver: zodResolver(customerCreateSchema) });

  const mut = useMutation({
    mutationFn: (v: CustomerCreateInput) => createCustomer(v),
    onSuccess: (c) => onCreated(c),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Nouveau client" size="sm">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
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
        <Field label="Téléphone (optionnel)">
          <input className="input" {...register('phone')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Composeur de verre à la carte : type de base + traitements, prix exact tiré
 * des Réglages. « Ajouter » crée/réutilise le produit verre et l'ajoute au panier.
 */
export function LensComposer({
  pricing,
  onAdd,
}: {
  pricing: LensPricing;
  onAdd: (line: { productId: string; name: string; sku: string; unitPrice: number }) => void;
}) {
  const [base, setBase] = useState<LensBaseKey | ''>('');
  const [treatments, setTreatments] = useState<LensTreatmentKey[]>([]);
  const [error, setError] = useState('');
  const price = base ? computeLensPrice(pricing, base, treatments) : 0;

  const mut = useMutation({
    mutationFn: () => ensureLensProduct({ base: base as LensBaseKey, treatments }),
    onSuccess: (p) => {
      onAdd({ productId: p.id, name: p.name, sku: p.sku, unitPrice: Number(p.sellPrice) });
      setBase('');
      setTreatments([]);
      setError('');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-2 rounded-xl border border-primary/25 bg-primary-soft/20 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-content">
        <Glasses className="h-4 w-4 text-primary" /> Verre sur mesure
      </div>
      <select
        className="input"
        value={base}
        onChange={(e) => setBase((e.target.value || '') as LensBaseKey | '')}
      >
        <option value="">— Type de verre —</option>
        {LENS_BASES.map((b) => (
          <option key={b.key} value={b.key}>
            {b.label} — {formatCurrency(pricing[b.key])}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1.5">
        {LENS_TREATMENTS.map((tr) => {
          const on = treatments.includes(tr.key);
          return (
            <button
              key={tr.key}
              type="button"
              onClick={() =>
                setTreatments((s) => (s.includes(tr.key) ? s.filter((x) => x !== tr.key) : [...s, tr.key]))
              }
              className={`badge px-2.5 py-1 text-xs ${on ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}
            >
              {tr.label} +{formatCurrency(pricing[tr.key])}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-content-muted">
          Prix : <b className="text-content">{formatCurrency(price)}</b>
        </span>
        <Button type="button" onClick={() => mut.mutate()} disabled={!base} loading={mut.isPending}>
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
