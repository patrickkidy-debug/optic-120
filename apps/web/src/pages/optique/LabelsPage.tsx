import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Printer, Barcode as BarcodeIcon, Search, Crosshair, Layers, Minus, Plus, RotateCcw } from 'lucide-react';
import { listAllProducts, getStock, type Product } from '../../features/optique/api';
import {
  LABEL_FORMATS,
  formatOf,
  labelHtml,
  loadSettings,
  printDocument,
  printHtml,
  saveSettings,
  type CodeKind,
  type LabelItem,
  type LabelSettings,
} from '../../features/optique/labels/labelStudio';
import { useUIStore } from '../../store/ui';
import { PageHeader, Button, Field, PageLoader, EmptyState } from '../../components/ui';
import { formatCurrency } from '../../lib/format';

/** Données d'étiquette d'une monture (marque, modèle, couleur, taille, prix, codes). */
function toItem(p: Product): LabelItem {
  const a = (p.attributes ?? {}) as Record<string, string | undefined>;
  return {
    brand: p.brand ?? '',
    model: a.model || p.name,
    color: a.color ?? '',
    size: a.size ?? '',
    price: formatCurrency(Number(p.sellPrice)),
    sku: p.sku,
    ean: a.ean ?? '',
  };
}

const SAMPLE: LabelItem = { brand: 'Ray-Ban', model: 'RB5154 Clubmaster', color: 'Écaille', size: '51-21-145', price: formatCurrency(72000), sku: 'OPT-2024-001', ean: '8053672000000' };

/** Aperçu à l'échelle : le même HTML millimétré que l'impression. */
function Preview({ item, s, zoom }: { item: LabelItem; s: LabelSettings; zoom: number }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let live = true;
    void labelHtml(item, s, { outline: true }).then((h) => live && setHtml(h));
    return () => {
      live = false;
    };
  }, [item, s]);
  const f = formatOf(s);
  return (
    <div style={{ width: `${f.w * zoom}mm`, height: `${f.h * zoom}mm` }} className="relative">
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="absolute left-0 top-0 shadow-[4px_4px_0_rgba(124,58,237,.5)]" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={clsx('rounded-full border px-3 py-1.5 text-sm font-medium transition', on ? 'border-primary bg-primary text-white' : 'border-line text-content-muted hover:border-primary/50')}
    >
      {label}
    </button>
  );
}

function Num({ label, value, onChange, step = 0.5, min = -10, max = 200 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <Field label={label}>
      <input type="number" className="input" step={step} min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </Field>
  );
}

