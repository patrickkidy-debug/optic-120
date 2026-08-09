import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, Frame, X, Glasses, CircleDot, Package, Tag, type LucideIcon } from 'lucide-react';
import type { LensOrderCategory } from '@oculo/shared-types';
import {
  LENS_ORDER_CATEGORIES,
  DEFAULT_LENS_PRICING,
  lensBaseOptions,
  lensBaseLabel,
  lensBasePrice,
} from '@oculo/shared-types';
import { createLensOrder, listCustomers, listProducts, type Product } from '../../features/optique/api';
import { apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { formatCurrency } from '../../lib/format';
import { Button, Field, Modal } from '../../components/ui';

const LENS_CAT: Record<LensOrderCategory, { label: string; icon: LucideIcon }> = {
  VERRES: { label: 'Verres', icon: Glasses },
  LENTILLES: { label: 'Lentilles de contact', icon: CircleDot },
  ACCESSOIRE: { label: 'Accessoire', icon: Package },
  MONTURE: { label: 'Monture', icon: Frame },
  AUTRE: { label: 'Autre', icon: Tag },
};

const LENS_INDEX = [
  { id: '1.5', label: '1.5 (standard)', mult: 1 },
  { id: '1.6', label: '1.6 (aminci)', mult: 1.3 },
  { id: '1.67', label: '1.67 (extra-aminci)', mult: 1.7 },
  { id: '1.74', label: '1.74 (ultra-aminci)', mult: 2.2 },
] as const;
const TREATMENTS = [
  { id: 'ar', label: 'Anti-reflet' },
  { id: 'blue', label: 'Anti-lumière bleue' },
  { id: 'photo', label: 'Photochromique' },
  { id: 'hard', label: 'Durci anti-rayures' },
] as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-primary" />
      <h4 className="text-xs font-bold uppercase tracking-wide text-content-muted">{children}</h4>
    </div>
  );
}

