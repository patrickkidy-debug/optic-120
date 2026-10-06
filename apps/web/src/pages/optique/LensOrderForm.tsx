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
import {
  createLensOrder,
  createPrescription,
  listPrescriptions,
  listProducts,
  type Product,
  type LensOrder,
  type Prescription,
} from '../../features/optique/api';
import { listSuppliers } from '../../features/management/api';
import { CustomerSearch } from '../../features/optique/SaleTools';
import { apiErrorMessage } from '../../lib/api';
import { useAuthStore, usePermission } from '../../store/auth';
import { formatCurrency, formatDate, currencySymbol } from '../../lib/format';
import { Button, Field, Modal } from '../../components/ui';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';

const LENS_CAT: Record<LensOrderCategory, { label: string; icon: LucideIcon }> = {
  VERRES: { get label() { return tr('ui.LensOrderForm.verres'); }, icon: Glasses },
  LENTILLES: { get label() { return tr('ui.LensOrderForm.lentillesDeContact'); }, icon: CircleDot },
  ACCESSOIRE: { get label() { return tr('ui.LensOrderForm.accessoire'); }, icon: Package },
  MONTURE: { get label() { return tr('ui.LensOrderForm.monture'); }, icon: Glasses },
  AUTRE: { get label() { return tr('ui.LensOrderForm.autre'); }, icon: Tag },
};

interface EyeRx {
  sphere?: string;
  cylinder?: string;
  axis?: string;
  addition?: string;
  prism?: string;
  prismBase?: string;
}

/**
 * Lit une valeur d'ordonnance saisie librement, comme l'écrivent les opticiens :
 * « +1,25 », « −0.75 », « 2 D », « 90° ». Les anciens champs numériques du
 * navigateur rejetaient en silence le « + » et la virgule : la valeur semblait
 * saisie mais l'ordonnance partait vide.
 */