export function LabelsPage() {
  const branchId = useUIStore((st) => st.activeBranchId);
  const [s, setS] = useState<LabelSettings>(loadSettings);
  const [search, setSearch] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => saveSettings(s), [s]);
  const set = (patch: Partial<LabelSettings>) => setS((x) => ({ ...x, ...patch }));

  const { data, isLoading } = useQuery({
    queryKey: ['products-labels-all', 'MONTURE'],
    queryFn: () => listAllProducts({ category: 'MONTURE' }),
  });
  const { data: stock } = useQuery({
    queryKey: ['stock-labels', branchId],
    queryFn: () => getStock(branchId!),
    enabled: Boolean(branchId),
  });
  const stockOf = useMemo(() => new Map((stock ?? []).map((r) => [r.productId, r.quantity])), [stock]);

  const frames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? [])
      .filter((p) => p.isActive !== false)
      .filter((p) => !inStockOnly || !stock || (stockOf.get(p.id) ?? 0) > 0)
      .filter((p) => !q || `${p.brand ?? ''} ${p.name} ${p.sku}`.toLowerCase().includes(q));
  }, [data, search, inStockOnly, stock, stockOf]);

  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  const f = formatOf(s);
  // Zoom d'aperçu : l'étiquette entière tient dans la carte, quel que soit le format.
  const zoom = Math.round(Math.min(4, 120 / f.w) * 10) / 10;
  const firstSelected = frames.find((p) => (qty[p.id] ?? 0) > 0) ?? frames[0];
  const previewItem = firstSelected ? toItem(firstSelected) : SAMPLE;

  const fillFromStock = () => setQty(Object.fromEntries(frames.map((p) => [p.id, Math.max(0, stockOf.get(p.id) ?? 1)])));
  const oneEach = () => setQty(Object.fromEntries(frames.map((p) => [p.id, 1])));
  const bump = (id: string, d: number) => setQty((m) => ({ ...m, [id]: Math.max(0, Math.min(999, (m[id] ?? 0) + d)) }));

  async function print(test = false) {
    setBusy(true);
    try {
      const all = data?.items ?? [];
      const items: LabelItem[] = test
        ? [previewItem]
        : all.flatMap((p) => Array.from({ length: qty[p.id] ?? 0 }, () => toItem(p)));
      if (!items.length) return;
      printHtml(await printDocument(items, s, test));
    } finally {
      setBusy(false);
    }
  }

  const pickFormat = (key: LabelSettings['format']) => {
    const def = LABEL_FORMATS.find((x) => x.key === key)!;
    set({ format: key, code: def.defaultCode });
  };

  return (
    <div>
      <PageHeader
        title="Studio d’étiquettes"
        subtitle="Choisissez un format, le contenu et les quantités : l’aperçu est à la taille réelle de l’impression."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void print(true)} loading={busy}>
              <Crosshair className="h-4 w-4" /> Page de test
            </Button>
            <Button onClick={() => void print(false)} disabled={!total} loading={busy}>
              <Printer className="h-4 w-4" /> Imprimer {total || ''} étiquette{total > 1 ? 's' : ''}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
        {/* Réglages */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 font-display font-bold text-content">1 · Format</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LABEL_FORMATS.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => pickFormat(x.key)}
                  className={clsx('rounded-xl border p-3 text-left transition', s.format === x.key ? 'border-primary bg-primary/10' : 'border-line hover:border-primary/40')}
                >
                  <span className="block font-semibold text-content">{x.name}</span>
                  <span className="block text-xs text-content-muted">{x.hint}</span>
                </button>
              ))}
            </div>
            {s.format === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Num label="Largeur (mm)" value={s.customW} min={10} max={150} onChange={(v) => set({ customW: v })} />
                <Num label="Hauteur (mm)" value={s.customH} min={8} max={100} onChange={(v) => set({ customH: v })} />
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-display font-bold text-content">2 · Contenu</h3>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['brand', 'Marque'],
                  ['model', 'Modèle'],
                  ['color', 'Couleur'],
                  ['size', 'Taille'],
                  ['price', 'Prix'],
                  ['sku', 'Référence'],
                ] as const
              ).map(([k, l]) => (
                <Toggle key={k} on={s.fields[k]} label={l} onChange={(v) => set({ fields: { ...s.fields, [k]: v } })} />
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Code">
                <select className="input" value={s.code} onChange={(e) => set({ code: e.target.value as CodeKind })}>
                  <option value="barcode">Code-barres</option>
                  <option value="qr">QR code</option>
                  <option value="both">Code-barres + QR</option>
                  <option value="none">Aucun</option>
                </select>
              </Field>
              <Field label="Valeur encodée">
                <select className="input" value={s.codeValue} onChange={(e) => set({ codeValue: e.target.value as 'sku' | 'ean' })}>
                  <option value="sku">Référence OculoSaaS (lisible en caisse)</option>
                  <option value="ean">EAN fabricant si renseigné</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-display font-bold text-content">3 · Impression</h3>
            <div className="mb-3 flex gap-2">
              <Toggle on={s.mode === 'roll'} label="Rouleau (imprimante thermique)" onChange={() => set({ mode: 'roll' })} />
              <Toggle on={s.mode === 'sheet'} label="Planche A4" onChange={() => set({ mode: 'sheet' })} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Num label="Décalage → (mm)" value={s.offsetX} onChange={(v) => set({ offsetX: v })} />
              <Num label="Décalage ↓ (mm)" value={s.offsetY} onChange={(v) => set({ offsetY: v })} />
              {s.mode === 'sheet' && (
                <>
                  <Num label="Marge page (mm)" value={s.sheetMargin} min={0} max={30} onChange={(v) => set({ sheetMargin: v })} />
                  <Num label="Espacement (mm)" value={s.gap} min={0} max={20} onChange={(v) => set({ gap: v })} />
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-content-faint">
              Imprimez d’abord une « Page de test » : si le texte est décalé, corrigez avec les décalages puis réessayez. Dans la fenêtre d’impression,
              choisissez le format de papier {s.mode === 'roll' ? `${f.w} × ${f.h} mm` : 'A4'} et une échelle de 100 %.
            </p>
          </div>
        </div>

        {/* Aperçu + sélection */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-content">Aperçu</h3>
              <span className="text-xs text-content-muted">
                {f.w} × {f.h} mm · agrandi ×{zoom}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] p-5">
              <Preview item={previewItem} s={s} zoom={zoom} />
            </div>
            <p className="mt-2 text-xs text-content-faint">
              {f.flag && f.flag < f.w ? 'La partie en pointillés est la queue qui s’enroule autour de la branche. ' : ''}
              Aperçu de : {previewItem.brand} {previewItem.model}
            </p>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-bold text-content">4 · Montures et quantités</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-9 px-3 text-xs" onClick={fillFromStock}>
                  <Layers className="h-3.5 w-3.5" /> 1 par article en stock
                </Button>
                <Button variant="outline" className="h-9 px-3 text-xs" onClick={oneEach}>
                  1 chacune
                </Button>
                <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => setQty({})}>
                  <RotateCcw className="h-3.5 w-3.5" /> Vider
                </Button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
                <input className="input pl-9" placeholder="Rechercher une monture…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-content-muted">
                <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} /> En stock seulement
              </label>
            </div>

            {isLoading ? (
              <PageLoader />
            ) : !frames.length ? (
              <EmptyState icon={BarcodeIcon} title="Aucune monture à étiqueter" />
            ) : (
              <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {frames.map((p) => {
                  const n = qty[p.id] ?? 0;
                  return (
                    <li key={p.id} className={clsx('flex items-center gap-3 px-3 py-2', n > 0 && 'bg-primary/5')}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-content">{p.brand ? `${p.brand} · ` : ''}{p.name}</p>
                        <p className="truncate font-mono text-[11px] text-content-faint">
                          {p.sku} · {formatCurrency(Number(p.sellPrice))}
                          {stock ? ` · stock ${stockOf.get(p.id) ?? 0}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => bump(p.id, -1)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg p-0" aria-label="Moins">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className={clsx('w-8 text-center font-mono text-sm', n ? 'font-bold text-primary' : 'text-content-faint')}>{n}</span>
                        <button type="button" onClick={() => bump(p.id, 1)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg p-0" aria-label="Plus">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-content-muted">
              {total} étiquette{total > 1 ? 's' : ''} sélectionnée{total > 1 ? 's' : ''} · {frames.length} monture(s) affichée(s)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
