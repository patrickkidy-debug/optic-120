import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Glasses, Package, Sparkles } from 'lucide-react';
import {
  ProductCategory,
  FRAME_TYPES,
  FRAME_GENDERS,
  FRAME_SHAPES,
  FRAME_MATERIALS,
  FRAME_COLORS,
  LENS_FAMILIES,
  LENS_MATERIALS,
  lensIndicesForMaterial,
  LENS_TINTS,
  LENS_DESIGNS,
  LENS_USAGES,
  LENS_TREATMENTS,
  type FrameAttributes,
  type LensAttributes,
  type GenericProductAttributes,
} from '@oculo/shared-types';
import {
  createProduct,
  updateProduct,
  adjustStock,
  type Product,
  type StockRow,
} from '../../features/optique/api';
import { listSuppliers } from '../../features/management/api';
import { apiErrorMessage } from '../../lib/api';
import { invalidateProductViews } from '../../lib/invalidate';
import { formatCurrency, toLocalDatetimeString } from '../../lib/format';
import { Button, Field, Modal } from '../../components/ui';
import { NumberInput } from '../../components/NumberInput';
import { FramePreview, frameAttrs } from './FrameCatalog';
import { LensPreview, lensAttrs } from './LensCatalog';
import { LensVisual } from '../../features/optique/LensVisual';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';
import { ProductSymbol } from '../../components/brand/ProductSymbol';

/** État commun aux deux formulaires du catalogue. */
interface BaseState {
  name: string;
  sku: string;
  brand: string;
  buyPrice: string;
  sellPrice: string;
  photoUrl: string;
  photos: string[];
  qty: number;
  minAlert: number;
  /** false = monture de présentation : vendue sans gestion de stock. */
  trackStock: boolean;
}

function baseFrom(product: Product | null, stockRow?: StockRow): BaseState {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    brand: product?.brand ?? '',
    buyPrice: product ? String(Number(product.buyPrice)) : '',
    sellPrice: product ? String(Number(product.sellPrice)) : '',
    photoUrl: product?.photoUrl ?? '',
    photos: product?.photos ?? [],
    qty: stockRow?.quantity ?? 0,
    minAlert: stockRow?.minAlert ?? 0,
    trackStock: product?.trackStock ?? true,
  };
}

/**
 * Enregistre le produit puis aligne le stock du magasin actif.
 * Mutualisé par les deux formulaires : même comportement que le catalogue
 * historique (création de la ligne de stock, ajustement du delta).
 */
