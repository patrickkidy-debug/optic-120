import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Download, PackageSearch } from 'lucide-react';
import { INVENTORY_REASON_LABELS, type InventoryAdjustmentReason } from '@oculo/shared-types';
import { getStock } from '../api';
import {
  cancelInventoryCount,
  createInventoryCount,
  getActiveInventoryCount,
  getInventoryCount,
  regularizeInventoryCount,
  validateInventoryCount,
  type InventoryCountLine,
  type InventorySummary,
} from './api';
import { usePermission } from '../../../store/auth';
import { apiErrorMessage } from '../../../lib/api';
import { invalidateProductViews } from '../../../lib/invalidate';
import { formatCurrency } from '../../../lib/format';
import { downloadCsv } from '../../../lib/csv';
import { Modal, Button, Field, PageLoader } from '../../../components/ui';
import { InventoryLinesTable } from './InventoryLinesTable';

const CATEGORIES = [
  { value: 'MONTURE', label: 'Montures' },
  { value: 'VERRE', label: 'Verres' },
  { value: 'LENTILLE', label: 'Lentilles' },
  { value: 'ACCESSOIRE', label: 'Accessoires' },
  { value: 'SERVICE', label: 'Services' },
];

const REASON_OPTIONS = Object.entries(INVENTORY_REASON_LABELS) as [InventoryAdjustmentReason, string][];

type Phase = 'loading' | 'start' | 'count' | 'review-select' | 'review-confirm' | 'report';

