import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, SlidersHorizontal, History } from 'lucide-react';
import {
  productCreateSchema,
  type ProductCreateInput,
  lensBaseOptions,
  lensBasePrice,
  LENS_TREATMENTS,
  LENS_INDICES,
  lensLabel,
  DEFAULT_LENS_PRICING,
  isMadeToOrderCategory,
  type LensTreatmentKey,
} from '@oculo/shared-types';
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getStock,
  adjustStock,
  type Product,
  type StockRow,
} from '../../features/optique/api';
import { listSuppliers } from '../../features/management/api';
import { useUIStore } from '../../store/ui';
import { usePermission, useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { StockHistoryModal } from './StockPage';

const CATEGORIES = [
  { value: 'MONTURE', label: 'Montures' },
  { value: 'VERRE', label: 'Verres' },
  { value: 'LENTILLE', label: 'Lentilles' },
  { value: 'ACCESSOIRE', label: 'Accessoires' },
  { value: 'SERVICE', label: 'Services' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

function toLocalDatetimeString(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ProductsPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('optique.products.create');
  const canUpdate = usePermission('optique.products.update');
  const canDelete = usePermission('optique.products.delete');
  const canAdjust = usePermission('optique.stock.adjust');
  const branchId = useUIStore((s) => s.activeBranchId);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [historyRow, setViewingHistory] = useState<{ productId: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => listProducts({ search: search || undefined, pageSize: 100 }),
  });

  // Quantités du magasin actif, indexées par produit, pour ajuster sans quitter le catalogue.
  const { data: stock } = useQuery({
    queryKey: ['stock', branchId],
    queryFn: () => getStock(branchId!, false),
    enabled: Boolean(branchId),
  });

  const filteredProducts = useMemo(() => {
    return (data?.items ?? []).filter((p) => !category || p.category === category);
  }, [data?.items, category]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalStock: number; lastCreated: string | null }> = {
      MONTURE: { count: 0, totalStock: 0, lastCreated: null },
      VERRE: { count: 0, totalStock: 0, lastCreated: null },
      LENTILLE: { count: 0, totalStock: 0, lastCreated: null },
      ACCESSOIRE: { count: 0, totalStock: 0, lastCreated: null },
      SERVICE: { count: 0, totalStock: 0, lastCreated: null },
    };

    const items = data?.items ?? [];
    items.forEach((p) => {
      const cat = p.category;
      if (stats[cat]) {
        stats[cat].count++;
        if (p.createdAt) {
          if (!stats[cat].lastCreated || p.createdAt > stats[cat].lastCreated) {
            stats[cat].lastCreated = p.createdAt;
          }
        }
      }
    });

    if (stock) {
      stock.forEach((s) => {
        const cat = s.category;
        if (stats[cat]) {
          stats[cat].totalStock += s.quantity;
        }
      });
    }

    return stats;
  }, [data?.items, stock]);

  const stockByProduct = useMemo(() => {
    const m = new Map<string, StockRow>();
    (stock ?? []).forEach((r) => m.set(r.productId, r));
    return m;
  }, [stock]);
  const rowFor = (p: Product): StockRow =>
    stockByProduct.get(p.id) ?? {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      sellPrice: Number(p.sellPrice),
      stockItemId: null,
      quantity: 0,
      minAlert: 0,
      low: false,
    };

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setModalOpen(true);
  }

  const removeMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['pos-stock'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Catalogue produits"
        subtitle="Montures, verres, lentilles et accessoires"
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nouveau produit
            </Button>
          )
        }
      />

      {/* Visual Category Dashboard Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {CATEGORIES.map((c) => {
          const stats = categoryStats[c.value] || { count: 0, totalStock: 0, lastCreated: null };
          const isActive = category === c.value;
          return (
            <div
              key={c.value}
              onClick={() => setCategory(isActive ? '' : c.value)}
              className={`card cursor-pointer p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-md ${
                isActive ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'hover:border-primary-soft'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{c.label}</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-content">
                  {stats.count} <span className="text-xs font-normal text-content-muted">réf(s)</span>
                </span>
                {c.value !== 'VERRE' && c.value !== 'SERVICE' && (
                  <span className="text-xs font-semibold text-content-muted">
                    {stats.totalStock} en stock
                  </span>
                )}
              </div>
              <p className="mt-2 text-[10px] text-content-faint">
                {stats.lastCreated ? (
                  <>Dernier enreg. : <span className="font-medium text-content-muted">{formatDate(stats.lastCreated)}</span></>
                ) : (
                  'Aucun produit enregistré'
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory('')}
            className={`badge px-3 py-1.5 ${category === '' ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}
          >
            Tous
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`badge px-3 py-1.5 ${category === c.value ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucun produit"
          hint="Ajoutez votre premier produit au catalogue."
          action={canCreate && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nouveau produit</Button>}
        />
      ) : (
        <div className="card overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-sm text-content-muted">
              Aucun produit trouvé dans cette catégorie.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Produit</th>
                  <th className="table-cell font-semibold">Référence</th>
                  <th className="table-cell font-semibold">Catégorie</th>
                  <th className="table-cell text-right font-semibold">Prix de vente</th>
                  <th className="table-cell text-center font-semibold">Stock</th>
                  <th className="table-cell text-right font-semibold">Enregistré le</th>
                  <th className="table-cell text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <div className="font-medium text-content">{p.name}</div>
                      {p.brand && <div className="text-xs text-content-faint">{p.brand}</div>}
                    </td>
                    <td className="table-cell font-mono text-xs text-content-muted">{p.sku}</td>
                    <td className="table-cell">
                      <Badge tone="info">{catLabel(p.category)}</Badge>
                    </td>
                    <td className="table-cell text-right font-semibold text-content">
                      {formatCurrency(Number(p.sellPrice))}
                    </td>
                    <td className="table-cell text-center">
                      {isMadeToOrderCategory(p.category) ? (
                        <span className="text-xs font-semibold text-content-muted">Illimité</span>
                      ) : (() => {
                        const r = rowFor(p);
                        const content = (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-display text-base font-bold text-content">{r.quantity}</span>
                            {r.low && <Badge tone="danger">Bas</Badge>}
                          </span>
                        );
                        return canAdjust && branchId ? (
                          <button
                            onClick={() => setAdjusting(r)}
                            className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
                            title="Ajuster la quantité"
                          >
                            {content}
                            <SlidersHorizontal className="h-3.5 w-3.5 text-content-faint" />
                          </button>
                        ) : (
                          content
                        );
                      })()}
                    </td>
                    <td className="table-cell text-right text-content-muted">
                      {p.createdAt ? formatDateTime(p.createdAt) : '—'}
                    </td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingHistory({ productId: p.id, name: p.name })}
                        className="btn-ghost h-8 w-8 rounded-lg p-0 text-primary"
                        title="Historique des mouvements"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      {canUpdate && (
                        <button onClick={() => openEdit(p)} className="btn-ghost h-8 w-8 rounded-lg p-0">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (confirm(`Désactiver « ${p.name} » ?`)) removeMut.mutate(p.id);
                          }}
                          className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      )}

      {modalOpen && (
        <ProductModal
          product={editing}
          branchId={branchId}
          stockRow={editing ? stockByProduct.get(editing.id) : undefined}
          onClose={() => setModalOpen(false)}
        />
      )}
      {adjusting && branchId && (
        <StockAdjustModal
          row={adjusting}
          branchId={branchId}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['stock'] });
            qc.invalidateQueries({ queryKey: ['pos-stock'] });
            // Invalider aussi l'historique si ouvert
            qc.invalidateQueries({ queryKey: ['stock-movements'] });
            setAdjusting(null);
          }}
        />
      )}
      {historyRow && branchId && (
        <StockHistoryModal
          row={historyRow}
          branchId={branchId}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </div>
  );
}

function StockAdjustModal({
  row,
  branchId,
  onClose,
  onSaved,
}: {
  row: StockRow;
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState(row.quantity);
  const [minAlert, setMinAlert] = useState(row.minAlert);
  const [error, setError] = useState('');
  const delta = qty - row.quantity;

  const mut = useMutation({
    mutationFn: () => adjustStock({ productId: row.productId, branchId, delta, minAlert }),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={`Stock — ${row.name}`} size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-center">
          <p className="text-xs text-content-muted">Quantité en stock</p>
          <p className="font-display text-2xl font-bold text-content">{row.quantity}</p>
          {delta !== 0 && (
            <p className="mt-1 text-xs text-content-faint">
              Mouvement : <span className="font-semibold text-content">{delta > 0 ? `+${delta}` : delta}</span>
            </p>
          )}
        </div>
        <Field label="Nouvelle quantité">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-outline h-10 w-10 p-0 text-lg"
              onClick={() => setQty((q) => Math.max(0, q - 1))}
            >
              −
            </button>
            <input
              type="number"
              min={0}
              className="input text-center"
              value={qty}
              onChange={(e) => setQty(Math.max(0, parseInt(e.target.value || '0', 10)))}
            />
            <button
              type="button"
              className="btn-outline h-10 w-10 p-0 text-lg"
              onClick={() => setQty((q) => q + 1)}
            >
              +
            </button>
          </div>
        </Field>
        <Field label="Seuil d'alerte (stock bas)">
          <input
            type="number"
            min={0}
            className="input"
            value={minAlert}
            onChange={(e) => setMinAlert(Math.max(0, parseInt(e.target.value || '0', 10)))}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={delta === 0 && minAlert === row.minAlert}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProductModal({
  product,
  branchId,
  stockRow,
  onClose,
}: {
  product: Product | null;
  branchId: string | null;
  stockRow?: StockRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const pricing = user?.tenantLensPricing ?? DEFAULT_LENS_PRICING;
  const [serverError, setServerError] = useState('');
  const attrs = (product?.attributes ?? {}) as {
    lensBase?: string;
    lensTypeName?: string;
    treatments?: LensTreatmentKey[];
    index?: string;
    supplier?: string;
  };
  // Attributs spécifiques aux verres, stockés dans product.attributes.
  const [lensBase, setLensBase] = useState<string>(attrs.lensBase ?? '');
  const [lensTypeName, setLensTypeName] = useState(attrs.lensTypeName ?? '');
  const [typeOther, setTypeOther] = useState<boolean>(Boolean(attrs.lensTypeName));
  const [treatments, setTreatments] = useState<LensTreatmentKey[]>(attrs.treatments ?? []);
  const [lensIndex, setLensIndex] = useState<string>(attrs.index ?? '');
  const [indexOther, setIndexOther] = useState<boolean>(
    Boolean(attrs.index && !LENS_INDICES.some((i) => i.id === attrs.index)),
  );
  const [supplier, setSupplier] = useState(attrs.supplier ?? '');
  const [supplierOther, setSupplierOther] = useState(false);
  // Stock du magasin actif : quantité + seuil d'alerte, réglables dès la création.
  const [qty, setQty] = useState(stockRow?.quantity ?? 0);
  const [minAlert, setMinAlert] = useState(stockRow?.minAlert ?? 0);

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const defaultCreatedAt = product?.createdAt
    ? toLocalDatetimeString(product.createdAt)
    : toLocalDatetimeString(new Date());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: product
      ? {
          sku: product.sku,
          name: product.name,
          category: product.category as ProductCreateInput['category'],
          brand: product.brand ?? '',
          buyPrice: Number(product.buyPrice),
          sellPrice: Number(product.sellPrice),
          createdAt: defaultCreatedAt,
        }
      : {
          category: 'MONTURE',
          buyPrice: 0,
          sellPrice: 0,
          createdAt: defaultCreatedAt,
        },
  });

  const category = watch('category');
  const isLens = category === 'VERRE';
  // Verres et accessoires : référence auto-générée, on masque le champ SKU.
  const hideSku = category === 'VERRE' || category === 'ACCESSOIRE';

  // Barème verres : prix suggéré = prix du type de base × indice + traitements.
  // Le prix de vente reste librement modifiable en dessous.
  function suggestPrice(base: string, treats: LensTreatmentKey[], idx: string): number {
    const mult = LENS_INDICES.find((i) => i.id === idx)?.mult ?? 1;
    const treatSum = treats.reduce((s, t) => s + (pricing[t] ?? 0), 0);
    return Math.round(lensBasePrice(pricing, base) * mult + treatSum);
  }
  function applyLens(base: string, treats: LensTreatmentKey[], idx: string) {
    setLensBase(base);
    setTreatments(treats);
    setLensIndex(idx);
    if (base) {
      setValue('sellPrice', suggestPrice(base, treats, idx), { shouldValidate: true });
      if (!getValues('name')?.trim()) setValue('name', lensLabel(pricing, base, treats));
    }
  }
  function toggleTreatment(k: LensTreatmentKey) {
    applyLens(
      lensBase,
      treatments.includes(k) ? treatments.filter((t) => t !== k) : [...treatments, k],
      lensIndex,
    );
  }

  // Alerte doublon en direct : on vérifie la référence (SKU) à la lettre près, insensible à la casse.
  const skuValue = (watch('sku') ?? '').trim();
  const [debouncedSku, setDebouncedSku] = useState(skuValue);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSku(skuValue), 300);
    return () => clearTimeout(t);
  }, [skuValue]);
  const { data: skuMatches } = useQuery({
    queryKey: ['product-sku-check', debouncedSku],
    queryFn: () => listProducts({ search: debouncedSku }),
    enabled: debouncedSku.length > 0,
  });
  const dupProduct =
    debouncedSku.length > 0
      ? skuMatches?.items.find(
          (p) => p.sku.trim().toLowerCase() === debouncedSku.toLowerCase() && p.id !== product?.id,
        )
      : undefined;

  const mut = useMutation({
    mutationFn: async (values: ProductCreateInput) => {
      // Type de base + traitements + fournisseur rangés dans attributes (verre uniquement).
      const withAttrs: ProductCreateInput = isLens
        ? {
            ...values,
            attributes: {
              ...(lensBase ? { lensBase } : {}),
              ...(typeOther && lensTypeName.trim() ? { lensTypeName: lensTypeName.trim() } : {}),
              ...(treatments.length ? { treatments } : {}),
              ...(lensIndex ? { index: lensIndex } : {}),
              ...(supplier ? { supplier } : {}),
            },
          }
        : values;

      const payload = {
        ...withAttrs,
        createdAt: values.createdAt ? new Date(values.createdAt).toISOString() : undefined,
      };

      const saved = product ? await updateProduct(product.id, payload) : await createProduct(payload);
      // Appliquer le stock du magasin actif si la quantité ou le seuil ont changé.
      // (Pas pour les verres : stock illimité.)
      if (branchId && !isLens) {
        const currentQty = stockRow?.quantity ?? 0;
        const currentAlert = stockRow?.minAlert ?? 0;
        const delta = qty - currentQty;
        if (delta !== 0 || minAlert !== currentAlert) {
          await adjustStock({ productId: saved.id, branchId, delta, minAlert });
        }
      }
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      // Rafraîchit aussitôt le catalogue de la caisse et des devis.
      qc.invalidateQueries({ queryKey: ['pos-stock'] });
      onClose();
    },
    onError: (e) => setServerError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={product ? 'Modifier le produit' : 'Nouveau produit'}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
        <Field label="Nom du produit">
          <input className="input" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
        </Field>
        <div className={hideSku ? '' : 'grid grid-cols-2 gap-3'}>
          {!hideSku && (
            <Field label="Référence (SKU)">
              <input
                className={`input ${dupProduct ? 'border-danger focus:border-danger' : ''}`}
                {...register('sku')}
              />
              {errors.sku && <p className="mt-1 text-xs text-danger">{errors.sku.message}</p>}
              {dupProduct && (
                <p className="mt-1 flex items-start gap-1 text-xs text-danger">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Référence déjà enregistrée pour « {dupProduct.name} ».</span>
                </p>
              )}
            </Field>
          )}
          <Field label="Catégorie">
            <select className="input" {...register('category')}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marque (optionnel)">
            <input className="input" {...register('brand')} />
          </Field>
          <Field label="Date d'enregistrement">
            <input type="datetime-local" className="input" {...register('createdAt')} />
          </Field>
        </div>

        {/* Verres : type de base + traitements → prix synchronisé depuis les Réglages. */}
        {isLens && (
          <div className="space-y-3 rounded-xl border border-primary/25 bg-primary-soft/25 p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type de verre">
                <select
                  className="input"
                  value={typeOther ? '__other__' : lensBase}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__other__') {
                      setTypeOther(true);
                      setLensBase('');
                    } else {
                      setTypeOther(false);
                      setLensTypeName('');
                      applyLens(v, treatments, lensIndex);
                    }
                  }}
                >
                  <option value="">— Choisir —</option>
                  {lensBaseOptions(pricing).map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label} — {formatCurrency(b.price)}
                    </option>
                  ))}
                  <option value="__other__">Autre (préciser)…</option>
                </select>
                {typeOther && (
                  <input
                    className="input mt-2"
                    placeholder="Ex : Bifocal, Mi-distance…"
                    value={lensTypeName}
                    onChange={(e) => {
                      setLensTypeName(e.target.value);
                      if (!getValues('name')?.trim() && e.target.value.trim())
                        setValue('name', `Verre ${e.target.value.trim()}`);
                    }}
                  />
                )}
              </Field>
              <Field label="Indice (amincissement)">
                {indexOther ? (
                  <input
                    className="input"
                    placeholder="Ex : 1.59"
                    value={lensIndex}
                    onChange={(e) => setLensIndex(e.target.value)}
                  />
                ) : (
                  <select
                    className="input"
                    value={lensIndex}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__other__') {
                        setIndexOther(true);
                        setLensIndex('');
                      } else applyLens(lensBase, treatments, v);
                    }}
                  >
                    <option value="">— Indice —</option>
                    {LENS_INDICES.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                    <option value="__other__">Autre…</option>
                  </select>
                )}
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-content-muted">Traitements</p>
              <div className="flex flex-wrap gap-1.5">
                {LENS_TREATMENTS.map((tr) => {
                  const on = treatments.includes(tr.key);
                  return (
                    <button
                      key={tr.key}
                      type="button"
                      onClick={() => toggleTreatment(tr.key)}
                      className={`badge px-2.5 py-1 text-xs ${on ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}
                    >
                      {tr.label} +{formatCurrency(pricing[tr.key])}
                    </button>
                  );
                })}
              </div>
            </div>
            {lensBase && (
              <p className="text-xs text-content-muted">
                Prix suggéré :{' '}
                <span className="font-semibold text-content">
                  {formatCurrency(suggestPrice(lensBase, treatments, lensIndex))}
                </span>{' '}
                — modifiable ci-dessous.
              </p>
            )}
            <Field label="Fournisseur">
              {supplierOther || (suppliers && suppliers.length === 0) ? (
                <input
                  className="input"
                  placeholder="Ex : Essilor, Zeiss…"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              ) : (
                <select
                  className="input"
                  value={supplier}
                  onChange={(e) => {
                    if (e.target.value === '__other__') {
                      setSupplier('');
                      setSupplierOther(true);
                    } else setSupplier(e.target.value);
                  }}
                >
                  <option value="">— Choisir —</option>
                  {suppliers?.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  <option value="__other__">Autre…</option>
                </select>
              )}
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix d'achat (FCFA)">
            <input className="input" type="number" step="1" {...register('buyPrice', { valueAsNumber: true })} />
          </Field>
          <Field label="Prix de vente (FCFA)">
            <input className="input" type="number" step="1" {...register('sellPrice', { valueAsNumber: true })} />
            {errors.sellPrice && <p className="mt-1 text-xs text-danger">{errors.sellPrice.message}</p>}
          </Field>
        </div>

        {/* Stock du magasin actif : quantité initiale (ou courante) + seuil d'alerte.
            Masqué pour les verres (stock illimité, fabriqués sur commande). */}
        {branchId && !isLens && (
          <div className="rounded-xl border border-line bg-surface-2/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
              Stock — magasin actif
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={product ? 'Quantité en stock' : 'Quantité initiale'}>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={qty}
                  onChange={(e) => setQty(Math.max(0, parseInt(e.target.value || '0', 10)))}
                />
              </Field>
              <Field label="Seuil d'alerte (stock bas)">
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={minAlert}
                  onChange={(e) => setMinAlert(Math.max(0, parseInt(e.target.value || '0', 10)))}
                />
              </Field>
            </div>
          </div>
        )}

        {serverError && <p className="text-sm text-danger">{serverError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending} disabled={!!dupProduct}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
