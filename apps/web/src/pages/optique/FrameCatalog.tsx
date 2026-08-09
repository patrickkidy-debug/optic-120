import { useMemo, useState } from 'react';
import {
  Glasses,
  LayoutGrid,
  List,
  Search,
  Eye,
  Pencil,
  Copy,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import {
  FRAME_GENDERS,
  FRAME_SHAPES,
  FRAME_COLORS,
  type FrameAttributes,
} from '@oculo/shared-types';
import type { Product, StockRow } from '../../features/optique/api';
import { formatCurrency } from '../../lib/format';
import { Badge, EmptyState } from '../../components/ui';

/** Attributs monture d'un produit, typés et sûrs même si le JSON est vide. */
export function frameAttrs(p: Product): FrameAttributes {
  return (p.attributes ?? {}) as FrameAttributes;
}

/** État de stock affiché sur la carte. */
function stockState(row: StockRow | undefined) {
  const qty = row?.quantity ?? 0;
  if (row?.unlimited) return { label: 'Disponible', tone: 'success' as const, qty: null };
  if (qty <= 0) return { label: 'Rupture', tone: 'danger' as const, qty };
  if (qty <= (row?.minAlert ?? 0)) return { label: 'Stock faible', tone: 'warning' as const, qty };
  return { label: 'Disponible', tone: 'success' as const, qty };
}

export interface FrameActions {
  onView: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDuplicate: (p: Product) => void;
  onSell: (p: Product) => void;
  onDelete?: (p: Product) => void;
}

/** Vignette : la photo si elle existe, sinon un repère visuel neutre. */
function FrameThumb({ p, className = '' }: { p: Product; className?: string }) {
  if (p.photoUrl) {
    return <img src={p.photoUrl} alt={p.name} loading="lazy" className={`object-contain ${className}`} />;
  }
  return (
    <div className={`grid place-items-center bg-surface-2 ${className}`}>
      <Glasses className="h-8 w-8 text-content-faint" />
    </div>
  );
}

/** Carte visuelle d'une monture : photo dominante, puis l'essentiel. */
function FrameCard({
  p,
  stock,
  actions,
  canUpdate,
  canDelete,
  canSell,
}: {
  p: Product;
  stock?: StockRow;
  actions: FrameActions;
  canUpdate: boolean;
  canDelete: boolean;
  canSell: boolean;
}) {
  const a = frameAttrs(p);
  const st = stockState(stock);
  const color = FRAME_COLORS.find((c) => c.name === a.color);

  return (
    <div className="card group flex flex-col overflow-hidden hover:-translate-y-0.5 hover:shadow-card-lg">
      {/* Photo : donnée centrale de la fiche */}
      <button
        type="button"
        onClick={() => actions.onView(p)}
        className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2"
        title="Voir la fiche"
      >
        <FrameThumb p={p} className="h-full w-full transition duration-300 group-hover:scale-105" />
        <span className="absolute left-2 top-2">
          <Badge tone={st.tone}>
            {st.label}
            {st.qty !== null && st.qty > 0 ? ` · ${st.qty}` : ''}
          </Badge>
        </span>
      </button>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
              {p.brand || '—'}
            </p>
            <p className="truncate text-sm font-semibold text-content">{a.model || p.name}</p>
          </div>
          {color && (
            <span
              title={a.color}
              className="mt-0.5 h-4 w-4 shrink-0 rounded-full border"
              style={{ background: color.hex }}
            />
          )}
        </div>

        <p className="mt-0.5 font-mono text-[11px] text-content-faint">{p.sku}</p>

        <div className="mt-2 flex flex-wrap gap-1">
          {[a.gender, a.shape, a.size].filter(Boolean).map((t) => (
            <span key={t} className="badge bg-surface-3 px-2 py-0.5 text-[10px] text-content-muted">
              {t}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="font-display text-lg font-bold text-content">
            {formatCurrency(Number(p.sellPrice))}
          </span>
          {/* Actions : discrètes au repos, révélées au survol */}
          <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <button onClick={() => actions.onView(p)} title="Voir" className="btn-ghost h-7 w-7 rounded-lg p-0">
              <Eye className="h-3.5 w-3.5" />
            </button>
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
 * Catalogue des montures : grille visuelle ou liste, filtres par marque,
 * genre, forme, couleur, taille, prix et stock, recherche globale.
 */
export function FrameCatalog({
  products,
  stockByProduct,
  actions,
  canUpdate,
  canDelete,
  canSell,
}: {
  products: Product[];
  stockByProduct: Map<string, StockRow>;
  actions: FrameActions;
  canUpdate: boolean;
  canDelete: boolean;
  canSell: boolean;
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [gender, setGender] = useState('');
  const [shape, setShape] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [stockOnly, setStockOnly] = useState(false);

  // Valeurs réellement présentes au catalogue : on ne propose pas un filtre
  // qui ne renverrait rien.
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean) as string[])].sort(),
    [products],
  );
  const sizes = useMemo(
    () => [...new Set(products.map((p) => frameAttrs(p).size).filter(Boolean) as string[])].sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const a = frameAttrs(p);
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.brand ?? ''} ${a.model ?? ''} ${a.color ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (brand && p.brand !== brand) return false;
      if (gender && a.gender !== gender) return false;
      if (shape && a.shape !== shape) return false;
      if (color && a.color !== color) return false;
      if (size && a.size !== size) return false;
      if (maxPrice && Number(p.sellPrice) > Number(maxPrice)) return false;
      if (stockOnly) {
        const row = stockByProduct.get(p.id);
        if (!row?.unlimited && (row?.quantity ?? 0) <= 0) return false;
      }
      return true;
    });
  }, [products, search, brand, gender, shape, color, size, maxPrice, stockOnly, stockByProduct]);

  const hasFilter = Boolean(brand || gender || shape || color || size || maxPrice || stockOnly);

  return (
    <div>
      {/* Barre d'outils : recherche, filtres, bascule d'affichage */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <input
              className="input pl-9"
              placeholder="Rechercher une monture (marque, modèle, référence, couleur)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex rounded-xl border p-0.5">
            <button
              onClick={() => setView('grid')}
              title="Vue grille"
              className={`rounded-lg px-2.5 py-1.5 transition ${
                view === 'grid' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              title="Vue liste"
              className={`rounded-lg px-2.5 py-1.5 transition ${
                view === 'list' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="input h-9 w-auto py-1" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Toutes marques</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select className="input h-9 w-auto py-1" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Tous genres</option>
            {FRAME_GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select className="input h-9 w-auto py-1" value={shape} onChange={(e) => setShape(e.target.value)}>
            <option value="">Toutes formes</option>
            {FRAME_SHAPES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {sizes.length > 0 && (
            <select className="input h-9 w-auto py-1" value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">Toutes tailles</option>
              {sizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <input
            type="number"
            min={0}
            className="input h-9 w-32 py-1"
            placeholder="Prix max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <button
            onClick={() => setStockOnly((v) => !v)}
            className={`badge px-3 py-1.5 text-xs ${
              stockOnly ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'
            }`}
          >
            En stock
          </button>

          {/* Pastilles de couleur : filtre visuel, plus rapide qu'une liste */}
          <div className="flex items-center gap-1">
            {FRAME_COLORS.map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => setColor(color === c.name ? '' : c.name)}
                style={{ background: c.hex }}
                className={`h-5 w-5 rounded-full border transition ${
                  color === c.name ? 'ring-2 ring-primary ring-offset-1 ring-offset-[color:var(--bg)]' : ''
                }`}
              />
            ))}
          </div>

          {hasFilter && (
            <button
              onClick={() => {
                setBrand('');
                setGender('');
                setShape('');
                setColor('');
                setSize('');
                setMaxPrice('');
                setStockOnly(false);
              }}
              className="btn-ghost h-8 rounded-lg px-2 text-xs"
            >
              <X className="h-3.5 w-3.5" /> Effacer
            </button>
          )}

          <span className="ml-auto text-xs text-content-faint">
            {filtered.length} monture(s)
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Glasses}
          title="Aucune monture"
          hint={
            products.length === 0
              ? 'Ajoutez votre première monture au catalogue.'
              : 'Aucune monture ne correspond à ces filtres.'
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <FrameCard
              key={p.id}
              p={p}
              stock={stockByProduct.get(p.id)}
              actions={actions}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canSell={canSell}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Monture</th>
                <th className="table-cell font-semibold">Genre</th>
                <th className="table-cell font-semibold">Forme</th>
                <th className="table-cell font-semibold">Couleur</th>
                <th className="table-cell font-semibold">Taille</th>
                <th className="table-cell text-right font-semibold">Prix</th>
                <th className="table-cell text-center font-semibold">Stock</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const a = frameAttrs(p);
                const st = stockState(stockByProduct.get(p.id));
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <FrameThumb p={p} className="h-10 w-14 shrink-0 rounded-md" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-content">
                            {p.brand ? `${p.brand} · ` : ''}
                            {a.model || p.name}
                          </div>
                          <div className="font-mono text-[11px] text-content-faint">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-content-muted">{a.gender || '—'}</td>
                    <td className="table-cell text-content-muted">{a.shape || '—'}</td>
                    <td className="table-cell text-content-muted">{a.color || '—'}</td>
                    <td className="table-cell text-content-muted">{a.size || '—'}</td>
                    <td className="table-cell text-right font-semibold text-content">
                      {formatCurrency(Number(p.sellPrice))}
                    </td>
                    <td className="table-cell text-center">
                      <Badge tone={st.tone}>
                        {st.label}
                        {st.qty !== null && st.qty > 0 ? ` · ${st.qty}` : ''}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => actions.onView(p)} title="Voir" className="btn-ghost h-8 w-8 rounded-lg p-0">
                          <Eye className="h-4 w-4" />
                        </button>
                        {canUpdate && (
                          <button onClick={() => actions.onEdit(p)} title="Modifier" className="btn-ghost h-8 w-8 rounded-lg p-0">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canUpdate && (
                          <button onClick={() => actions.onDuplicate(p)} title="Dupliquer" className="btn-ghost h-8 w-8 rounded-lg p-0">
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        {canSell && (
                          <button onClick={() => actions.onSell(p)} title="Vendre" className="btn-ghost h-8 w-8 rounded-lg p-0 text-primary">
                            <ShoppingCart className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && actions.onDelete && (
                          <button onClick={() => actions.onDelete!(p)} title="Supprimer" className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Fiche détaillée d'une monture (galerie + caractéristiques). */
export function FrameDetail({ p, stock }: { p: Product; stock?: StockRow }) {
  const a = frameAttrs(p);
  const gallery = [p.photoUrl, ...(p.photos ?? [])].filter(Boolean) as string[];
  const [active, setActive] = useState(0);
  const st = stockState(stock);

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border bg-surface-2">
          {gallery.length > 0 ? (
            <img src={gallery[Math.min(active, gallery.length - 1)]} alt={p.name} className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center">
              <Glasses className="h-10 w-10 text-content-faint" />
            </div>
          )}
        </div>
        {gallery.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {gallery.map((src, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-14 w-14 overflow-hidden rounded-lg border transition ${
                  i === active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary'
                }`}
              >
                <img src={src} alt={`Vue ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.brand || '—'}</p>
        <h3 className="font-display text-xl font-bold text-content">{a.model || p.name}</h3>
        <p className="font-mono text-xs text-content-faint">{p.sku}</p>
        <p className="mt-2 font-display text-2xl font-bold text-gradient">
          {formatCurrency(Number(p.sellPrice))}
        </p>
        <div className="mt-2">
          <Badge tone={st.tone}>
            {st.label}
            {st.qty !== null && st.qty > 0 ? ` · ${st.qty} en stock` : ''}
          </Badge>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm">
          {[
            ['Genre', a.gender],
            ['Forme', a.shape],
            ['Couleur', a.color],
            ['Matière', a.material],
            ['Taille', a.size],
            ['EAN', a.ean],
            ['Emplacement', a.location],
            ['Fournisseur', a.supplier],
          ]
            .filter(([, v]) => Boolean(v))
            .map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3 border-b pb-1 last:border-0">
                <dt className="text-content-muted">{k}</dt>
                <dd className="text-right font-medium text-content">{v}</dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}

/** Aperçu réduit de la carte, affiché en direct pendant la saisie. */
export function FramePreview({
  photoUrl,
  brand,
  model,
  sku,
  price,
  gender,
  shape,
  size,
  color,
}: {
  photoUrl: string;
  brand: string;
  model: string;
  sku: string;
  price: number;
  gender?: string;
  shape?: string;
  size?: string;
  color?: string;
}) {
  const swatch = FRAME_COLORS.find((c) => c.name === color);
  return (
    <div className="card w-full max-w-[16rem] overflow-hidden">
      <div className="aspect-[4/3] w-full bg-surface-2">
        {photoUrl ? (
          <img src={photoUrl} alt="Aperçu" className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full place-items-center">
            <Glasses className="h-8 w-8 text-content-faint" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
              {brand || 'Marque'}
            </p>
            <p className="truncate text-sm font-semibold text-content">{model || 'Modèle'}</p>
          </div>
          {swatch && <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border" style={{ background: swatch.hex }} />}
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-content-faint">{sku || 'Référence auto'}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {[gender, shape, size].filter(Boolean).map((t) => (
            <span key={t} className="badge bg-surface-3 px-2 py-0.5 text-[10px] text-content-muted">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-3 font-display text-lg font-bold text-content">{formatCurrency(price || 0)}</p>
      </div>
    </div>
  );
}