function useSaveProduct({
  product,
  branchId,
  stockRow,
  category,
  onClose,
  applyStock,
  createdAt,
}: {
  product: Product | null;
  branchId: string | null;
  stockRow?: StockRow;
  category: string;
  onClose: () => void;
  applyStock: boolean;
  /** Date d'ajout modifiable (formulaire générique uniquement). */
  createdAt?: string;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: async ({
      base,
      attributes,
    }: {
      base: BaseState;
      attributes: Record<string, unknown>;
      /** Saisie en série : la fenêtre reste ouverte après l'enregistrement. */
      keepOpen?: boolean;
    }) => {
      const payload = {
        category: category as (typeof ProductCategory)[keyof typeof ProductCategory],
        name: base.name.trim(),
        sku: base.sku.trim() || undefined,
        brand: base.brand.trim() || undefined,
        buyPrice: Number(base.buyPrice) || 0,
        sellPrice: Number(base.sellPrice) || 0,
        photoUrl: base.photoUrl,
        photos: base.photos,
        attributes,
        trackStock: base.trackStock,
        ...(createdAt ? { createdAt: new Date(createdAt).toISOString() } : {}),
      };
      // Une duplication arrive avec un identifiant vide : c'est une création,
      // pas une modification de la fiche d'origine.
      const saved = product?.id
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);

      if (applyStock && branchId && base.trackStock) {
        const delta = base.qty - (stockRow?.quantity ?? 0);
        if (delta !== 0 || base.minAlert !== (stockRow?.minAlert ?? 0)) {
          await adjustStock({ productId: saved.id, branchId, delta, minAlert: base.minAlert });
        }
      }
      return saved;
    },
    onSuccess: (_saved, vars) => {
      invalidateProductViews(qc);
      if (!vars.keepOpen) onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return { mut, error };
}

/* =========================== FORMULAIRE MONTURE =========================== */

/**
 * Saisie d'une monture : la photo occupe la place principale, et la carte
 * telle qu'elle apparaîtra au catalogue se construit en direct à droite.
 */
export function FrameFormModal({
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
  const existing = product ? frameAttrs(product) : ({} as FrameAttributes);
  const [base, setBase] = useState<BaseState>(() => baseFrom(product, stockRow));
  const [a, setA] = useState<FrameAttributes>({
    model: existing.model ?? '',
    frameType: existing.frameType ?? '',
    gender: existing.gender ?? '',
    shape: existing.shape ?? '',
    color: existing.color ?? '',
    material: existing.material ?? '',
    size: existing.size ?? '',
    ean: existing.ean ?? '',
    location: existing.location ?? '',
    supplier: existing.supplier ?? '',
  });

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const { mut, error } = useSaveProduct({
    product,
    branchId,
    stockRow,
    category: ProductCategory.MONTURE,
    onClose,
    applyStock: true,
  });

  const set = (patch: Partial<BaseState>) => setBase((b) => ({ ...b, ...patch }));
  const setAttr = (patch: Partial<FrameAttributes>) => setA((x) => ({ ...x, ...patch }));

  // Le nom commercial se déduit de la marque et du modèle si l'opticien ne
  // saisit rien : « Ray-Ban RB5154 » plutôt qu'un champ vide.
  const effectiveName = base.name.trim() || [base.brand, a.model].filter(Boolean).join(' ').trim();
  const canSave = Boolean(effectiveName) && Number(base.sellPrice) >= 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? tr('ui.CatalogForms.modifierLaMonture') : tr('ui.CatalogForms.nouvelleMonture')}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_16rem]">
        {/* Saisie */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.marque')}>
              <input
                className="input"
                value={base.brand}
                onChange={(e) => set({ brand: e.target.value })}
                placeholder="Ray-Ban"
              />
            </Field>
            <Field label={tr('ui.CatalogForms.modele')}>
              <input
                className="input"
                value={a.model ?? ''}
                onChange={(e) => setAttr({ model: e.target.value })}
                placeholder="RB5154"
              />
            </Field>
          </div>

          <Field label={tr('ui.CatalogForms.designationLaissezVidePourMarque')}>
            <input
              className="input"
              value={base.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={effectiveName || tr('ui.CatalogForms.monture')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.referenceSku')}>
              <input
                className="input"
                value={base.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder={tr('ui.CatalogForms.genereeSiVide')}
              />
            </Field>
            <Field label={tr('ui.CatalogForms.eanCodeBarres')}>
              <input
                className="input"
                value={a.ean ?? ''}
                onChange={(e) => setAttr({ ean: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={tr('ui.CatalogForms.typeDeMonture')}>
              <select className="input" value={a.frameType ?? ''} onChange={(e) => setAttr({ frameType: e.target.value })}>
                <option value="">—</option>
                {FRAME_TYPES.map((t) => (
                  <option key={t} value={t}>{trFr(t)}</option>
                ))}
              </select>
            </Field>
            <Field label={tr('ui.CatalogForms.genre')}>
              <select className="input" value={a.gender ?? ''} onChange={(e) => setAttr({ gender: e.target.value })}>
                <option value="">—</option>
                {FRAME_GENDERS.map((g) => (
                  <option key={g} value={g}>{trFr(g)}</option>
                ))}
              </select>
            </Field>
            <Field label={tr('ui.CatalogForms.forme')}>
              <select className="input" value={a.shape ?? ''} onChange={(e) => setAttr({ shape: e.target.value })}>
                <option value="">—</option>
                {FRAME_SHAPES.map((f) => (
                  <option key={f} value={f}>{trFr(f)}</option>
                ))}
              </select>
            </Field>
            <Field label={tr('ui.CatalogForms.matiere')}>
              <select className="input" value={a.material ?? ''} onChange={(e) => setAttr({ material: e.target.value })}>
                <option value="">—</option>
                {FRAME_MATERIALS.map((m) => (
                  <option key={m} value={m}>{trFr(m)}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Couleur : choix visuel par pastille, plus rapide qu'une liste */}
          <div>
            <span className="label">{tr('ui.CatalogForms.couleur')}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {FRAME_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={trFr(c.name)}
                  onClick={() => setAttr({ color: a.color === c.name ? '' : c.name })}
                  style={{ background: c.hex }}
                  className={`h-7 w-7 rounded-full border transition ${
                    a.color === c.name
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-[color:var(--surface)]'
                      : 'hover:scale-110'
                  }`}
                />
              ))}
              {a.color && <span className="ml-1 text-xs text-content-muted">{a.color}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.tailleCalibrePontBranches')}>
              <input
                className="input"
                value={a.size ?? ''}
                onChange={(e) => setAttr({ size: e.target.value })}
                placeholder="52-18-140"
              />
            </Field>
            <Field label={tr('ui.CatalogForms.emplacementEnBoutique')}>
              <input
                className="input"
                value={a.location ?? ''}
                onChange={(e) => setAttr({ location: e.target.value })}
                placeholder={tr('ui.CatalogForms.vitrineAEtagere2')}
              />
            </Field>
          </div>

          <Field label={tr('ui.CatalogForms.fournisseur')}>
            <input
              className="input"
              list="frame-suppliers"
              value={a.supplier ?? ''}
              onChange={(e) => setAttr({ supplier: e.target.value })}
              placeholder={tr('ui.CatalogForms.nomDuFournisseur')}
            />
            <datalist id="frame-suppliers">
              {suppliers?.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.prixDAchat')}>
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.buyPrice}
                onChange={(e) => set({ buyPrice: e.target.value })}
              />
            </Field>
            <Field label={tr('ui.CatalogForms.prixDeVente')}>
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.sellPrice}
                onChange={(e) => set({ sellPrice: e.target.value })}
              />
            </Field>
          </div>

          {/* Monture de présentation : exposée en vitrine, vendue sans contrôle
              ni sortie de stock (commandée au fournisseur après la vente). */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[color:var(--primary)]"
              checked={!base.trackStock}
              onChange={(e) => set({ trackStock: !e.target.checked })}
            />
            <span>
              <span className="font-semibold text-content">{tr('ui.CatalogForms.displayFrame')}</span>
              <span className="block text-xs text-content-muted">{tr('ui.CatalogForms.displayFrameHint')}</span>
            </span>
          </label>

          {base.trackStock && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
            <Field label={tr('ui.CatalogForms.quantiteEnStock')}>
              <NumberInput
                min={0}
                className="input text-right"
                value={base.qty}
                onChange={(n) => set({ qty: n })}
              />
            </Field>
            <Field label={tr('ui.CatalogForms.seuilDAlerte')}>
              <NumberInput
                min={0}
                className="input text-right"
                value={base.minAlert}
                onChange={(n) => set({ minAlert: n })}
              />
            </Field>
          </div>
          )}
        </div>

        {/* Aperçu : la carte telle qu'elle sortira au catalogue */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
            {tr('ui.CatalogForms.apercuAuCatalogue')}
          </p>
          <FramePreview
            photoUrl={base.photoUrl}
            brand={base.brand}
            model={a.model ?? ''}
            sku={base.sku}
            price={Number(base.sellPrice) || 0}
            gender={a.gender}
            shape={a.shape}
            size={a.size}
            color={a.color}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose}>
          {tr('ui.CatalogForms.annuler')}
        </Button>
        <Button
          disabled={!canSave}
          loading={mut.isPending}
          onClick={() =>
            mut.mutate({
              base: { ...base, name: effectiveName },
              attributes: Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v != null)),
            })
          }
        >
          <Glasses className="h-4 w-4" /> {product ? tr('ui.CatalogForms.enregistrer') : tr('ui.CatalogForms.ajouterLaMonture')}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================ FORMULAIRE VERRE ============================ */

/** Étapes du formulaire verre (clés de traduction, libellés via tr()). */
const LENS_STEPS = [
  'ui.CatalogForms.identification',
  'ui.CatalogForms.typeDeVerre',
  'ui.CatalogForms.parametresTechniques',
  'ui.CatalogForms.traitements',
  'ui.CatalogForms.tarification',
  'ui.CatalogForms.illustration',
  'ui.CatalogForms.resume',
] as const;

/**
 * Saisie d'un verre en sept étapes, avec l'aperçu de la carte mis à jour à
 * chaque choix : on voit ce que verra le vendeur avant d'enregistrer.
 */
/** Indices proposés en pastilles (le catalogue n'utilise pas le polycarbonate). */
const QUICK_INDICES = ['1.5', '1.56', '1.6', '1.67', '1.74'];

/**
 * Fiche verre en un seul écran : type (vignettes illustrées), indice et
 * traitements en pastilles, prix et marge, nom généré automatiquement. Les
 * détails techniques facultatifs sont repliés. « Enregistrer et ajouter un
 * autre » garde le type, l'indice et les traitements pour saisir une gamme
 * entière rapidement.
 */
export function LensFormModal({
  product,
  branchId,
  onClose,
}: {
  product: Product | null;
  branchId: string | null;
  onClose: () => void;
}) {
  const existing = product ? lensAttrs(product) : ({} as LensAttributes);
  const [base, setBase] = useState<BaseState>(() => baseFrom(product));
  const [a, setA] = useState<LensAttributes>({
    family: existing.family ?? '',
    range: existing.range ?? '',
    index: existing.index ?? '',
    material: existing.material ?? '',
    treatments: existing.treatments ?? [],
    tint: existing.tint ?? '',
    design: existing.design ?? '',
    usage: existing.usage ?? '',
    premium: existing.premium ?? false,
  });
  const [more, setMore] = useState(
    Boolean(existing.range || existing.material || existing.design || existing.usage || existing.tint || product?.brand),
  );
  const [nameTouched, setNameTouched] = useState(Boolean(product));
  const [saved, setSaved] = useState(0);

  const { mut, error } = useSaveProduct({
    product,
    branchId,
    category: ProductCategory.VERRE,
    onClose,
    applyStock: false,
  });

  const set = (patch: Partial<BaseState>) => setBase((b) => ({ ...b, ...patch }));
  const setAttr = (patch: Partial<LensAttributes>) => setA((x) => ({ ...x, ...patch }));
  const toggleTreatment = (t: string) =>
    setAttr({
      treatments: (a.treatments ?? []).includes(t)
        ? (a.treatments ?? []).filter((x) => x !== t)
        : [...(a.treatments ?? []), t],
    });

  const familyLabel = LENS_FAMILIES.find((f) => f.key === a.family)?.label ?? '';
  // Nom proposé : « Progressif 1.67 · Anti-reflet, Anti-lumière bleue ».
  const autoName = [[familyLabel, a.index, a.range].filter(Boolean).join(' '), (a.treatments ?? []).join(', ')]
    .filter(Boolean)
    .join(' · ');
  const effectiveName = (nameTouched ? base.name : '').trim() || autoName;
  const canSave = Boolean(effectiveName) && Boolean(a.family) && Number(base.sellPrice) > 0;
  const buy = Number(base.buyPrice) || 0;
  const sell = Number(base.sellPrice) || 0;
  const margin = sell > 0 && buy > 0 ? Math.round(((sell - buy) / sell) * 100) : null;

  function save(keepOpen: boolean) {
    mut.mutate(
      {
        base: { ...base, name: effectiveName },
        attributes: Object.fromEntries(
          Object.entries(a).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0)),
        ),
        keepOpen,
      },
      {
        onSuccess: () => {
          if (!keepOpen) return;
          // Série : on garde type / indice / traitements / marque, on vide le reste.
          setSaved((n) => n + 1);
          setNameTouched(false);
          setBase((b) => ({ ...b, name: '', sku: '', buyPrice: '', sellPrice: '' }));
        },
      },
    );
  }

  const chip = (on: boolean) =>
    `inline-flex min-h-[38px] items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      on ? 'border-transparent bg-primary text-white' : 'border-line bg-surface-2 text-content-muted hover:border-primary/40'
    }`;
  const marginTone =
    margin == null ? 'bg-surface-2 text-content-faint' : margin < 0 ? 'bg-[color:var(--danger)]/15 text-danger' : 'bg-[color:var(--success)]/15 text-success';
  const marginText =
    margin == null ? 'Marge : —' : margin < 0 ? `Vente à perte (${margin} %)` : `Marge : ${formatCurrency(sell - buy)} (${margin} %)`;

  return (
    <Modal open onClose={onClose} title={product ? tr('ui.CatalogForms.modifierLeVerre') : tr('ui.CatalogForms.nouveauVerre')} size="lg">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-5">
          <section>
            <p className="label">1. Type de verre</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LENS_FAMILIES.filter((f) => f.key !== 'PERSONNALISE').map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setAttr({ family: f.key })}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    a.family === f.key ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:border-primary/40'
                  }`}
                >
                  <LensVisual family={f.key} className="block h-14 w-full" />
                  <span className="block px-2 py-1.5 text-xs font-semibold text-content">{f.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="label">2. Indice</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_INDICES.map((i) => (
                <button key={i} type="button" onClick={() => setAttr({ index: a.index === i ? '' : i })} className={chip(a.index === i)}>
                  {i}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="label">3. Traitements</p>
            <div className="flex flex-wrap gap-1.5">
              {LENS_TREATMENTS.map((t) => {
                const on = (a.treatments ?? []).includes(t.label);
                return (
                  <button key={t.key} type="button" onClick={() => toggleTreatment(t.label)} className={chip(on)}>
                    {on && <Check className="h-3.5 w-3.5" />} {t.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="label">4. Prix</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label={tr('ui.CatalogForms.prixDAchat')}>
                <input type="number" min={0} inputMode="numeric" className="input text-right" value={base.buyPrice} onChange={(e) => set({ buyPrice: e.target.value })} />
              </Field>
              <Field label={tr('ui.CatalogForms.prixDeVente')}>
                <input type="number" min={0} inputMode="numeric" className="input text-right" value={base.sellPrice} onChange={(e) => set({ sellPrice: e.target.value })} />
              </Field>
              <div className="col-span-2 flex items-end sm:col-span-1">
                <p className={`w-full rounded-xl px-3 py-2.5 text-sm ${marginTone}`}>{marginText}</p>
              </div>
            </div>
          </section>

          <section>
            <Field label="5. Nom affiché en caisse">
              <input
                className="input"
                value={nameTouched ? base.name : autoName}
                placeholder="Choisissez le type, l’indice et les traitements"
                onChange={(e) => {
                  setNameTouched(true);
                  set({ name: e.target.value });
                }}
              />
            </Field>
            {nameTouched && (
              <button
                type="button"
                onClick={() => {
                  setNameTouched(false);
                  set({ name: '' });
                }}
                className="mt-1 text-xs font-medium text-primary"
              >
                Revenir au nom automatique
              </button>
            )}
          </section>

          <section className="rounded-xl border border-line">
            <button type="button" onClick={() => setMore((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-content">
              Plus de détails (marque, gamme, référence, matériau…)
              <ChevronRight className={`h-4 w-4 transition ${more ? 'rotate-90' : ''}`} />
            </button>
            {more && (
              <div className="space-y-3 border-t border-line px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tr('ui.CatalogForms.marque')}>
                    <input className="input" value={base.brand} onChange={(e) => set({ brand: e.target.value })} placeholder={tr('ui.CatalogForms.essilor')} />
                  </Field>
                  <Field label={tr('ui.CatalogForms.gamme')}>
                    <input className="input" value={a.range ?? ''} onChange={(e) => setAttr({ range: e.target.value })} placeholder={tr('ui.CatalogForms.variluxComfort')} />
                  </Field>
                  <Field label={tr('ui.CatalogForms.referenceSku')}>
                    <input className="input" value={base.sku} onChange={(e) => set({ sku: e.target.value })} placeholder={tr('ui.CatalogForms.genereeSiVide')} />
                  </Field>
                  <Field label={tr('ui.CatalogForms.materiau')}>
                    <select className="input" value={a.material ?? ''} onChange={(e) => setAttr({ material: e.target.value })}>
                      <option value="">—</option>
                      {LENS_MATERIALS.filter((m) => m !== 'Polycarbonate').map((m) => (
                        <option key={m} value={m}>{trFr(m)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tr('ui.CatalogForms.design')}>
                    <select className="input" value={a.design ?? ''} onChange={(e) => setAttr({ design: e.target.value })}>
                      <option value="">—</option>
                      {LENS_DESIGNS.map((d) => (
                        <option key={d} value={d}>{trFr(d)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tr('ui.CatalogForms.usage')}>
                    <select className="input" value={a.usage ?? ''} onChange={(e) => setAttr({ usage: e.target.value })}>
                      <option value="">—</option>
                      {LENS_USAGES.map((u) => (
                        <option key={u} value={u}>{trFr(u)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tr('ui.CatalogForms.teinte')}>
                    <select className="input" value={a.tint ?? ''} onChange={(e) => setAttr({ tint: e.target.value })}>
                      <option value="">—</option>
                      {LENS_TINTS.map((t) => (
                        <option key={t} value={t}>{trFr(t)}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-content">
                  <input type="checkbox" checked={Boolean(a.premium)} onChange={(e) => setAttr({ premium: e.target.checked })} />
                  <Sparkles className="h-4 w-4 text-warning" /> {tr('ui.CatalogForms.gammePremiumMiseEnAvant')}
                </label>
              </div>
            )}
          </section>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">{tr('ui.CatalogForms.apercuAuCatalogue')}</p>
          <LensPreview brand={base.brand} range={a.range ?? ''} name={effectiveName} sku={base.sku} price={sell} attrs={a} photoUrl={base.photoUrl} />
          {saved > 0 && (
            <p className="mt-3 rounded-lg bg-[color:var(--success)]/15 px-3 py-2 text-xs font-semibold text-success">
              <Check className="mr-1 inline h-3.5 w-3.5" /> {saved} verre(s) ajouté(s), disponible(s) en caisse.
            </p>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {!canSave && <p className="mt-3 text-xs text-content-faint">Pour enregistrer : choisissez le type de verre et indiquez un prix de vente.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose}>
          {tr('ui.CatalogForms.annuler')}
        </Button>
        {!product && (
          <Button variant="outline" disabled={!canSave} loading={mut.isPending && Boolean(mut.variables?.keepOpen)} onClick={() => save(true)}>
            Enregistrer et ajouter un autre
          </Button>
        )}
        <Button disabled={!canSave} loading={mut.isPending && !mut.variables?.keepOpen} onClick={() => save(false)}>
          <Check className="h-4 w-4" /> {product ? tr('ui.CatalogForms.enregistrer') : tr('ui.CatalogForms.ajouterLeVerre')}
        </Button>
      </div>
    </Modal>
  );
}

/* ======================= FORMULAIRE PRODUIT GÉNÉRIQUE ======================= */

/** Libellés d'affichage des 5 familles couvertes par le formulaire générique. */
const GENERIC_CATEGORY_LABELS: Record<string, string> = {
  get LENTILLE() { return tr('ui.CatalogForms.lentilles'); },
  get ACCESSOIRE() { return tr('ui.CatalogForms.accessoires'); },
  get ENTRETIEN() { return tr('ui.CatalogForms.produitsDEntretien'); },
  SERVICE: 'Services',
  get AUTRE() { return tr('ui.CatalogForms.autres'); },
};

function genericCategoryLabel(category: string): string {
  return GENERIC_CATEGORY_LABELS[category] ?? category;
}

/** Attributs génériques d'un produit, typés et sûrs même si le JSON est vide. */
function genericAttrs(p: Product | null): GenericProductAttributes {
  return (p?.attributes ?? {}) as GenericProductAttributes;
}

/** Aperçu réduit de la carte, affiché en direct pendant la saisie. */
function GenericProductPreview({
  photoUrl,
  name,
  brand,
  sku,
  price,
  category,
}: {
  photoUrl: string;
  name: string;
  brand: string;
  sku: string;
  price: number;
  category: string;
}) {
  return (
    <div className="card w-full max-w-[16rem] overflow-hidden">
      <ProductSymbol category={category} seed={sku || name} name={name} brand={brand} className="aspect-[4/3] w-full" />
      <div className="p-3">
        <span className="badge bg-surface-3 px-2 py-0.5 text-[10px] text-content-muted">
          {genericCategoryLabel(category)}
        </span>
        <p className="mt-1 truncate text-sm font-semibold text-content">{name || tr('ui.CatalogForms.nouveauProduit')}</p>
        {brand && <p className="truncate text-xs text-content-faint">{brand}</p>}
        <p className="mt-0.5 font-mono text-[11px] text-content-faint">{sku || tr('ui.CatalogForms.referenceAuto')}</p>
        <p className="mt-3 font-display text-lg font-bold text-content">{formatCurrency(price || 0)}</p>
      </div>
    </div>
  );
}

/**
 * Saisie d'un produit des familles Lentilles / Accessoires / Entretien /
 * Services / Autres : même architecture que la monture (photo + aperçu en
 * direct à droite, sections groupées), mais avec des champs neutres — aucun
 * n'est spécifique à une famille en particulier.
 */
export function GenericProductFormModal({
  product,
  branchId,
  stockRow,
  category,
  onClose,
}: {
  product: Product | null;
  branchId: string | null;
  stockRow?: StockRow;
  category: string;
  onClose: () => void;
}) {
  const existing = genericAttrs(product);
  const [base, setBase] = useState<BaseState>(() => baseFrom(product, stockRow));
  const [a, setA] = useState<GenericProductAttributes>({
    ean: existing.ean ?? '',
    location: existing.location ?? '',
    supplier: existing.supplier ?? '',
  });
  const [createdAt, setCreatedAt] = useState(() =>
    toLocalDatetimeString(product?.createdAt ?? new Date()),
  );

  // Famille modifiable : indispensable pour rattraper un produit rangé dans la
  // mauvaise catégorie (import, saisie rapide) sans passer par un déplacement
  // en masse de toute une famille.
  const [cat, setCat] = useState(category);

  // Les services sont réalisés à la demande, comme les verres : pas de stock à gérer.
  const managesStock = cat !== ProductCategory.SERVICE;

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const { mut, error } = useSaveProduct({
    product,
    branchId,
    stockRow,
    category: cat,
    onClose,
    applyStock: managesStock,
    createdAt,
  });

  const set = (patch: Partial<BaseState>) => setBase((b) => ({ ...b, ...patch }));
  const setAttr = (patch: Partial<GenericProductAttributes>) => setA((x) => ({ ...x, ...patch }));

  const label = genericCategoryLabel(cat);
  const canSave = Boolean(base.name.trim()) && Number(base.sellPrice) >= 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? tr('ui.CatalogForms.modifierLabel', { label: label }) : tr('ui.CatalogForms.nouveauLabel', { label: label })}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_16rem]">
        {/* Saisie */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.nomDuProduit')}>
              <input
                className="input"
                value={base.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder={label}
              />
            </Field>
            <Field label={tr('ui.CatalogForms.famille')}>
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
                {Object.entries(GENERIC_CATEGORY_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
                <option value={ProductCategory.MONTURE}>{tr('ui.CatalogForms.montures')}</option>
                <option value={ProductCategory.VERRE}>{tr('ui.CatalogForms.verres')}</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.referenceSku')}>
              <input
                className="input"
                value={base.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder={tr('ui.CatalogForms.genereeSiVide')}
              />
            </Field>
            <Field label={tr('ui.CatalogForms.eanCodeBarres')}>
              <input
                className="input"
                value={a.ean ?? ''}
                onChange={(e) => setAttr({ ean: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.marque')}>
              <input
                className="input"
                value={base.brand}
                onChange={(e) => set({ brand: e.target.value })}
              />
            </Field>
            <Field label={tr('ui.CatalogForms.emplacementEnBoutique')}>
              <input
                className="input"
                value={a.location ?? ''}
                onChange={(e) => setAttr({ location: e.target.value })}
                placeholder={tr('ui.CatalogForms.vitrineAEtagere2')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.fournisseur')}>
              <input
                className="input"
                list="generic-suppliers"
                value={a.supplier ?? ''}
                onChange={(e) => setAttr({ supplier: e.target.value })}
                placeholder={tr('ui.CatalogForms.nomDuFournisseur')}
              />
              <datalist id="generic-suppliers">
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </Field>
            <Field label={tr('ui.CatalogForms.dateDAjout')}>
              <input
                type="datetime-local"
                className="input"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('ui.CatalogForms.prixDAchat')}>
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.buyPrice}
                onChange={(e) => set({ buyPrice: e.target.value })}
              />
            </Field>
            <Field label={tr('ui.CatalogForms.prixDeVente')}>
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.sellPrice}
                onChange={(e) => set({ sellPrice: e.target.value })}
              />
            </Field>
          </div>

          {managesStock ? (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
              <Field label={tr('ui.CatalogForms.quantiteEnStock')}>
                <NumberInput
                  min={0}
                  className="input text-right"
                  value={base.qty}
                  onChange={(n) => set({ qty: n })}
                />
              </Field>
              <Field label={tr('ui.CatalogForms.seuilDAlerte')}>
                <NumberInput
                  min={0}
                  className="input text-right"
                  value={base.minAlert}
                  onChange={(n) => set({ minAlert: n })}
                />
              </Field>
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-surface-2/40 p-3 text-xs text-content-muted">
              {tr('ui.CatalogForms.prestationRealiseeALaDemande')}
            </p>
          )}
        </div>

        {/* Aperçu : la carte telle qu'elle sortira au catalogue */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
            {tr('ui.CatalogForms.apercuAuCatalogue')}
          </p>
          <GenericProductPreview
            photoUrl={base.photoUrl}
            name={base.name}
            brand={base.brand}
            sku={base.sku}
            price={Number(base.sellPrice) || 0}
            category={category}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose}>
          {tr('ui.CatalogForms.annuler')}
        </Button>
        <Button
          disabled={!canSave}
          loading={mut.isPending}
          onClick={() =>
            mut.mutate({
              base,
              attributes: Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v != null)),
            })
          }
        >
          <Package className="h-4 w-4" /> {product ? tr('ui.CatalogForms.enregistrer') : tr('ui.CatalogForms.ajouterAuCatalogue')}
        </Button>
      </div>
    </Modal>
  );
}
