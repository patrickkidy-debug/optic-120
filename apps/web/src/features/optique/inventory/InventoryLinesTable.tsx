import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Minus, Plus, ScanLine, Search } from 'lucide-react';
import clsx from 'clsx';
import { INVENTORY_REASON_LABELS, type InventoryAdjustmentReason } from '@oculo/shared-types';
import {
  getInventoryCount,
  scanInventoryCount,
  updateInventoryCountLine,
  type InventoryCountLine,
  type InventoryLineStatusFilter,
  type InventorySummary,
} from './api';
import { formatCurrency } from '../../../lib/format';
import { Badge } from '../../../components/ui';

/** Un écart >= 5 unités (ou >= 30 % du théorique) est mis en avant, sans bloquer. */
function isBigGap(line: InventoryCountLine): boolean {
  if (line.deltaQty == null || line.deltaQty === 0) return false;
  const abs = Math.abs(line.deltaQty);
  if (abs >= 5) return true;
  return line.theoreticalQty > 0 && abs / line.theoreticalQty >= 0.3;
}

function lineStatusBadge(line: InventoryCountLine) {
  if (line.countedQty == null) return <Badge tone="neutral">À compter</Badge>;
  if (line.deltaQty === 0) return <Badge tone="success">Conforme</Badge>;
  if ((line.deltaQty ?? 0) < 0) return <Badge tone="danger">Manquant</Badge>;
  return <Badge tone="info">Surplus</Badge>;
}

const FILTERS: { key: InventoryLineStatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'to_count', label: 'À compter' },
  { key: 'counted', label: 'Comptés' },
  { key: 'conforme', label: 'Conforme' },
  { key: 'ecart', label: 'Écart' },
  { key: 'manquant', label: 'Manquant' },
  { key: 'surplus', label: 'Surplus' },
];

export interface InventoryLinesTableProps {
  countId: string;
  /** Colonne Compté éditable (saisie + scan). Faux en revue/historique. */
  editable?: boolean;
  /** Cases à cocher pour choisir quoi régulariser (écran de revue). */
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  /** Filtre initial (la revue s'ouvre directement sur les écarts). */
  initialStatus?: InventoryLineStatusFilter;
  onSummary?: (summary: InventorySummary) => void;
}

