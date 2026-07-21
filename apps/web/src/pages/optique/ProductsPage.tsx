import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react';
import { productCreateSchema, type ProductCreateInput, LENS_PRODUCT_TYPES } from '@oculo/shared-types';
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
} from '../../features/optique/api';
import { listSuppliers } from '../../features/management/api';
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

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, category],
    queryFn: () => listProducts({ search: search || undefined, category: category || undefined }),
  });

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
        <ProductModal product={editing} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const attrs = (product?.attributes ?? {}) as { lensType?: string; supplier?: string };
  // Attributs spécifiques aux verres, stockés dans product.attributes.
  const [lensType, setLensType] = useState(attrs.lensType ?? '');
  const [supplier, setSupplier] = useState(attrs.supplier ?? '');
  const [supplierOther, setSupplierOther] = useState(false);

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
    mutationFn: (values: ProductCreateInput) => {
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
      return product ? updateProduct(product.id, withAttrs) : createProduct(withAttrs);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
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
