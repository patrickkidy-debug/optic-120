import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Search,
  Glasses,
  X,
  CircleDot,
  Package,
  Tag,
  User,
  Building2,
  Calendar,
  SlidersHorizontal,
  Sparkles,
  Eye,
  Receipt,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Copy,
  type LucideIcon,
} from 'lucide-react';
import type { LensOrderCategory, LensIndexId, LensOrderConfig, LensTreatmentKey } from '@oculo/shared-types';
import {
  LENS_ORDER_CATEGORIES,
  DEFAULT_LENS_PRICING,
  LENS_MATERIALS,
  LENS_TREATMENTS,
  lensIndicesForMaterial,
  lensBaseOptions,
  lensBaseLabel,
  computeLensOrderPrice,
} from '@oculo/shared-types';
import { createLensOrder, listProducts, type Product, type LensOrder } from '../../features/optique/api';
import { listSuppliers } from '../../features/management/api';
import { CustomerSearch } from '../../features/optique/SaleTools';
import { apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { formatCurrency } from '../../lib/format';
import { Button, Field, Modal } from '../../components/ui';

const LENS_CAT: Record<LensOrderCategory, { label: string; icon: LucideIcon }> = {
  VERRES: { label: 'Verres', icon: Glasses },
  LENTILLES: { label: 'Lentilles de contact', icon: CircleDot },
  ACCESSOIRE: { label: 'Accessoire', icon: Package },
  MONTURE: { label: 'Monture', icon: Glasses },
  AUTRE: { label: 'Autre', icon: Tag },
};

interface EyeRx {
  sphere?: string;
  cylinder?: string;
  axis?: string;
  addition?: string;
  prism?: string;
  prismBase?: string;
}

function toNumber(v?: string): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Résumé texte lisible d'un œil, pour la compatibilité (carte Kanban, historique). */
function formatRx(rx: EyeRx): string {
  let base = rx.sphere ? signed(Number(rx.sphere)) : '';
  if (rx.cylinder) base += ` (${signed(Number(rx.cylinder))}${rx.axis ? ` × ${rx.axis}°` : ''})`;
  if (rx.addition) base += `${base ? ' ' : ''}add ${signed(Number(rx.addition))}`;
  if (rx.prism) base += `${base ? ' ' : ''}prisme ${rx.prism}${rx.prismBase ? ` ${rx.prismBase}` : ''}`;
  return base;
}

function SectionTitle({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-primary" />
      {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
      <h4 className="text-xs font-bold uppercase tracking-wide text-content-muted">{children}</h4>
    </div>
  );
}

/** Recherche compacte d'une monture, pour donner sa photo + prix à la carte Kanban. */
function FramePicker({ value, onChange }: { value: Product | null; onChange: (p: Product | null) => void }) {
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
            <Glasses className="h-4 w-4 text-content-faint" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-content">
            {value.brand ? `${value.brand} · ` : ''}
            {value.name}
          </p>
          <p className="truncate text-[11px] text-content-faint">
            Réf. {value.sku} · {formatCurrency(Number(value.sellPrice))}
          </p>
        </div>
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
                    <Glasses className="h-3.5 w-3.5 text-content-faint" />
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

/** Recherche de laboratoire/fournisseur parmi ceux déjà enregistrés — saisie libre acceptée. */
function SupplierSearch({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const filtered = (suppliers ?? [])
    .filter((s) => s.name.toLowerCase().includes(value.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input
          className="input pl-9"
          placeholder="Rechercher ou saisir un laboratoire…"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && value.trim() && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border bg-surface shadow-card-lg">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.name);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-content hover:bg-surface-2"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Puce cliquable pour un traitement (sélection en un clic, prix affiché). */
function TreatmentChip({
  label,
  price,
  active,
  onClick,
}: {
  label: string;
  price: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
        active ? 'border-primary bg-primary-soft text-content' : 'border-line text-content-muted hover:border-primary/40'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {active && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" />}
        {label}
      </span>
      {price > 0 && <span className="shrink-0 text-xs text-content-faint">+{formatCurrency(price)}</span>}
    </button>
  );
}

/** Bloc de saisie sphère/cylindre/axe/addition (+ prisme si "avancé" ouvert) pour un œil. */
function EyeRxFields({
  label,
  rx,
  onChange,
  disabled,
  showAdvanced,
}: {
  label: string;
  rx: EyeRx;
  onChange: (rx: EyeRx) => void;
  disabled?: boolean;
  showAdvanced: boolean;
}) {
  const set = (patch: Partial<EyeRx>) => onChange({ ...rx, ...patch });
  return (
    <div className={`rounded-xl border p-3 ${disabled ? 'bg-surface-2/50' : 'bg-surface-2/20'}`}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-content-muted">
        <Eye className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          className="input text-sm"
          placeholder="Sphère"
          type="number"
          step="0.25"
          disabled={disabled}
          value={rx.sphere ?? ''}
          onChange={(e) => set({ sphere: e.target.value })}
        />
        <input
          className="input text-sm"
          placeholder="Cylindre"
          type="number"
          step="0.25"
          disabled={disabled}
          value={rx.cylinder ?? ''}
          onChange={(e) => set({ cylinder: e.target.value })}
        />
        <input
          className="input text-sm"
          placeholder="Axe"
          type="number"
          min={0}
          max={180}
          disabled={disabled}
          value={rx.axis ?? ''}
          onChange={(e) => set({ axis: e.target.value })}
        />
        <input
          className="input text-sm"
          placeholder="Addition"
          type="number"
          step="0.25"
          disabled={disabled}
          value={rx.addition ?? ''}
          onChange={(e) => set({ addition: e.target.value })}
        />
      </div>
      {showAdvanced && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className="input text-sm"
            placeholder="Prisme"
            type="number"
            step="0.25"
            disabled={disabled}
            value={rx.prism ?? ''}
            onChange={(e) => set({ prism: e.target.value })}
          />
          <input
            className="input text-sm"
            placeholder="Base (ex : IN, OUT)"
            disabled={disabled}
            value={rx.prismBase ?? ''}
            onChange={(e) => set({ prismBase: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Création d'une commande de verres (ou lentilles/accessoire/monture/autre).
 * « Je choisis → je configure → je vérifie → je crée » : sections progressives,
 * résumé et prix estimé en temps réel, validation claire avant envoi.
 */
export function LensOrderForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (order: LensOrder, action: 'view' | 'close') => void;
}) {
  const [category, setCategory] = useState<LensOrderCategory>('VERRES');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [frame, setFrame] = useState<Product | null>(null);
  // Champs libres (catégories autres que Verres).
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  // Configurateur (Verres).
  const [ltype, setLtype] = useState<string>('progressif');
  const [lmaterial, setLmaterial] = useState<string>('');
  const [lindex, setLindex] = useState<LensIndexId>('1.6');
  const [treats, setTreats] = useState<LensTreatmentKey[]>(['ar']);
  // Prescription OD/OG.
  const [odRx, setOdRx] = useState<EyeRx>({});
  const [ogRx, setOgRx] = useState<EyeRx>({});
  const [sameForBoth, setSameForBoth] = useState(false);
  const [showAdvancedRx, setShowAdvancedRx] = useState(false);
  const [showPriceDetail, setShowPriceDetail] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<LensOrder | null>(null);

  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;

  const isVerres = category === 'VERRES';
  const typeOptions = lensBaseOptions(pricing);
  const typeLabel = lensBaseLabel(pricing, ltype);
  const availableIndices = lensIndicesForMaterial(lmaterial);
  const effectiveOg = sameForBoth ? odRx : ogRx;
  const hasAnyRx = Boolean(odRx.sphere || odRx.cylinder || effectiveOg.sphere || effectiveOg.cylinder);

  const price = computeLensOrderPrice(pricing, { lensType: ltype, index: lindex, treatments: treats });
  const treatLabels = LENS_TREATMENTS.filter((t) => treats.includes(t.key)).map((t) => t.label);
  const configDesc =
    `Verres ${typeLabel.toLowerCase()}${lmaterial ? ` ${lmaterial}` : ''} indice ${lindex}` +
    (treatLabels.length ? ` — ${treatLabels.join(', ')}` : '') +
    ' (paire)';
  const odSummary = formatRx(odRx);
  const ogSummary = formatRx(effectiveOg);

  // Un matériau à indice unique (CR-39, Polycarbonate, Trivex) fixe l'indice
  // automatiquement ; sinon on ne garde l'indice actuel que s'il reste valide.
  function handleMaterialChange(material: string) {
    setLmaterial(material);
    const available = lensIndicesForMaterial(material);
    if (available.length === 1) setLindex(available[0].id);
    else if (!available.some((i) => i.id === lindex)) setLindex(available[0]?.id ?? '1.5');
  }

  const toggleTreatment = (id: LensTreatmentKey) =>
    setTreats((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  function copyOdToOg() {
    setOgRx({ ...odRx });
  }

  // Monture associée : reprend son prix normal (celui enregistré sur la
  // fiche produit) au lieu de laisser resaisir un montant à la main — sauf
  // pour Verres, dont le prix vient toujours du configurateur ci-dessus.
  function handleFrameChange(p: Product | null) {
    setFrame(p);
    if (p && !isVerres) {
      setCost(String(Number(p.sellPrice)));
      if (!description.trim()) setDescription(`${p.brand ? `${p.brand} · ` : ''}${p.name}`);
    }
  }

  function setExpectedShortcut(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpectedAt(d.toISOString().slice(0, 10));
  }

  const finalDescription = isVerres ? configDesc : description.trim();
  const finalCost = isVerres ? price.total : Number(cost) || undefined;

  const lensConfig: LensOrderConfig | undefined = isVerres
    ? {
        lensType: ltype,
        material: lmaterial || undefined,
        index: lindex,
        treatments: treats,
        prescription: hasAnyRx
          ? {
              sameForBoth,
              od: {
                sphere: toNumber(odRx.sphere),
                cylinder: toNumber(odRx.cylinder),
                axis: toNumber(odRx.axis),
                addition: toNumber(odRx.addition),
                prism: toNumber(odRx.prism),
                prismBase: odRx.prismBase || undefined,
              },
              og: {
                sphere: toNumber(effectiveOg.sphere),
                cylinder: toNumber(effectiveOg.cylinder),
                axis: toNumber(effectiveOg.axis),
                addition: toNumber(effectiveOg.addition),
                prism: toNumber(effectiveOg.prism),
                prismBase: effectiveOg.prismBase || undefined,
              },
            }
          : undefined,
        priceBreakdown: price,
      }
    : undefined;

  // Validation : ce qui bloque réellement la création (requis) vs ce qui est
  // juste conseillé (client, labo, prescription) — jamais bloquant, pour ne
  // pas ralentir une commande simple.
  const checks = [
    { label: 'Client', ok: !!customerId, required: false },
    { label: 'Laboratoire', ok: !!supplierName.trim(), required: false },
    ...(isVerres
      ? [
          { label: 'Type de verre', ok: !!ltype, required: true },
          { label: 'Indice', ok: !!lindex, required: true },
          { label: 'Prescription', ok: hasAnyRx, required: false },
        ]
      : [{ label: 'Description', ok: description.trim().length >= 2, required: true }]),
  ];
  const missingRequired = checks.filter((c) => c.required && !c.ok);
  const canSubmit = missingRequired.length === 0 && finalDescription.length >= 2;

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
        odLens: isVerres && odSummary ? odSummary : undefined,
        ogLens: isVerres && ogSummary ? ogSummary : undefined,
        frameProductId: frame?.id,
        lensConfig,
      }),
    onSuccess: (order) => setCreatedOrder(order),
    onError: (e) => setError(apiErrorMessage(e, 'Création impossible')),
  });

  if (createdOrder) {
    const name = createdOrder.customer ? `${createdOrder.customer.firstName} ${createdOrder.customer.lastName}` : customerLabel;
    return (
      <Modal open onClose={() => onCreated(createdOrder, 'close')} title="Nouvelle commande" size="lg">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--success)]/15 text-success">
            <CheckCircle className="h-7 w-7" />
          </span>
          <p className="font-display text-lg font-bold text-content">Commande créée avec succès</p>
          <p className="text-sm text-content-muted">
            {createdOrder.number}
            {name ? ` — ${name}` : ''}
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={() => onCreated(createdOrder, 'close')}>
              Retour aux commandes
            </Button>
            <Button onClick={() => onCreated(createdOrder, 'view')}>Voir la commande</Button>
          </div>
        </div>
      </Modal>
    );
  }

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
                  {active && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-5">
            <div className="space-y-3">
              <SectionTitle icon={SlidersHorizontal}>① Informations générales</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Client (optionnel)">
                  <CustomerSearch
                    value={customerId}
                    onChange={(id, c) => {
                      setCustomerId(id);
                      setCustomerLabel(c ? `${c.firstName} ${c.lastName}` : '');
                    }}
                  />
                </Field>
                <Field label="Laboratoire / fournisseur">
                  <SupplierSearch value={supplierName} onChange={setSupplierName} />
                </Field>
              </div>
              <Field label="Date prévue">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative max-w-[10rem]">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
                    <input
                      className="input pl-9"
                      type="date"
                      value={expectedAt}
                      onChange={(e) => setExpectedAt(e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={() => setExpectedShortcut(0)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                    Aujourd'hui
                  </button>
                  <button type="button" onClick={() => setExpectedShortcut(1)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                    Demain
                  </button>
                  <button type="button" onClick={() => setExpectedShortcut(3)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                    Dans 3 jours
                  </button>
                </div>
              </Field>
              <Field label="Monture associée (optionnel — vignette sur la carte Kanban)">
                <FramePicker value={frame} onChange={handleFrameChange} />
              </Field>
            </div>

            {isVerres ? (
              <div className="space-y-3">
                <SectionTitle icon={Glasses}>② Configuration des verres</SectionTitle>
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
                          className={`relative rounded-xl border p-3 text-sm transition ${
                            active ? 'border-primary bg-primary-soft text-content' : 'border-line text-content-muted'
                          }`}
                        >
                          {t.label}
                          {active && <CheckCircle className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Matériau">
                    <select className="input" value={lmaterial} onChange={(e) => handleMaterialChange(e.target.value)}>
                      <option value="">—</option>
                      {LENS_MATERIALS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Indice (amincissement)">
                    <select
                      className="input"
                      value={lindex}
                      disabled={availableIndices.length <= 1 && !!lmaterial}
                      onChange={(e) => setLindex(e.target.value as LensIndexId)}
                    >
                      {availableIndices.map((i) => (
                        <option key={i.id} value={i.id}>{i.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div>
                  <span className="label flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Traitements</span>
                  <div className="grid grid-cols-2 gap-2">
                    {LENS_TREATMENTS.map((t) => (
                      <TreatmentChip
                        key={t.key}
                        label={t.label}
                        price={pricing[t.key] ?? 0}
                        active={treats.includes(t.key)}
                        onClick={() => toggleTreatment(t.key)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="label mb-0 flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Prescription</span>
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex cursor-pointer items-center gap-1.5 text-content-muted">
                        <input type="checkbox" checked={sameForBoth} onChange={(e) => setSameForBoth(e.target.checked)} />
                        Même prescription pour les deux yeux
                      </label>
                      {!sameForBoth && (
                        <button type="button" onClick={copyOdToOg} className="flex items-center gap-1 font-medium text-primary hover:underline">
                          <Copy className="h-3.5 w-3.5" /> Copier OD → OG
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <EyeRxFields label="OD — Œil droit" rx={odRx} onChange={setOdRx} showAdvanced={showAdvancedRx} />
                    <EyeRxFields
                      label="OG — Œil gauche"
                      rx={effectiveOg}
                      onChange={setOgRx}
                      disabled={sameForBoth}
                      showAdvanced={showAdvancedRx}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedRx((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-content-muted hover:text-content"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedRx ? 'rotate-180' : ''}`} />
                    Paramètres avancés (prisme)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <SectionTitle icon={FileText}>Détail</SectionTitle>
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

            <Field label="Notes / instructions spéciales">
              <input
                className="input"
                placeholder="Ajouter une note ou une instruction spéciale…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          {/* Résumé + prix : colonne latérale sur desktop, sous la config sur mobile. */}
          <div className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-content-faint">Résumé</p>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-content-muted"><User className="h-3.5 w-3.5" /> Client</dt>
                  <dd className="truncate text-right font-medium text-content">{customerLabel || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-content-muted">Type</dt>
                  <dd className="truncate text-right font-medium text-content">{isVerres ? typeLabel : LENS_CAT[category].label}</dd>
                </div>
                {isVerres && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-content-muted">Indice</dt>
                    <dd className="font-medium text-content">{lindex}</dd>
                  </div>
                )}
                {isVerres && treatLabels.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-content-muted">Traitement</dt>
                    <dd className="truncate text-right font-medium text-content">{treatLabels.join(', ')}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-content-muted"><Glasses className="h-3.5 w-3.5" /> Monture</dt>
                  <dd className="truncate text-right font-medium text-content">{frame ? frame.name : '—'}</dd>
                </div>
              </dl>
              <div className="mt-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-content-faint">
                    <Receipt className="h-3.5 w-3.5" /> Prix estimé
                  </p>
                  {isVerres && (
                    <button type="button" onClick={() => setShowPriceDetail((v) => !v)} className="text-[11px] font-medium text-primary hover:underline">
                      Voir le détail
                    </button>
                  )}
                </div>
                <p className="font-display text-2xl font-extrabold text-gradient">
                  {formatCurrency(isVerres ? price.total : Number(cost) || 0)}
                </p>
                {isVerres && showPriceDetail && (
                  <div className="mt-1.5 space-y-1 text-xs text-content-muted">
                    <div className="flex justify-between"><span>Prix verres</span><span>{formatCurrency(price.base)}</span></div>
                    <div className="flex justify-between"><span>Traitements</span><span>+{formatCurrency(price.treatments)}</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* Validation : jamais bloquant sauf le strict nécessaire. */}
            <div className="rounded-2xl border p-4 text-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">Validation</p>
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-content' : 'text-content-faint'}`}>
                    {c.ok ? (
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                    ) : (
                      <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${c.required ? 'text-danger' : 'text-content-faint'}`} />
                    )}
                    {c.label}
                    {!c.required && !c.ok && <span className="text-[10px] text-content-faint">(optionnel)</span>}
                  </li>
                ))}
              </ul>
              {missingRequired.length > 0 && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-danger">
                  <AlertCircle className="h-3.5 w-3.5" /> Il manque {missingRequired.length} information{missingRequired.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!canSubmit}>
            {mut.isPending ? 'Création en cours…' : 'Créer la commande →'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