export function InventoryLinesTable({
  countId,
  editable,
  selectable,
  selected,
  onSelectionChange,
  initialStatus = 'all',
  onSummary,
}: InventoryLinesTableProps) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<InventoryLineStatusFilter>(initialStatus);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [scanCode, setScanCode] = useState('');
  const [scanError, setScanError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const scanRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Recherche debouncée (300ms, même pattern que ProductsPage) : évite une
  // requête par frappe tout en gardant la recherche côté serveur.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-count', countId, status, search, page],
    queryFn: () => getInventoryCount(countId, { status, search: search || undefined, page, pageSize: 50 }),
  });

  useEffect(() => {
    if (data?.summary) onSummary?.(data.summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.summary]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory-count', countId] });

  async function commitCount(line: InventoryCountLine, raw: string) {
    if (raw === '' || raw === String(line.countedQty ?? '')) return;
    const value = Math.max(0, Math.round(Number(raw)));
    if (!Number.isFinite(value)) return;
    await updateInventoryCountLine(countId, line.id, value);
    setLastSavedAt(Date.now());
    invalidate();
  }

  async function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scanCode.trim();
    if (!code) return;
    setScanError('');
    try {
      await scanInventoryCount(countId, code);
      setLastSavedAt(Date.now());
      setScanCode('');
      invalidate();
    } catch {
      setScanError(`Aucun article de cet inventaire ne correspond à « ${code} »`);
    }
    scanRef.current?.focus();
  }

  const summary = data?.summary;
  const lines = data?.lines ?? [];
  const savedRecently = lastSavedAt != null && Date.now() - lastSavedAt < 60_000;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Articles à compter" value={summary.total} />
          <SummaryTile label="Articles comptés" value={summary.counted} />
          <SummaryTile label="Écarts détectés" value={summary.ecart} tone={summary.ecart > 0 ? 'warning' : undefined} />
          <SummaryTile
            label="Valeur des écarts"
            value={formatCurrency(summary.netValue)}
            tone={summary.netValue < 0 ? 'danger' : summary.netValue > 0 ? 'success' : undefined}
          />
        </div>
      )}

      {editable && (
        <form onSubmit={onScan} className="flex items-center gap-2">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <input
              ref={scanRef}
              className="input pl-9"
              placeholder="Scanner un produit (référence)…"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-outline h-10 px-4 text-sm">
            Scanner
          </button>
          {savedRecently && (
            <span className="hidden shrink-0 text-xs text-content-faint sm:inline">
              Dernière sauvegarde : il y a quelques secondes
            </span>
          )}
        </form>
      )}
      {scanError && <p className="text-sm text-danger">{scanError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = summary
            ? ({
                all: summary.total,
                to_count: summary.toCount,
                counted: summary.counted,
                conforme: summary.conforme,
                ecart: summary.ecart,
                manquant: summary.manquant,
                surplus: summary.surplus,
              } as Record<InventoryLineStatusFilter, number>)[f.key]
            : undefined;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setStatus(f.key);
                setPage(1);
              }}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                status === f.key
                  ? 'border-primary bg-primary text-white'
                  : 'border-line text-content-muted hover:border-primary/40 hover:text-content',
              )}
            >
              {f.label}
              {count != null && <span className="ml-1 opacity-75">({count})</span>}
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input h-9 w-56 pl-9"
            placeholder="Rechercher…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
              {selectable && <th className="table-cell w-8" />}
              <th className="table-cell font-semibold">Article</th>
              <th className="table-cell font-semibold">Référence</th>
              <th className="table-cell font-semibold">Emplacement</th>
              <th className="table-cell text-center font-semibold">Théorique</th>
              <th className="table-cell text-center font-semibold">Compté</th>
              <th className="table-cell text-center font-semibold">Écart</th>
              <th className="table-cell text-right font-semibold">Valeur</th>
              <th className="table-cell font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="table-cell py-8 text-center text-content-muted">
                  Chargement…
                </td>
              </tr>
            ) : lines.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell py-8 text-center text-content-muted">
                  Aucun article pour ce filtre.
                </td>
              </tr>
            ) : (
              lines.map((line, i) => {
                const raw = drafts[line.id] ?? (line.countedQty != null ? String(line.countedQty) : '');
                const bigGap = isBigGap(line);
                return (
                  <tr key={line.id} className={clsx('border-b last:border-0', bigGap && 'bg-[color:var(--warning)]/5')}>
                    {selectable && (
                      <td className="table-cell">
                        <input
                          type="checkbox"
                          disabled={line.deltaQty == null || line.deltaQty === 0 || line.regularized}
                          checked={selected?.has(line.id) ?? false}
                          onChange={(e) => {
                            if (!onSelectionChange || !selected) return;
                            const next = new Set(selected);
                            if (e.target.checked) next.add(line.id);
                            else next.delete(line.id);
                            onSelectionChange(next);
                          }}
                        />
                      </td>
                    )}
                    <td className="table-cell">
                      <div className="text-content">{line.product.name}</div>
                      {line.product.brand && (
                        <div className="text-[11px] text-content-faint">{line.product.brand}</div>
                      )}
                    </td>
                    <td className="table-cell font-mono text-[11px] text-content-faint">{line.product.sku}</td>
                    <td className="table-cell text-content-muted">{line.locationSnapshot ?? '—'}</td>
                    <td className="table-cell text-center text-content-muted">{line.theoreticalQty}</td>
                    <td className="table-cell text-center">
                      {editable ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="btn-ghost h-7 w-7 rounded-lg p-0"
                            onClick={() => {
                              const current = Number(raw || line.countedQty || 0);
                              const next = String(Math.max(0, current - 1));
                              setDrafts((d) => ({ ...d, [line.id]: next }));
                              void commitCount(line, next);
                            }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            ref={(el) => {
                              rowRefs.current[line.id] = el;
                            }}
                            type="number"
                            min={0}
                            value={raw}
                            placeholder="—"
                            className="input h-8 w-16 px-1 text-center"
                            onChange={(e) => setDrafts((d) => ({ ...d, [line.id]: e.target.value }))}
                            onBlur={(e) => void commitCount(line, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              void commitCount(line, (e.target as HTMLInputElement).value);
                              const next = lines[i + 1];
                              if (next) rowRefs.current[next.id]?.focus();
                            }}
                          />
                          <button
                            type="button"
                            className="btn-ghost h-7 w-7 rounded-lg p-0"
                            onClick={() => {
                              const current = Number(raw || line.countedQty || 0);
                              const next = String(current + 1);
                              setDrafts((d) => ({ ...d, [line.id]: next }));
                              void commitCount(line, next);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className={line.countedQty == null ? 'text-content-faint' : 'text-content'}>
                          {line.countedQty ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      {line.deltaQty == null || line.deltaQty === 0 ? (
                        <span className="text-content-faint">{line.deltaQty === 0 ? '0' : '—'}</span>
                      ) : (
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 font-semibold',
                            line.deltaQty > 0 ? 'text-success' : 'text-danger',
                          )}
                        >
                          {bigGap && <AlertTriangle className="h-3.5 w-3.5" />}
                          {line.deltaQty > 0 ? '+' : ''}
                          {line.deltaQty}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-right text-content-muted">
                      {line.deltaValue == null ? '—' : formatCurrency(Number(line.deltaValue))}
                    </td>
                    <td className="table-cell">
                      {lineStatusBadge(line)}
                      {line.regularized && (
                        <div className="mt-1 text-[11px] text-content-faint">
                          Régularisé — {line.reason ? INVENTORY_REASON_LABELS[line.reason as InventoryAdjustmentReason] : ''}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.summary.total > (data.pageSize ?? 50) && (
        <div className="flex items-center justify-between text-sm text-content-muted">
          <button
            type="button"
            className="btn-outline h-8 px-3 text-xs disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            className="btn-outline h-8 px-3 text-xs disabled:opacity-40"
            disabled={lines.length < (data.pageSize ?? 50)}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'warning' | 'danger' | 'success';
}) {
  const toneClass =
    tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-content';
  return (
    <div className="rounded-xl border bg-surface-2/40 p-3">
      <div className="text-[11px] text-content-muted">{label}</div>
      <div className={clsx('mt-1 font-display text-lg font-bold', toneClass)}>{value}</div>
    </div>
  );
}
