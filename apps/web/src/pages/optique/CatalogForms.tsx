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
import { PhotoUploader } from '../../features/optique/PhotoUploader';
import { apiErrorMessage } from '../../lib/api';
import { invalidateProductViews } from '../../lib/invalidate';
import { formatCurrency, toLocalDatetimeString } from '../../lib/format';
import { Button, Field, Modal } from '../../components/ui';
import { FramePreview, frameAttrs } from './FrameCatalog';
import { LensPreview, lensAttrs } from './LensCatalog';

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
        ...(createdAt ? { createdAt: new Date(createdAt).toISOString() } : {}),
      };
      // Une duplication arrive avec un identifiant vide : c'est une création,
      // pas une modification de la fiche d'origine.
      const saved = product?.id
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);

      // Le serveur renvoie la fiche telle qu'il l'a enregistrée. Si la photo
      // envoyée n'y figure pas, on le dit : mieux vaut un message clair qu'une
      // vignette manquante sans explication.
      if (base.photoUrl && !saved?.photoUrl) {
        throw new Error(
          "La photo n'a pas été conservée par le serveur. Réessayez dans un instant ; si le problème persiste, signalez-le.",
        );
      }
      if (applyStock && branchId) {
        const delta = base.qty - (stockRow?.quantity ?? 0);
        if (delta !== 0 || base.minAlert !== (stockRow?.minAlert ?? 0)) {
          await adjustStock({ productId: saved.id, branchId, delta, minAlert: base.minAlert });
        }
      }
      return saved;
    },
    onSuccess: () => {
      invalidateProductViews(qc);
      onClose();
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
      title={product ? 'Modifier la monture' : 'Nouvelle monture'}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_16rem]">
        {/* Saisie */}
        <div className="space-y-4">
          <PhotoUploader
            photoUrl={base.photoUrl}
            photos={base.photos}
            onChange={({ photoUrl, photos }) => set({ photoUrl, photos })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marque">
              <input
                className="input"
                value={base.brand}
                onChange={(e) => set({ brand: e.target.value })}
                placeholder="Ray-Ban"
              />
            </Field>
            <Field label="Modèle">
              <input
                className="input"
                value={a.model ?? ''}
                onChange={(e) => setAttr({ model: e.target.value })}
                placeholder="RB5154"
              />
            </Field>
          </div>

          <Field label="Désignation (laissez vide pour « Marque Modèle »)">
            <input
              className="input"
              value={base.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={effectiveName || 'Monture'}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Référence (SKU)">
              <input
                className="input"
                value={base.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="Générée si vide"
              />
            </Field>
            <Field label="EAN / code-barres">
              <input
                className="input"
                value={a.ean ?? ''}
                onChange={(e) => setAttr({ ean: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Type de monture">
              <select className="input" value={a.frameType ?? ''} onChange={(e) => setAttr({ frameType: e.target.value })}>
                <option value="">—</option>
                {FRAME_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Genre">
              <select className="input" value={a.gender ?? ''} onChange={(e) => setAttr({ gender: e.target.value })}>
                <option value="">—</option>
                {FRAME_GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Forme">
              <select className="input" value={a.shape ?? ''} onChange={(e) => setAttr({ shape: e.target.value })}>
                <option value="">—</option>
                {FRAME_SHAPES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Matière">
              <select className="input" value={a.material ?? ''} onChange={(e) => setAttr({ material: e.target.value })}>
                <option value="">—</option>
                {FRAME_MATERIALS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Couleur : choix visuel par pastille, plus rapide qu'une liste */}
          <div>
            <span className="label">Couleur</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {FRAME_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
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
            <Field label="Taille (calibre-pont-branches)">
              <input
                className="input"
                value={a.size ?? ''}
                onChange={(e) => setAttr({ size: e.target.value })}
                placeholder="52-18-140"
              />
            </Field>
            <Field label="Emplacement en boutique">
              <input
                className="input"
                value={a.location ?? ''}
                onChange={(e) => setAttr({ location: e.target.value })}
                placeholder="Vitrine A, étagère 2"
              />
            </Field>
          </div>

          <Field label="Fournisseur">
            <input
              className="input"
              list="frame-suppliers"
              value={a.supplier ?? ''}
              onChange={(e) => setAttr({ supplier: e.target.value })}
              placeholder="Nom du fournisseur"
            />
            <datalist id="frame-suppliers">
              {suppliers?.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix d'achat">
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.buyPrice}
                onChange={(e) => set({ buyPrice: e.target.value })}
              />
            </Field>
            <Field label="Prix de vente">
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.sellPrice}
                onChange={(e) => set({ sellPrice: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
            <Field label="Quantité en stock">
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.qty}
                onChange={(e) => set({ qty: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Field>
            <Field label="Seuil d'alerte">
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.minAlert}
                onChange={(e) => set({ minAlert: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Field>
          </div>
        </div>

        {/* Aperçu : la carte telle qu'elle sortira au catalogue */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
            Aperçu au catalogue
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
          Annuler
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
          <Glasses className="h-4 w-4" /> {product ? 'Enregistrer' : 'Ajouter la monture'}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================ FORMULAIRE VERRE ============================ */

const LENS_STEPS = [
  'Identification',
  'Type de verre',
  'Paramètres techniques',
  'Traitements',
  'Tarification',
  'Illustration',
  'Résumé',
] as const;

/**
 * Saisie d'un verre en sept étapes, avec l'aperçu de la carte mis à jour à
 * chaque choix : on voit ce que verra le vendeur avant d'enregistrer.
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
  const [step, setStep] = useState(0);
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

  // Les verres sont fabriqués sur commande : pas de stock à gérer ici.
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
  const effectiveName =
    base.name.trim() || [familyLabel, a.index ? `${a.index}` : '', a.range].filter(Boolean).join(' ').trim();
  const canSave = Boolean(effectiveName);

  const summary = useMemo(
    () =>
      [
        ['Marque', base.brand],
        ['Gamme', a.range],
        ['Type', familyLabel],
        ['Indice', a.index],
        ['Matériau', a.material],
        ['Traitements', (a.treatments ?? []).join(', ')],
        ['Teinte', a.tint],
        ['Design', a.design],
        ['Usage', a.usage],
      ].filter(([, v]) => Boolean(v)) as [string, string][],
    [base.brand, a, familyLabel],
  );

  return (
    <Modal open onClose={onClose} title={product ? 'Modifier le verre' : 'Nouveau verre'} size="lg">
      {/* Progression */}
      <div className="mb-4 flex flex-wrap gap-1">
        {LENS_STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`badge px-2.5 py-1 text-[11px] transition ${
              i === step
                ? 'bg-primary text-white'
                : i < step
                  ? 'bg-primary-soft text-primary'
                  : 'bg-surface-2 text-content-faint'
            }`}
          >
            {i < step && <Check className="h-3 w-3" />} {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_16rem]">
        <div className="min-h-[18rem] space-y-4">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marque">
                  <input className="input" value={base.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Essilor" />
                </Field>
                <Field label="Gamme">
                  <input className="input" value={a.range ?? ''} onChange={(e) => setAttr({ range: e.target.value })} placeholder="Varilux Comfort" />
                </Field>
              </div>
              <Field label="Désignation (laissez vide pour la déduire)">
                <input className="input" value={base.name} onChange={(e) => set({ name: e.target.value })} placeholder={effectiveName || 'Verre'} />
              </Field>
              <Field label="Référence (SKU)">
                <input className="input" value={base.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="Générée si vide" />
              </Field>
            </>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LENS_FAMILIES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setAttr({ family: f.key })}
                  className={`card p-3 text-left transition hover:border-primary ${
                    a.family === f.key ? 'border-primary ring-2 ring-primary/25' : ''
                  }`}
                >
                  <span className="text-sm font-semibold text-content">{f.label}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              <Field label="Matériau">
                <select
                  className="input"
                  value={a.material ?? ''}
                  onChange={(e) => {
                    const material = e.target.value;
                    const available = lensIndicesForMaterial(material);
                    // Un matériau à indice unique (CR-39, Polycarbonate, Trivex) le
                    // fixe automatiquement ; sinon on efface l'indice s'il n'est
                    // plus valide pour le nouveau matériau (Minéral/Haut indice).
                    const nextIndex =
                      available.length === 1
                        ? available[0].id
                        : available.some((i) => i.id === a.index)
                          ? a.index
                          : '';
                    setAttr({ material, index: nextIndex });
                  }}
                >
                  <option value="">—</option>
                  {LENS_MATERIALS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Indice de réfraction">
                <select
                  className="input"
                  value={a.index ?? ''}
                  disabled={lensIndicesForMaterial(a.material).length <= 1 && !!a.material}
                  onChange={(e) => setAttr({ index: e.target.value })}
                >
                  <option value="">—</option>
                  {lensIndicesForMaterial(a.material).map((i) => (
                    <option key={i.id} value={i.id}>{i.label}</option>
                  ))}
                </select>
                {!a.material && (
                  <p className="mt-1 text-xs text-content-faint">Choisissez d'abord le matériau pour affiner les indices proposés.</p>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Design">
                  <select className="input" value={a.design ?? ''} onChange={(e) => setAttr({ design: e.target.value })}>
                    <option value="">—</option>
                    {LENS_DESIGNS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Usage">
                  <select className="input" value={a.usage ?? ''} onChange={(e) => setAttr({ usage: e.target.value })}>
                    <option value="">—</option>
                    {LENS_USAGES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <span className="label">Traitements</span>
                <div className="flex flex-wrap gap-1.5">
                  {LENS_TREATMENTS.map((t) => {
                    const on = (a.treatments ?? []).includes(t.label);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleTreatment(t.label)}
                        className={`badge px-3 py-1.5 text-xs transition ${
                          on ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />} {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Teinte">
                <select className="input" value={a.tint ?? ''} onChange={(e) => setAttr({ tint: e.target.value })}>
                  <option value="">—</option>
                  {LENS_TINTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-content">
                <input
                  type="checkbox"
                  checked={Boolean(a.premium)}
                  onChange={(e) => setAttr({ premium: e.target.checked })}
                />
                <Sparkles className="h-4 w-4 text-warning" /> Gamme premium (mise en avant au catalogue)
              </label>
            </>
          )}

          {step === 4 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix d'achat">
                <input
                  type="number"
                  min={0}
                  className="input text-right"
                  value={base.buyPrice}
                  onChange={(e) => set({ buyPrice: e.target.value })}
                />
              </Field>
              <Field label="Prix de vente">
                <input
                  type="number"
                  min={0}
                  className="input text-right"
                  value={base.sellPrice}
                  onChange={(e) => set({ sellPrice: e.target.value })}
                />
              </Field>
            </div>
          )}

          {step === 5 && (
            <>
              <p className="text-sm text-content-muted">
                Facultatif : sans photo, le catalogue utilise l'illustration correspondant au type
                de verre choisi.
              </p>
              <PhotoUploader
                photoUrl={base.photoUrl}
                photos={base.photos}
                onChange={({ photoUrl, photos }) => set({ photoUrl, photos })}
              />
            </>
          )}

          {step === 6 && (
            <div className="rounded-xl border p-4">
              <p className="font-display text-lg font-bold text-content">{effectiveName || 'Verre'}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                {summary.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b pb-1 last:border-0">
                    <dt className="text-content-muted">{k}</dt>
                    <dd className="text-right font-medium text-content">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
            Aperçu au catalogue
          </p>
          <LensPreview
            brand={base.brand}
            range={a.range ?? ''}
            name={effectiveName}
            sku={base.sku}
            price={Number(base.sellPrice) || 0}
            attrs={a}
            photoUrl={base.photoUrl}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          {step < LENS_STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(LENS_STEPS.length - 1, s + 1))}>
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              disabled={!canSave}
              loading={mut.isPending}
              onClick={() =>
                mut.mutate({
                  base: { ...base, name: effectiveName },
                  attributes: Object.fromEntries(
                    Object.entries(a).filter(
                      ([, v]) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0),
                    ),
                  ),
                })
              }
            >
              <Check className="h-4 w-4" /> {product ? 'Enregistrer' : 'Ajouter le verre'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ======================= FORMULAIRE PRODUIT GÉNÉRIQUE ======================= */

/** Libellés d'affichage des 5 familles couvertes par le formulaire générique. */
const GENERIC_CATEGORY_LABELS: Record<string, string> = {
  LENTILLE: 'Lentilles',
  ACCESSOIRE: 'Accessoires',
  ENTRETIEN: "Produits d'entretien",
  SERVICE: 'Services',
  AUTRE: 'Autres',
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
      <div className="aspect-[4/3] w-full bg-surface-2">
        {photoUrl ? (
          <img src={photoUrl} alt="Aperçu" className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full place-items-center">
            <Package className="h-8 w-8 text-content-faint" />
          </div>
        )}
      </div>
      <div className="p-3">
        <span className="badge bg-surface-3 px-2 py-0.5 text-[10px] text-content-muted">
          {genericCategoryLabel(category)}
        </span>
        <p className="mt-1 truncate text-sm font-semibold text-content">{name || 'Nouveau produit'}</p>
        {brand && <p className="truncate text-xs text-content-faint">{brand}</p>}
        <p className="mt-0.5 font-mono text-[11px] text-content-faint">{sku || 'Référence auto'}</p>
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
      title={product ? `Modifier — ${label}` : `Nouveau — ${label}`}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_16rem]">
        {/* Saisie */}
        <div className="space-y-4">
          <PhotoUploader
            photoUrl={base.photoUrl}
            photos={base.photos}
            onChange={({ photoUrl, photos }) => set({ photoUrl, photos })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom du produit">
              <input
                className="input"
                value={base.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder={label}
              />
            </Field>
            <Field label="Famille">
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
                {Object.entries(GENERIC_CATEGORY_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
                <option value={ProductCategory.MONTURE}>Montures</option>
                <option value={ProductCategory.VERRE}>Verres</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Référence (SKU)">
              <input
                className="input"
                value={base.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="Générée si vide"
              />
            </Field>
            <Field label="EAN / code-barres">
              <input
                className="input"
                value={a.ean ?? ''}
                onChange={(e) => setAttr({ ean: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marque">
              <input
                className="input"
                value={base.brand}
                onChange={(e) => set({ brand: e.target.value })}
              />
            </Field>
            <Field label="Emplacement en boutique">
              <input
                className="input"
                value={a.location ?? ''}
                onChange={(e) => setAttr({ location: e.target.value })}
                placeholder="Vitrine A, étagère 2"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fournisseur">
              <input
                className="input"
                list="generic-suppliers"
                value={a.supplier ?? ''}
                onChange={(e) => setAttr({ supplier: e.target.value })}
                placeholder="Nom du fournisseur"
              />
              <datalist id="generic-suppliers">
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Date d'ajout">
              <input
                type="datetime-local"
                className="input"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix d'achat">
              <input
                type="number"
                min={0}
                className="input text-right"
                value={base.buyPrice}
                onChange={(e) => set({ buyPrice: e.target.value })}
              />
            </Field>
            <Field label="Prix de vente">
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
              <Field label="Quantité en stock">
                <input
                  type="number"
                  min={0}
                  className="input text-right"
                  value={base.qty}
                  onChange={(e) => set({ qty: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
              <Field label="Seuil d'alerte">
                <input
                  type="number"
                  min={0}
                  className="input text-right"
                  value={base.minAlert}
                  onChange={(e) => set({ minAlert: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-surface-2/40 p-3 text-xs text-content-muted">
              Prestation réalisée à la demande : aucun stock à gérer.
            </p>
          )}
        </div>

        {/* Aperçu : la carte telle qu'elle sortira au catalogue */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">
            Aperçu au catalogue
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
          Annuler
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
          <Package className="h-4 w-4" /> {product ? 'Enregistrer' : 'Ajouter au catalogue'}
        </Button>
      </div>
    </Modal>
  );
}