export function InventoryCountModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const canCreate = usePermission('optique.inventory.create');
  const canValidate = usePermission('optique.inventory.validate');
  const canRegularize = usePermission('optique.inventory.regularize');

  const [phase, setPhase] = useState<Phase | null>(null);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewLines, setReviewLines] = useState<InventoryCountLine[]>([]);
  const [bulkReason, setBulkReason] = useState<InventoryAdjustmentReason>('PHYSICAL_INVENTORY');
  const [reasons, setReasons] = useState<Record<string, { reason: InventoryAdjustmentReason; note: string }>>({});
  const [report, setReport] = useState<{ regularized: number; net: number; total: number } | null>(null);
  const [error, setError] = useState('');

  // Périmètre de démarrage
  const [scopeCategory, setScopeCategory] = useState('');
  const [scopeBrand, setScopeBrand] = useState('');
  const [scopeLocation, setScopeLocation] = useState('');
  const [note, setNote] = useState('');

  const { data: active, isLoading: loadingActive } = useQuery({
    queryKey: ['inventory-count-active', branchId],
    queryFn: () => getActiveInventoryCount(branchId),
  });
  const { data: stockRows } = useQuery({ queryKey: ['stock', branchId], queryFn: () => getStock(branchId, false) });
  const brands = useMemo(
    () => Array.from(new Set((stockRows ?? []).map((r) => r.brand).filter((b): b is string => Boolean(b)))).sort(),
    [stockRows],
  );

  const countId = active?.id;
  const currentPhase: Phase =
    phase ??
    (loadingActive
      ? 'loading'
      : !countId
        ? 'start'
        : active!.validatedAt
          ? 'review-select'
          : 'count');

  const createMut = useMutation({
    mutationFn: () =>
      createInventoryCount({
        branchId,
        scopeCategory: scopeCategory || undefined,
        scopeBrand: scopeBrand || undefined,
        scopeLocation: scopeLocation.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-count-active', branchId] });
      setPhase('count');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const validateMut = useMutation({
    mutationFn: () => validateInventoryCount(countId!),
    onSuccess: () => {
      setSelected(new Set());
      setPhase('review-select');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelInventoryCount(countId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-count-active', branchId] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const regularizeMut = useMutation({
    mutationFn: (lines: { lineId: string; reason: InventoryAdjustmentReason; note?: string }[]) =>
      regularizeInventoryCount(countId!, lines),
    onSuccess: (r) => {
      invalidateProductViews(qc);
      qc.invalidateQueries({ queryKey: ['inventory-count-active', branchId] });
      setReport({ regularized: r.regularized, net: r.net, total: summary?.total ?? 0 });
      setPhase('report');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  // Prépare l'écran de revue : récupère le détail des lignes sélectionnées
  // (potentiellement réparties sur plusieurs pages de la table de comptage).
  async function goToConfirm() {
    if (selected.size === 0) return;
    const { lines } = await getInventoryCount(countId!, { status: 'ecart', pageSize: 200 });
    const chosen = lines.filter((l) => selected.has(l.id));
    setReviewLines(chosen);
    setReasons(
      Object.fromEntries(chosen.map((l) => [l.id, { reason: bulkReason, note: '' }])),
    );
    setPhase('review-confirm');
  }

  const reviewNet = reviewLines.reduce((s, l) => s + (l.deltaValue != null ? Number(l.deltaValue) : 0), 0);

  function exportCsv() {
    if (!summary) return;
    downloadCsv(
      `inventaire-${countId}.csv`,
      ['Article', 'Référence', 'Théorique', 'Compté', 'Écart', 'Valeur', 'Statut'],
      reviewLines.map((l) => [
        l.product.name,
        l.product.sku,
        l.theoreticalQty,
        l.countedQty ?? '',
        l.deltaQty ?? '',
        l.deltaValue ?? '',
        l.regularized ? 'Régularisé' : 'Non régularisé',
      ]),
    );
  }

  if (currentPhase === 'loading') {
    return (
      <Modal open onClose={onClose} title="Inventaire physique" size="xl">
        <PageLoader />
      </Modal>
    );
  }

  if (currentPhase === 'start') {
    return (
      <Modal open onClose={onClose} title="Inventaire physique" size="lg">
        {canCreate ? (
          <div className="space-y-3">
            <p className="text-sm text-content-muted">
              Comptez physiquement vos articles puis saisissez les quantités constatées. OculoSaaS
              détectera automatiquement les écarts et vous permettra de les régulariser.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Catégorie (optionnel)">
                <select className="input" value={scopeCategory} onChange={(e) => setScopeCategory(e.target.value)}>
                  <option value="">Toutes</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Marque (optionnel)">
                <select className="input" value={scopeBrand} onChange={(e) => setScopeBrand(e.target.value)}>
                  <option value="">Toutes</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Emplacement (optionnel)">
                <input
                  className="input"
                  placeholder="Vitrine A, Réserve…"
                  value={scopeLocation}
                  onChange={(e) => setScopeLocation(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Note (optionnel)">
              <input
                className="input"
                placeholder="Inventaire trimestriel, contrôle après casse…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>
                <PackageSearch className="h-4 w-4" /> Démarrer l'inventaire
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-content-muted">
            Aucun inventaire en cours pour ce magasin. Demandez à un responsable d'en démarrer un.
          </p>
        )}
      </Modal>
    );
  }

  if (currentPhase === 'count') {
    return (
      <Modal open onClose={onClose} title="Inventaire physique" size="xl">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Comptez physiquement vos articles puis saisissez les quantités constatées. OculoSaaS
            détectera automatiquement les écarts et vous permettra de les régulariser.
          </p>
          <InventoryLinesTable countId={countId!} editable onSummary={setSummary} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button variant="ghost" onClick={() => cancelMut.mutate()} loading={cancelMut.isPending}>
              Abandonner l'inventaire
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Fermer (reprendre plus tard)
              </Button>
              {canValidate && (
                <Button loading={validateMut.isPending} onClick={() => validateMut.mutate()}>
                  <ClipboardCheck className="h-4 w-4" /> Terminer le comptage
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (currentPhase === 'review-select') {
    return (
      <Modal open onClose={onClose} title="Revue des écarts" size="xl">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Sélectionnez les écarts à régulariser. Les lignes non sélectionnées restent inchangées.
          </p>
          <InventoryLinesTable
            countId={countId!}
            selectable
            selected={selected}
            onSelectionChange={setSelected}
            initialStatus="ecart"
            onSummary={setSummary}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-sm text-content-muted">
              {selected.size === 0 ? 'Aucune ligne sélectionnée' : `${selected.size} ligne(s) sélectionnée(s)`}
            </span>
            <div className="flex gap-2">
              {canRegularize && (
                <Button variant="outline" loading={regularizeMut.isPending} onClick={() => regularizeMut.mutate([])}>
                  Terminer sans régulariser
                </Button>
              )}
              {canRegularize && (
                <Button disabled={selected.size === 0} onClick={() => void goToConfirm()}>
                  Continuer
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (currentPhase === 'review-confirm') {
    return (
      <Modal open onClose={onClose} title="Confirmer la régularisation" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Vous êtes sur le point de régulariser {reviewLines.length} article(s). Valeur nette de
            l'ajustement : <strong>{formatCurrency(reviewNet)}</strong>.
          </p>

          <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-3">
            <span className="text-xs text-content-muted">Motif pour tous :</span>
            <select
              className="input h-8 flex-1 text-sm"
              value={bulkReason}
              onChange={(e) => {
                const r = e.target.value as InventoryAdjustmentReason;
                setBulkReason(r);
                setReasons((prev) =>
                  Object.fromEntries(reviewLines.map((l) => [l.id, { reason: r, note: prev[l.id]?.note ?? '' }])),
                );
              }}
            >
              {REASON_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {reviewLines.map((l) => (
              <div key={l.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{l.product.name}</p>
                    <p className="font-mono text-[11px] text-content-faint">{l.product.sku}</p>
                  </div>
                  <span className={l.deltaQty! > 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
                    {l.deltaQty! > 0 ? '+' : ''}
                    {l.deltaQty}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    className="input h-8 text-xs"
                    value={reasons[l.id]?.reason ?? bulkReason}
                    onChange={(e) =>
                      setReasons((prev) => ({
                        ...prev,
                        [l.id]: { reason: e.target.value as InventoryAdjustmentReason, note: prev[l.id]?.note ?? '' },
                      }))
                    }
                  >
                    {REASON_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input h-8 text-xs"
                    placeholder="Note (optionnel)"
                    value={reasons[l.id]?.note ?? ''}
                    onChange={(e) =>
                      setReasons((prev) => ({
                        ...prev,
                        [l.id]: { reason: prev[l.id]?.reason ?? bulkReason, note: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" onClick={() => setPhase('review-select')}>
              Annuler
            </Button>
            <Button
              loading={regularizeMut.isPending}
              onClick={() =>
                regularizeMut.mutate(
                  reviewLines.map((l) => ({
                    lineId: l.id,
                    reason: reasons[l.id]?.reason ?? bulkReason,
                    note: reasons[l.id]?.note || undefined,
                  })),
                )
              }
            >
              Confirmer la régularisation
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // report
  return (
    <Modal open onClose={onClose} title="Inventaire terminé" size="md">
      <div className="space-y-4 text-center">
        <p className="font-display text-lg font-bold text-content">
          {summary?.total ?? report?.total ?? 0} article(s) contrôlé(s)
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="font-display text-xl font-bold text-success">{summary?.conforme ?? '—'}</p>
            <p className="text-content-muted">Conformes</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold text-danger">{summary?.manquant ?? '—'}</p>
            <p className="text-content-muted">Manquants</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold text-primary">{summary?.surplus ?? '—'}</p>
            <p className="text-content-muted">Surplus</p>
          </div>
        </div>
        <p className="text-sm text-content-muted">
          {report?.regularized ?? 0} ligne(s) régularisée(s) — valeur nette{' '}
          <strong>{formatCurrency(report?.net ?? 0)}</strong>
        </p>
        <div className="flex flex-col justify-center gap-2 border-t pt-4 sm:flex-row">
          <Button variant="outline" onClick={exportCsv} disabled={reviewLines.length === 0}>
            <Download className="h-4 w-4" /> Exporter le rapport
          </Button>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