/** Recherche compacte d'une monture, pour donner sa photo à la carte Kanban. */
function FramePicker({
  value,
  onChange,
}: {
  value: Product | null;
  onChange: (p: Product | null) => void;
}) {
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['products-frame-pick', search],
    queryFn: () => listProducts({ category: 'MONTURE', search: search || undefined, pageSize: 6 }),
    enabled: search.trim().length > 0,
  });

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-surface-2 p-2">
        <div className="grid h-10 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-3">
          {value.photoUrl ? (
            <img src={value.photoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <Frame className="h-4 w-4 text-content-faint" />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm text-content">
          {value.brand ? `${value.brand} · ` : ''}
          {value.name}
        </span>
        <button type="button" onClick={() => onChange(null)} className="btn-ghost h-7 w-7 shrink-0 rounded-lg p-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input
          className="input pl-9"
          placeholder="Rechercher une monture à associer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search.trim() && (
        <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
          {(data?.items ?? []).length === 0 ? (
            <p className="p-2 text-xs text-content-muted">Aucune monture trouvée.</p>
          ) : (
            data!.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p);
                  setSearch('');
                }}
                className="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition hover:border-primary"
              >
                <div className="grid h-8 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <Frame className="h-3.5 w-3.5 text-content-faint" />
                  )}
                </div>
                <span className="truncate">{p.brand ? `${p.brand} · ` : ''}{p.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Création d'une commande de verres (ou lentilles/accessoire/monture/autre).
 * Le workflow Kanban démarre toujours à « À commander » ; le configurateur de
 * verres calcule le prix depuis le barème de l'établissement.
 */
export function LensOrderForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [category, setCategory] = useState<LensOrderCategory>('VERRES');
  const [customerId, setCustomerId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [frame, setFrame] = useState<Product | null>(null);
  const [odLens, setOdLens] = useState('');
  const [ogLens, setOgLens] = useState('');
  // Champs libres (catégories autres que Verres).
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  // Configurateur (Verres).
  const [ltype, setLtype] = useState<string>('progressif');
  const [lindex, setLindex] = useState<(typeof LENS_INDEX)[number]['id']>('1.6');
  const [treats, setTreats] = useState<string[]>(['ar']);
  const [error, setError] = useState('');

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });
  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;

  const isVerres = category === 'VERRES';
  const typeOptions = lensBaseOptions(pricing);
  const typeLabel = lensBaseLabel(pricing, ltype);
  const indexDef = LENS_INDEX.find((i) => i.id === lindex)!;
  const treatLabels = TREATMENTS.filter((t) => treats.includes(t.id)).map((t) => t.label);
  const treatSum = TREATMENTS.filter((t) => treats.includes(t.id)).reduce((s, t) => s + (pricing[t.id] ?? 0), 0);
  const configPrice = Math.round((lensBasePrice(pricing, ltype) * indexDef.mult + treatSum) * 2);
  const configDesc =
    `Verres ${typeLabel.toLowerCase()} indice ${lindex}` +
    (treatLabels.length ? ` — ${treatLabels.join(', ')}` : '') +
    ' (paire)';

  const finalDescription = isVerres ? configDesc : description.trim();
  const finalCost = isVerres ? configPrice : Number(cost) || undefined;
  const canSubmit = finalDescription.length >= 2;

  const toggle = (id: string) => setTreats((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const mut = useMutation({
    mutationFn: () =>
      createLensOrder({
        customerId: customerId || '',
        category,
        description: finalDescription,
        supplierName: supplierName || undefined,
        expectedAt: expectedAt || undefined,
        cost: finalCost,
        notes: notes || undefined,
        odLens: isVerres && odLens ? odLens : undefined,
        ogLens: isVerres && ogLens ? ogLens : undefined,
        frameProductId: frame?.id,
      }),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e, 'Création impossible')),
  });

  return (
    <Modal open onClose={onClose} title="Nouvelle commande" size="lg">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-content">Type d'article</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {LENS_ORDER_CATEGORIES.map((c) => {
              const Icon = LENS_CAT[c].icon;
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition ${
                    active ? 'border-primary bg-primary-soft shadow-card' : 'border-line hover:border-primary/50'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${active ? 'text-primary' : 'text-content-muted'}`} />
                  <span className="text-[11px] font-medium leading-tight text-content">{LENS_CAT[c].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <SectionTitle>Informations générales</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Client (optionnel)">
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Aucun —</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </Field>
            <Field label="Laboratoire / fournisseur">
              <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </Field>
            <Field label="Date prévue">
              <input className="input" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Monture associée (optionnel — vignette sur la carte Kanban)">
            <FramePicker value={frame} onChange={setFrame} />
          </Field>
        </div>

        {isVerres ? (
          <div className="space-y-3">
            <SectionTitle>Configuration des verres</SectionTitle>
            <div>
              <span className="label">Type de verre</span>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((t) => {
                  const active = ltype === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setLtype(t.key)}
                      className={`rounded-xl border p-3 text-sm transition ${
                        active ? 'border-primary bg-primary-soft text-content' : 'border-line text-content-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Indice (amincissement)">
              <select className="input" value={lindex} onChange={(e) => setLindex(e.target.value as typeof lindex)}>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Détail verre OD (droit)">
                <input className="input" value={odLens} onChange={(e) => setOdLens(e.target.value)} placeholder="ex : -1.25 (-0.50 × 90°)" />
              </Field>
              <Field label="Détail verre OG (gauche)">
                <input className="input" value={ogLens} onChange={(e) => setOgLens(e.target.value)} placeholder="ex : -1.00 (-0.75 × 85°)" />
              </Field>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
              <div className="text-sm text-content-muted">{configDesc}</div>
              <div className="mt-1 font-display text-2xl font-extrabold text-gradient">{formatCurrency(configPrice)}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <SectionTitle>Détail</SectionTitle>
            <Field label="Description">
              <input
                className="input"
                placeholder="Ex : Lentilles mensuelles, étui, cordon…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Coût (FCFA)">
              <input className="input" type="number" min={0} placeholder="Prix" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!canSubmit}>
            Créer la commande
          </Button>
        </div>
      </div>
    </Modal>
  );
}
