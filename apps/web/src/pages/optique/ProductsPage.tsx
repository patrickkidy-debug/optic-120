import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { productCreateSchema, type ProductCreateInput, LENS_PRODUCT_TYPES } from '@oculo/shared-types';
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
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';

const CATEGORIES = [
  { value: 'MONTURE', label: 'Montures' },
  { value: 'VERRE', label: 'Verres' },
  { value: 'LENTILLE', label: 'Lentilles' },
  { value: 'ACCESSOIRE', label: 'Accessoires' },
  { value: 'SERVICE', label: 'Services' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

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

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, category],
    queryFn: () => listProducts({ search: search || undefined, category: category || undefined }),
  });

  // Quantités du magasin actif, indexées par produit, pour ajuster sans quitter le catalogue.
  const { data: stock } = useQuery({
    queryKey: ['stock', branchId],
    queryFn: () => getStock(branchId!, false),
    enabled: Boolean(branchId),
  });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
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
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Produit</th>
                <th className="table-cell font-semibold">Référence</th>
                <th className="table-cell font-semibold">Catégorie</th>
                <th className="table-cell text-right font-semibold">Prix de vente</th>
                <th className="table-cell text-center font-semibold">Stock</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
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
                    {(() => {
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
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
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
            setAdjusting(null);
          }}
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
  const [serverError, setServerError] = useState('');
  const attrs = (product?.attributes ?? {}) as { lensType?: string; supplier?: string };
  // Attributs spécifiques aux verres, stockés dans product.attributes.
  const [lensType, setLensType] = useState(attrs.lensType ?? '');
  const [supplier, setSupplier] = useState(attrs.supplier ?? '');
  const [supplierOther, setSupplierOther] = useState(false);
  // Stock du magasin actif : quantité + seuil d'alerte, réglables dès la création.
  const [qty, setQty] = useState(stockRow?.quantity ?? 0);
  const [minAlert, setMinAlert] = useState(stockRow?.minAlert ?? 0);

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const {
    register,
    handleSubmit,
    watch,
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
        }
      : { category: 'MONTURE', buyPrice: 0, sellPrice: 0 },
  });

  const isLens = watch('category') === 'VERRE';

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
      // Type de verre + fournisseur rangés dans attributes (uniquement pour un verre).
      const withAttrs: ProductCreateInput = isLens
        ? {
            ...values,
            attributes: {
              ...(lensType ? { lensType } : {}),
              ...(supplier ? { supplier } : {}),
            },
          }
        : values;
      const saved = product ? await updateProduct(product.id, withAttrs) : await createProduct(withAttrs);
      // Appliquer le stock du magasin actif si la quantité ou le seuil ont changé.
      if (branchId) {
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
        <div className="grid grid-cols-2 gap-3">
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
        <Field label="Marque (optionnel)">
          <input className="input" {...register('brand')} />
        </Field>

        {/* Spécifique aux verres : type de verre + fournisseur. */}
        {isLens && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/25 bg-primary-soft/25 p-3">
            <Field label="Type de verre">
              <select
                className="input"
                value={lensType}
                onChange={(e) => setLensType(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {LENS_PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
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

        {/* Stock du magasin actif : quantité initiale (ou courante) + seuil d'alerte. */}
        {branchId && (
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
