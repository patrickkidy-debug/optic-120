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
import { tr } from '../../../lib/tr';

const CATEGORIES = [
  { value: 'MONTURE', get label() { return tr('ui.InventoryCountModal.montures'); } },
  { value: 'VERRE', get label() { return tr('ui.InventoryCountModal.verres'); } },
  { value: 'LENTILLE', get label() { return tr('ui.InventoryCountModal.lentilles'); } },
  { value: 'ACCESSOIRE', get label() { return tr('ui.InventoryCountModal.accessoires'); } },
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
      ['Article', tr('ui.InventoryCountModal.reference'), tr('ui.InventoryCountModal.theorique'), tr('ui.InventoryCountModal.compte'), tr('ui.InventoryCountModal.ecart'), tr('ui.InventoryCountModal.valeur'), tr('ui.InventoryCountModal.statut')],
      reviewLines.map((l) => [
        l.product.name,
        l.product.sku,
        l.theoreticalQty,
        l.countedQty ?? '',
        l.deltaQty ?? '',
        l.deltaValue ?? '',
        l.regularized ? tr('ui.InventoryCountModal.regularise') : tr('ui.InventoryCountModal.nonRegularise'),
      ]),
    );
  }

  if (currentPhase === 'loading') {
    return (
      <Modal open onClose={onClose} title={tr('ui.InventoryCountModal.inventairePhysique')} size="xl">
        <PageLoader />
      </Modal>
    );
  }

  if (currentPhase === 'start') {
    return (
      <Modal open onClose={onClose} title={tr('ui.InventoryCountModal.inventairePhysique')} size="lg">
        {canCreate ? (
          <div className="space-y-3">
            <p className="text-sm text-content-muted">
              {tr('ui.InventoryCountModal.comptezPhysiquementVosArticlesPuis')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={tr('ui.InventoryCountModal.categorieOptionnel')}>
                <select className="input" value={scopeCategory} onChange={(e) => setScopeCategory(e.target.value)}>
                  <option value="">{tr('ui.InventoryCountModal.toutes')}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={tr('ui.InventoryCountModal.marqueOptionnel')}>
                <select className="input" value={scopeBrand} onChange={(e) => setScopeBrand(e.target.value)}>
                  <option value="">{tr('ui.InventoryCountModal.toutes')}</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={tr('ui.InventoryCountModal.emplacementOptionnel')}>
                <input
                  className="input"
                  placeholder={tr('ui.InventoryCountModal.vitrineAReserve')}
                  value={scopeLocation}
                  onChange={(e) => setScopeLocation(e.target.value)}
                />
              </Field>
            </div>
            <Field label={tr('ui.InventoryCountModal.noteOptionnel')}>
              <input
                className="input"
                placeholder={tr('ui.InventoryCountModal.inventaireTrimestrielControleApresCasse')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={onClose}>
                {tr('ui.InventoryCountModal.annuler')}
              </Button>
              <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>
                <PackageSearch className="h-4 w-4" /> {tr('ui.InventoryCountModal.demarrerLInventaire')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-content-muted">
            {tr('ui.InventoryCountModal.aucunInventaireEnCoursPour')}
          </p>
        )}
      </Modal>
    );
  }

  if (currentPhase === 'count') {
    return (
      <Modal open onClose={onClose} title={tr('ui.InventoryCountModal.inventairePhysique')} size="xl">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            {tr('ui.InventoryCountModal.comptezPhysiquementVosArticlesPuis')}
          </p>
          <InventoryLinesTable countId={countId!} editable onSummary={setSummary} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button variant="ghost" onClick={() => cancelMut.mutate()} loading={cancelMut.isPending}>
              {tr('ui.InventoryCountModal.abandonnerLInventaire')}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                {tr('ui.InventoryCountModal.fermerReprendrePlusTard')}
              </Button>
              {canValidate && (
                <Button loading={validateMut.isPending} onClick={() => validateMut.mutate()}>
                  <ClipboardCheck className="h-4 w-4" /> {tr('ui.InventoryCountModal.terminerLeComptage')}
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
      <Modal open onClose={onClose} title={tr('ui.InventoryCountModal.revueDesEcarts')} size="xl">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            {tr('ui.InventoryCountModal.selectionnezLesEcartsARegulariser')}
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
              {selected.size === 0 ? tr('ui.InventoryCountModal.aucuneLigneSelectionnee') : tr('ui.InventoryCountModal.sizeLigneSSelectionneeS', { size: selected.size })}
            </span>
            <div className="flex gap-2">
              {canRegularize && (
                <Button variant="outline" loading={regularizeMut.isPending} onClick={() => regularizeMut.mutate([])}>
                  {tr('ui.InventoryCountModal.terminerSansRegulariser')}
                </Button>
              )}
              {canRegularize && (
                <Button disabled={selected.size === 0} onClick={() => void goToConfirm()}>
                  {tr('ui.InventoryCountModal.continuer')}
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
      <Modal open onClose={onClose} title={tr('ui.InventoryCountModal.confirmerLaRegularisation')} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            {tr('ui.InventoryCountModal.vousEtesSurLePoint')} {reviewLines.length} {tr('ui.InventoryCountModal.articleSValeurNetteDe')} <strong>{formatCurrency(reviewNet)}</strong>.
          </p>

          <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-3">
            <span className="text-xs text-content-muted">{tr('ui.InventoryCountModal.motifPourTous')}</span>
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
                    placeholder={tr('ui.InventoryCountModal.noteOptionnel')}
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
              {tr('ui.InventoryCountModal.annuler')}
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
              {tr('ui.InventoryCountModal.confirmerLaRegularisation')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // report
  return (
    <Modal open onClose={onClose} title={tr('ui.InventoryCountModal.inventaireTermine')} size="md">
      <div className="space-y-4 text-center">
        <p className="font-display text-lg font-bold text-content">
          {summary?.total ?? report?.total ?? 0} {tr('ui.InventoryCountModal.articleSControleS')}
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="font-display text-xl font-bold text-success">{summary?.conforme ?? '—'}</p>
            <p className="text-content-muted">{tr('ui.InventoryCountModal.conformes')}</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold text-danger">{summary?.manquant ?? '—'}</p>
            <p className="text-content-muted">{tr('ui.InventoryCountModal.manquants')}</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold text-primary">{summary?.surplus ?? '—'}</p>
            <p className="text-content-muted">{tr('ui.InventoryCountModal.surplus')}</p>
          </div>
        </div>
        <p className="text-sm text-content-muted">
          {report?.regularized ?? 0} {tr('ui.InventoryCountModal.ligneSRegulariseeSValeur')}{' '}
          <strong>{formatCurrency(report?.net ?? 0)}</strong>
        </p>
        <div className="flex flex-col justify-center gap-2 border-t pt-4 sm:flex-row">
          <Button variant="outline" onClick={exportCsv} disabled={reviewLines.length === 0}>
            <Download className="h-4 w-4" /> {tr('ui.InventoryCountModal.exporterLeRapport')}
          </Button>
          <Button onClick={onClose}>{tr('ui.InventoryCountModal.fermer')}</Button>
        </div>
      </div>
    </Modal>
  );
}