function parseRx(v?: string): number | undefined {
  if (v === undefined) return undefined;
  const t = v.trim().replace(/[\u2212\u2013]/g, '-').replace(',', '.').replace(/\s+/g, '').replace(/[dD°]$/, '');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
const toNumber = parseRx;

/** Valeur saisie mais illisible ou hors limites (axe 0–180°, dioptries ±30). */
function rxInvalid(field: keyof EyeRx, v?: string): boolean {
  if (!v || !v.trim() || field === 'prismBase') return false;
  const n = parseRx(v);
  if (n === undefined) return true;
  if (field === 'axis') return !Number.isInteger(n) || n < 0 || n > 180;
  return Math.abs(n) > 30;
}

/** Valeur normalisée pour la fiche client (« +1.25 », « -0.50 », « 90 »). */
function rxText(field: keyof EyeRx, v?: string): string {
  const n = parseRx(v);
  if (n === undefined) return '';
  if (field === 'axis') return String(n);
  return (n > 0 ? '+' : '') + n.toFixed(2);
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Résumé texte lisible d'un œil, pour la compatibilité (carte Kanban, historique). */
function formatRx(rx: EyeRx): string {
  const n = (v?: string) => parseRx(v);
  let base = n(rx.sphere) !== undefined ? signed(n(rx.sphere)!) : '';
  if (n(rx.cylinder) !== undefined) base += ` (${signed(n(rx.cylinder)!)}${n(rx.axis) !== undefined ? ` × ${n(rx.axis)}°` : ''})`;
  if (n(rx.addition) !== undefined) base += `${base ? ' ' : ''}add ${signed(n(rx.addition)!)}`;
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
            {tr('ui.LensOrderForm.ref')} {value.sku} · {formatCurrency(Number(value.sellPrice))}
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
          placeholder={tr('ui.LensOrderForm.rechercherUneMontureAAssocier')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search.trim() && (
        <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
          {(data?.items ?? []).length === 0 ? (
            <p className="p-2 text-xs text-content-muted">{tr('ui.LensOrderForm.aucuneMontureTrouvee')}</p>
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
          placeholder={tr('ui.LensOrderForm.rechercherOuSaisirUnLaboratoire')}
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
  const cell = (field: keyof EyeRx, title: string, placeholder: string) => {
    const bad = rxInvalid(field, rx[field]);
    return (
      <label className="block">
        <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-content-faint">{title}</span>
        <input
          className={`input h-10 text-center text-sm ${bad ? 'border-danger ring-1 ring-[color:var(--danger)]/40' : ''}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          value={rx[field] ?? ''}
          onChange={(e) => set({ [field]: e.target.value })}
        />
      </label>
    );
  };
  const invalid = (['sphere', 'cylinder', 'axis', 'addition', 'prism'] as const).some((f) => rxInvalid(f, rx[f]));
  return (
    <div className={`rounded-xl border p-3 ${disabled ? 'bg-surface-2/50' : 'bg-surface'}`}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-content-muted">
        <Eye className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {cell('sphere', 'Sph', '±0.00')}
        {cell('cylinder', 'Cyl', '±0.00')}
        {cell('axis', 'Axe', '0–180')}
        {cell('addition', 'Add', '+0.00')}
      </div>
      {showAdvanced && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {cell('prism', tr('ui.LensOrderForm.prisme'), '0.00')}
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-content-faint">Base</span>
            <input className="input h-10 text-sm" placeholder={tr('ui.LensOrderForm.baseExInOut')} disabled={disabled} value={rx.prismBase ?? ''} onChange={(e) => set({ prismBase: e.target.value })} />
          </label>
        </div>
      )}
      {invalid && !disabled && <p className="mt-1.5 text-[11px] text-danger">{tr('lensForm.invalidRx')}</p>}
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
  // Ordonnance reprise du dossier client (id) ; sinon saisie à la main.
  const [rxFromClient, setRxFromClient] = useState<string | null>(null);
  const [saveRx, setSaveRx] = useState(true);
  const [rxSaveWarning, setRxSaveWarning] = useState('');
  const canSeeRx = usePermission('optique.prescriptions.view');
  const canCreateRx = usePermission('optique.prescriptions.create');
  const [showPriceDetail, setShowPriceDetail] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<LensOrder | null>(null);

  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;

  const isVerres = category === 'VERRES';
  const typeOptions = lensBaseOptions(pricing);
  const typeLabel = lensBaseLabel(pricing, ltype);
  const availableIndices = lensIndicesForMaterial(lmaterial);
  const effectiveOg = sameForBoth ? odRx : ogRx;
  const hasAnyRx = (['sphere', 'cylinder', 'axis', 'addition'] as const).some(
    (f) => parseRx(odRx[f]) !== undefined || parseRx(effectiveOg[f]) !== undefined,
  );
  const rxHasError = (['sphere', 'cylinder', 'axis', 'addition', 'prism'] as const).some(
    (f) => rxInvalid(f, odRx[f]) || rxInvalid(f, effectiveOg[f]),
  );

  // Dernière ordonnance du client choisi : reprise en un clic.
  const { data: clientRx } = useQuery({
    queryKey: ['prescriptions', customerId],
    queryFn: () => listPrescriptions(customerId!),
    enabled: Boolean(customerId) && canSeeRx,
  });
  const latestRx: Prescription | undefined = clientRx?.[0];
  function applyClientRx(p: Prescription) {
    setSameForBoth(false);
    setOdRx({ sphere: p.odSphere ?? '', cylinder: p.odCylinder ?? '', axis: p.odAxis ?? '', addition: p.odAddition ?? '' });
    setOgRx({ sphere: p.ogSphere ?? '', cylinder: p.ogCylinder ?? '', axis: p.ogAxis ?? '', addition: p.ogAddition ?? '' });
    setRxFromClient(p.id);
  }

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
  // Le laboratoire / fournisseur n'est jamais exigé : on peut le préciser plus tard.
  const checks = [
    { label: 'Client', ok: !!customerId, required: false },
    ...(isVerres
      ? [
          { label: tr('ui.LensOrderForm.typeDeVerre'), ok: !!ltype, required: true },
          { label: tr('ui.LensOrderForm.indice'), ok: !!lindex, required: true },
          { label: tr('ui.LensOrderForm.prescription'), ok: hasAnyRx, required: false },
          ...(rxHasError ? [{ label: tr('lensForm.fixRx'), ok: false, required: true }] : []),
        ]
      : [{ label: 'Description', ok: description.trim().length >= 2, required: true }]),
  ];
  const missingRequired = checks.filter((c) => c.required && !c.ok);
  const canSubmit = missingRequired.length === 0 && finalDescription.length >= 2;

  const willSaveRx = isVerres && saveRx && !!customerId && hasAnyRx && !rxFromClient && canCreateRx;
  const mut = useMutation({
    mutationFn: async () => {
      const order = await createLensOrder({
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
      });
      // Ordonnance saisie à la main : rangée aussi dans le dossier du client.
      if (willSaveRx && customerId) {
        try {
          await createPrescription(customerId, {
            odSphere: rxText('sphere', odRx.sphere),
            odCylinder: rxText('cylinder', odRx.cylinder),
            odAxis: rxText('axis', odRx.axis),
            odAddition: rxText('addition', odRx.addition),
            ogSphere: rxText('sphere', effectiveOg.sphere),
            ogCylinder: rxText('cylinder', effectiveOg.cylinder),
            ogAxis: rxText('axis', effectiveOg.axis),
            ogAddition: rxText('addition', effectiveOg.addition),
            lensType: typeLabel,
            notes: tr('lensForm.rxNote', { number: order.number }),
          });
        } catch (e) {
          setRxSaveWarning(apiErrorMessage(e));
        }
      }
      return order;
    },
    onSuccess: (order) => setCreatedOrder(order),
    onError: (e) => setError(apiErrorMessage(e, tr('ui.LensOrderForm.creationImpossible'))),
  });

  if (createdOrder) {
    const name = createdOrder.customer ? `${createdOrder.customer.firstName} ${createdOrder.customer.lastName}` : customerLabel;
    return (
      <Modal open onClose={() => onCreated(createdOrder, 'close')} title={tr('ui.LensOrderForm.nouvelleCommande')} size="lg">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--success)]/15 text-success">
            <CheckCircle className="h-7 w-7" />
          </span>
          <p className="font-display text-lg font-bold text-content">{tr('ui.LensOrderForm.commandeCreeeAvecSucces')}</p>
          <p className="text-sm text-content-muted">
            {createdOrder.number}
            {name ? ` — ${name}` : ''}
          </p>
          {willSaveRx && !rxSaveWarning && <p className="text-xs text-success">✓ {tr('lensForm.rxSaved')}</p>}
          {rxSaveWarning && <p className="text-xs text-warning">{tr('lensForm.rxNotSaved')} {rxSaveWarning}</p>}
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={() => onCreated(createdOrder, 'close')}>
              {tr('ui.LensOrderForm.retourAuxCommandes')}
            </Button>
            <Button onClick={() => onCreated(createdOrder, 'view')}>{tr('ui.LensOrderForm.voirLaCommande')}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={tr('ui.LensOrderForm.nouvelleCommande')} size="lg">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-content">{tr('ui.LensOrderForm.typeDArticle')}</p>
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
          <div className="space-y-6">
            {/* Étape 1 — client et ordonnance */}
            <div className="space-y-3">
              <SectionTitle icon={User}>{tr('lensForm.step1')}</SectionTitle>
              <Field label={tr('ui.LensOrderForm.clientOptionnel')}>
                <CustomerSearch
                  value={customerId}
                  onChange={(id, c) => {
                    setCustomerId(id);
                    setCustomerLabel(c ? `${c.firstName} ${c.lastName}` : '');
                    setRxFromClient(null);
                  }}
                />
              </Field>

              {isVerres && (
                <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary-soft/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-content">
                      <Eye className="h-4 w-4 text-primary" /> {tr('ui.LensOrderForm.prescription')}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex cursor-pointer items-center gap-1.5 text-content-muted">
                        <input type="checkbox" checked={sameForBoth} onChange={(e) => setSameForBoth(e.target.checked)} />
                        {tr('ui.LensOrderForm.memePrescriptionPourLesDeux')}
                      </label>
                      {!sameForBoth && (
                        <button type="button" onClick={copyOdToOg} className="flex items-center gap-1 font-medium text-primary hover:underline">
                          <Copy className="h-3.5 w-3.5" /> {tr('ui.LensOrderForm.copierOdOg')}
                        </button>
                      )}
                    </div>
                  </div>

                  {latestRx && rxFromClient !== latestRx.id && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
                      <span className="text-content-muted">{tr('lensForm.clientRxAvailable', { date: formatDate(latestRx.date) })}</span>
                      <Button type="button" className="h-8 px-3 text-xs" onClick={() => applyClientRx(latestRx)}>
                        <FileText className="h-3.5 w-3.5" /> {tr('lensForm.useClientRx')}
                      </Button>
                    </div>
                  )}
                  {rxFromClient && <p className="text-xs font-medium text-success">✓ {tr('lensForm.clientRxApplied')}</p>}

                  <div className="grid grid-cols-1 gap-2">
                    <EyeRxFields label={tr('ui.LensOrderForm.odIlDroit')} rx={odRx} onChange={(v) => { setOdRx(v); setRxFromClient(null); }} showAdvanced={showAdvancedRx} />
                    <EyeRxFields
                      label={tr('ui.LensOrderForm.ogIlGauche')}
                      rx={effectiveOg}
                      onChange={(v) => { setOgRx(v); setRxFromClient(null); }}
                      disabled={sameForBoth}
                      showAdvanced={showAdvancedRx}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedRx((v) => !v)}
                      className="flex items-center gap-1 text-xs font-medium text-content-muted hover:text-content"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedRx ? 'rotate-180' : ''}`} />
                      {tr('ui.LensOrderForm.parametresAvancesPrisme')}
                    </button>
                    {customerId && canCreateRx && !rxFromClient && hasAnyRx && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-content-muted">
                        <input type="checkbox" checked={saveRx} onChange={(e) => setSaveRx(e.target.checked)} />
                        {tr('lensForm.saveRx')}
                      </label>
                    )}
                  </div>
                  {(odSummary || ogSummary) && (
                    <p className="text-xs text-content-muted">
                      OD : <b className="text-content">{odSummary || '—'}</b> · OG : <b className="text-content">{ogSummary || '—'}</b>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Étape 2 — verres (ou détail de l'article) */}
            {isVerres ? (
              <div className="space-y-3">
                <SectionTitle icon={Glasses}>{tr('lensForm.step2')}</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  {typeOptions.map((t) => {
                    const active = ltype === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setLtype(t.key)}
                        className={`relative rounded-xl border p-3 text-sm transition ${active ? 'border-primary bg-primary-soft font-semibold text-content' : 'border-line text-content-muted hover:border-primary/40'}`}
                      >
                        {t.label}
                        {active && <CheckCircle className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={tr('ui.LensOrderForm.materiau')}>
                    <select className="input" value={lmaterial} onChange={(e) => handleMaterialChange(e.target.value)}>
                      <option value="">—</option>
                      {LENS_MATERIALS.map((m) => (
                        <option key={m} value={m}>{trFr(m)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tr('ui.LensOrderForm.indiceAmincissement')}>
                    <select className="input" value={lindex} disabled={availableIndices.length <= 1 && !!lmaterial} onChange={(e) => setLindex(e.target.value as LensIndexId)}>
                      {availableIndices.map((i) => (
                        <option key={i.id} value={i.id}>{i.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div>
                  <span className="label flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {tr('ui.LensOrderForm.traitements')}</span>
                  <div className="grid grid-cols-2 gap-2">
                    {LENS_TREATMENTS.map((t) => (
                      <TreatmentChip key={t.key} label={t.label} price={pricing[t.key] ?? 0} active={treats.includes(t.key)} onClick={() => toggleTreatment(t.key)} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <SectionTitle icon={FileText}>{tr('ui.LensOrderForm.detail')}</SectionTitle>
                <Field label="Description">
                  <input className="input" placeholder={tr('ui.LensOrderForm.exLentillesMensuellesEtuiCordon')} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <Field label={tr('ui.LensOrderForm.coutFcfa', { currency: currencySymbol() })}>
                  <input className="input" type="number" min={0} placeholder={tr('ui.LensOrderForm.prix')} value={cost} onChange={(e) => setCost(e.target.value)} />
                </Field>
              </div>
            )}

            {/* Étape 3 — laboratoire, délai, monture : tout est facultatif */}
            <div className="space-y-3">
              <SectionTitle icon={Building2}>{tr('lensForm.step3')}</SectionTitle>
              <p className="-mt-1 text-xs text-content-faint">{tr('lensForm.step3Hint')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={tr('lensForm.supplierOptional')}>
                  <SupplierSearch value={supplierName} onChange={setSupplierName} />
                </Field>
                <Field label={tr('ui.LensOrderForm.datePrevue')}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative min-w-[9rem] flex-1">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
                      <input className="input pl-9" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
                    </div>
                    <button type="button" onClick={() => setExpectedShortcut(1)} className="btn-outline h-9 rounded-lg px-2.5 text-xs">
                      {tr('ui.LensOrderForm.demain')}
                    </button>
                    <button type="button" onClick={() => setExpectedShortcut(3)} className="btn-outline h-9 rounded-lg px-2.5 text-xs">
                      {tr('ui.LensOrderForm.dans3Jours')}
                    </button>
                  </div>
                </Field>
              </div>
              <Field label={tr('ui.LensOrderForm.montureAssocieeOptionnelVignetteSur')}>
                <FramePicker value={frame} onChange={handleFrameChange} />
              </Field>
              <Field label={tr('ui.LensOrderForm.notesInstructionsSpeciales')}>
                <input className="input" placeholder={tr('ui.LensOrderForm.ajouterUneNoteOuUne')} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Résumé + prix : colonne latérale sur desktop, sous la config sur mobile. */}
          <div className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('ui.LensOrderForm.resume')}</p>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-content-muted"><User className="h-3.5 w-3.5" /> Client</dt>
                  <dd className="truncate text-right font-medium text-content">{customerLabel || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-content-muted">{tr('ui.LensOrderForm.type')}</dt>
                  <dd className="truncate text-right font-medium text-content">{isVerres ? typeLabel : LENS_CAT[category].label}</dd>
                </div>
                {isVerres && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-content-muted">{tr('ui.LensOrderForm.indice')}</dt>
                    <dd className="font-medium text-content">{lindex}</dd>
                  </div>
                )}
                {isVerres && treatLabels.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-content-muted">{tr('ui.LensOrderForm.traitement')}</dt>
                    <dd className="truncate text-right font-medium text-content">{treatLabels.join(', ')}</dd>
                  </div>
                )}
                {isVerres && (odSummary || ogSummary) && (
                  <div className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs">
                    <p className="text-content"><b>OD</b> {odSummary || '—'}</p>
                    <p className="text-content"><b>OG</b> {ogSummary || '—'}</p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-content-muted"><Building2 className="h-3.5 w-3.5" /> {tr('ui.LensOrderForm.laboratoire')}</dt>
                  <dd className="truncate text-right font-medium text-content">{supplierName.trim() || tr('lensForm.later')}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-content-muted"><Glasses className="h-3.5 w-3.5" /> {tr('ui.LensOrderForm.monture')}</dt>
                  <dd className="truncate text-right font-medium text-content">{frame ? frame.name : '—'}</dd>
                </div>
              </dl>
              <div className="mt-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-content-faint">
                    <Receipt className="h-3.5 w-3.5" /> {tr('ui.LensOrderForm.prixEstime')}
                  </p>
                  {isVerres && (
                    <button type="button" onClick={() => setShowPriceDetail((v) => !v)} className="text-[11px] font-medium text-primary hover:underline">
                      {tr('ui.LensOrderForm.voirLeDetail')}
                    </button>
                  )}
                </div>
                <p className="font-display text-2xl font-extrabold text-gradient">
                  {formatCurrency(isVerres ? price.total : Number(cost) || 0)}
                </p>
                {isVerres && showPriceDetail && (
                  <div className="mt-1.5 space-y-1 text-xs text-content-muted">
                    <div className="flex justify-between"><span>{tr('ui.LensOrderForm.prixVerres')}</span><span>{formatCurrency(price.base)}</span></div>
                    <div className="flex justify-between"><span>{tr('ui.LensOrderForm.traitements')}</span><span>+{formatCurrency(price.treatments)}</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* Validation : jamais bloquant sauf le strict nécessaire. */}
            <div className="rounded-2xl border p-4 text-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('ui.LensOrderForm.validation')}</p>
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
                  <AlertCircle className="h-3.5 w-3.5" /> {tr('ui.LensOrderForm.ilManque')} {missingRequired.length} information{missingRequired.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.LensOrderForm.annuler')}</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!canSubmit}>
            {mut.isPending ? tr('ui.LensOrderForm.creationEnCours') : tr('ui.LensOrderForm.creerLaCommande')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
