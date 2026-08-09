import { useMemo, useState } from 'react';
import { Search, Pencil, Copy, ShoppingCart, Trash2, X, Scale, Sparkles } from 'lucide-react';
import {
  LENS_FAMILIES,
  LENS_INDICES,
  lensTags,
  type LensAttributes,
} from '@oculo/shared-types';
import type { Product, StockRow } from '../../features/optique/api';
import { LensVisual } from '../../features/optique/LensVisual';
import { formatCurrency } from '../../lib/format';
import { Badge, Button, EmptyState, Modal } from '../../components/ui';

/** Attributs verre d'un produit, sûrs même si le JSON est vide. */
export function lensAttrs(p: Product): LensAttributes {
  return (p.attributes ?? {}) as LensAttributes;
}

export interface LensActions {
  onEdit: (p: Product) => void;
  onDuplicate: (p: Product) => void;
  onSell: (p: Product) => void;
  onDelete?: (p: Product) => void;
}

/**
 * Carte d'un verre : l'illustration porte le type (progressif, photochromique,
 * solaire…), les étiquettes portent les caractéristiques techniques.
 */
function LensCard({
  p,
  actions,
  selected,
  onToggleCompare,
  canUpdate,
  canDelete,
  canSell,
}: {
  p: Product;
  actions: LensActions;
  selected: boolean;
  onToggleCompare: () => void;
  canUpdate: boolean;
  canDelete: boolean;
  canSell: boolean;
}) {
  const a = lensAttrs(p);
  const tags = lensTags(a);

  return (
    <div
      className={`card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card-lg ${
        selected ? 'border-primary ring-2 ring-primary/25' : ''
      }`}
    >
      <div className="relative bg-surface-2 p-3">
        {/* Photo du fabricant si fournie, sinon l'illustration générée */}
        {p.photoUrl ? (
          <img src={p.photoUrl} alt={p.name} loading="lazy" className="mx-auto h-24 object-contain" />
        ) : (
          <LensVisual family={a.family} className="mx-auto h-24 w-full" />
        )}
        {a.premium && (
          <span className="absolute right-2 top-2">
            <Badge tone="warning">
              <Sparkles className="h-3 w-3" /> Premium
            </Badge>
          </span>
        )}
        <label
          className="absolute left-2 top-2 flex cursor-pointer items-center gap-1 rounded-lg bg-surface/80 px-1.5 py-1 text-[10px] text-content-muted backdrop-blur"
          title="Ajouter au comparateur"
        >
          <input type="checkbox" checked={selected} onChange={onToggleCompare} className="h-3 w-3" />
          Comparer
        </label>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
          {p.brand || '—'}
          {a.range ? ` · ${a.range}` : ''}
        </p>
        <p className="truncate text-sm font-semibold text-content">{p.name}</p>
        <p className="mt-0.5 font-mono text-[11px] text-content-faint">{p.sku}</p>

        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => (
            <span key={t} className="badge bg-primary-soft px-2 py-0.5 text-[10px] text-primary">
              {t}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="font-display text-lg font-bold text-content">
            {formatCurrency(Number(p.sellPrice))}
          </span>
          <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            {canUpdate && (
              <button onClick={() => actions.onEdit(p)} title="Modifier" className="btn-ghost h-7 w-7 rounded-lg p-0">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canUpdate && (
              <button onClick={() => actions.onDuplicate(p)} title="Dupliquer" className="btn-ghost h-7 w-7 rounded-lg p-0">
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            {canSell && (
              <button onClick={() => actions.onSell(p)} title="Vendre" className="btn-ghost h-7 w-7 rounded-lg p-0 text-primary">
                <ShoppingCart className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && actions.onDelete && (
              <button onClick={() => actions.onDelete!(p)} title="Supprimer" className="btn-ghost h-7 w-7 rounded-lg p-0 text-danger">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Catalogue des verres : filtres par famille, indice et traitement, plus un
 * comparateur côte à côte — le geste courant quand on conseille un client.
 */
export function LensCatalog({
  products,
  actions,
  canUpdate,
  canDelete,
  canSell,
}: {
  products: Product[];
  stockByProduct?: Map<string, StockRow>;
  actions: LensActions;
  canUpdate: boolean;
  canDelete: boolean;
  canSell: boolean;
}) {
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('');
  const [index, setIndex] = useState('');
  const [treatment, setTreatment] = useState('');
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const treatments = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => (lensAttrs(p).treatments ?? []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const a = lensAttrs(p);
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.brand ?? ''} ${a.range ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (family && a.family !== family) return false;
      if (index && a.index !== index) return false;
      if (treatment && !(a.treatments ?? []).includes(treatment)) return false;
      return true;
    });
  }, [products, search, family, index, treatment]);

  const compared = products.filter((p) => compare.includes(p.id));
  const hasFilter = Boolean(family || index || treatment);

  return (
    <div>
      {/* Familles : le filtre principal, en pastilles */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setFamily('')}
          className={`badge px-3 py-1.5 text-xs ${
            family === '' ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'
          }`}
        >
          Toutes familles
        </button>
        {LENS_FAMILIES.map((f) => (
          <button
            key={f.key}
            onClick={() => setFamily(family === f.key ? '' : f.key)}
            className={`badge px-3 py-1.5 text-xs ${
              family === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Rechercher un verre (marque, gamme, référence)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input h-9 w-auto py-1" value={index} onChange={(e) => setIndex(e.target.value)}>
          <option value="">Tous indices</option>
          {LENS_INDICES.map((i) => (
            <option key={i.id} value={i.id}>
              Indice {i.label}
            </option>
          ))}
        </select>
        {treatments.length > 0 && (
          <select className="input h-9 w-auto py-1" value={treatment} onChange={(e) => setTreatment(e.target.value)}>
            <option value="">Tous traitements</option>
            {treatments.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        {hasFilter && (
          <button
            onClick={() => {
              setFamily('');
              setIndex('');
              setTreatment('');
            }}
            className="btn-ghost h-8 rounded-lg px-2 text-xs"
          >
            <X className="h-3.5 w-3.5" /> Effacer
          </button>
        )}
        {compare.length > 0 && (
          <Button className="h-9 px-3 text-xs" onClick={() => setShowCompare(true)}>
            <Scale className="h-4 w-4" /> Comparer ({compare.length})
          </Button>
        )}
        <span className="ml-auto text-xs text-content-faint">{filtered.length} verre(s)</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Aucun verre"
          hint={
            products.length === 0
              ? 'Ajoutez votre premier verre au catalogue.'
              : 'Aucun verre ne correspond à ces filtres.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <LensCard
              key={p.id}
              p={p}
              actions={actions}
              selected={compare.includes(p.id)}
              onToggleCompare={() =>
                setCompare((prev) =>
                  prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id].slice(-4),
                )
              }
              canUpdate={canUpdate}
              canDelete={canDelete}
              canSell={canSell}
            />
          ))}
        </div>
      )}

      {showCompare && compared.length > 0 && (
        <Modal open onClose={() => setShowCompare(false)} title="Comparer les verres" size="lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Critère</th>
                  {compared.map((p) => (
                    <th key={p.id} className="table-cell text-center font-semibold">
                      <LensVisual family={lensAttrs(p).family} className="mx-auto h-12 w-full" />
                      <div className="mt-1 truncate text-content">{p.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Marque', (p: Product) => p.brand || '—'],
                    ['Gamme', (p: Product) => lensAttrs(p).range || '—'],
                    [
                      'Type',
                      (p: Product) =>
                        LENS_FAMILIES.find((f) => f.key === lensAttrs(p).family)?.label || '—',
                    ],
                    ['Indice', (p: Product) => lensAttrs(p).index || '—'],
                    ['Matériau', (p: Product) => lensAttrs(p).material || '—'],
                    ['Traitements', (p: Product) => (lensAttrs(p).treatments ?? []).join(', ') || '—'],
                    ['Teinte', (p: Product) => lensAttrs(p).tint || '—'],
                    ['Design', (p: Product) => lensAttrs(p).design || '—'],
                    ['Usage', (p: Product) => lensAttrs(p).usage || '—'],
                  ] as [string, (p: Product) => string][]
                ).map(([label, get]) => (
                  <tr key={label} className="border-b last:border-0">
                    <td className="table-cell font-medium text-content-muted">{label}</td>
                    {compared.map((p) => (
                      <td key={p.id} className="table-cell text-center text-content">
                        {get(p)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2">
                  <td className="table-cell font-semibold text-content">Prix de vente</td>
                  {compared.map((p) => (
                    <td key={p.id} className="table-cell text-center font-display font-bold text-content">
                      {formatCurrency(Number(p.sellPrice))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setCompare([])}>
              Vider le comparateur
            </Button>
            <Button onClick={() => setShowCompare(false)}>Fermer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Aperçu dynamique affiché à droite du formulaire de verre. */
export function LensPreview({
  brand,
  range,
  name,
  sku,
  price,
  attrs,
  photoUrl,
}: {
  brand: string;
  range: string;
  name: string;
  sku: string;
  price: number;
  attrs: LensAttributes;
  photoUrl?: string;
}) {
  const tags = lensTags(attrs);
  return (
    <div className="card w-full max-w-[16rem] overflow-hidden">
      <div className="bg-surface-2 p-3">
        {photoUrl ? (
          <img src={photoUrl} alt="Aperçu" className="mx-auto h-24 object-contain" />
        ) : (
          <LensVisual family={attrs.family} className="mx-auto h-24 w-full" />
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
          {brand || 'Marque'}
          {range ? ` · ${range}` : ''}
        </p>
        <p className="truncate text-sm font-semibold text-content">{name || 'Désignation du verre'}</p>
        <p className="mt-0.5 font-mono text-[11px] text-content-faint">{sku || 'Référence auto'}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 5).map((t) => (
            <span key={t} className="badge bg-primary-soft px-2 py-0.5 text-[10px] text-primary">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-3 font-display text-lg font-bold text-content">{formatCurrency(price || 0)}</p>
      </div>
    </div>
  );
}
