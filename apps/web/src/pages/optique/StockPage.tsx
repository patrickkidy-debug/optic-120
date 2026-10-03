import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  History,
  Trash2,
  PackagePlus,
  ArrowLeftRight,
  ClipboardCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  getStock,
  adjustStock,
  getStockMovements,
  deleteProduct,
  listStockTransfers,
  type StockRow,
} from '../../features/optique/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { invalidateProductViews } from '../../lib/invalidate';
import { ReceiveStockModal, TransferStockModal, PendingTransfersModal } from './StockOperations';
import { InventoryCountModal } from '../../features/optique/inventory/InventoryCountModal';
import { InventoryHistoryModal } from '../../features/optique/inventory/InventoryHistoryModal';
import { exportProductsExcel, exportProductsPdf } from '../../features/optique/import/exportProducts';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { tr } from '../../lib/tr';

// Toutes les familles du catalogue (ProductCategory) : une famille absente
// d'ici n'aurait ni carte de synthèse ni filtre, et son stock passerait
// inaperçu — c'était le cas des produits d'entretien et des autres.
const CATEGORIES = [
  { value: 'MONTURE', get label() { return tr('ui.StockPage.montures'); } },
  { value: 'VERRE', get label() { return tr('ui.StockPage.verres'); } },
  { value: 'LENTILLE', get label() { return tr('ui.StockPage.lentilles'); } },
  { value: 'ACCESSOIRE', get label() { return tr('ui.StockPage.accessoires'); } },
  { value: 'ENTRETIEN', get label() { return tr('ui.StockPage.produitsDEntretien'); } },
  { value: 'SERVICE', label: 'Services' },
  { value: 'AUTRE', get label() { return tr('ui.StockPage.autres'); } },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

export function StockPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canAdjust = usePermission('optique.stock.adjust');
  const canDelete = usePermission('optique.products.delete');
  const canTransfer = usePermission('optique.stock.transfer');
  // Une caissière peut rejoindre un inventaire déjà démarré (compter) sans
  // avoir le droit d'en créer un — le bouton reste visible pour l'un ou l'autre.
  const canOpenInventory = usePermission('optique.inventory.create') || usePermission('optique.inventory.count');
  const canViewInventoryHistory = usePermission('optique.inventory.history');
  // Opération de stock ouverte : réception, transfert ou inventaire.
  const [operation, setOperation] = useState<'receive' | 'transfer' | null>(null);
  const [showPendingTransfers, setShowPendingTransfers] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showInventoryHistory, setShowInventoryHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<StockRow | null>(null);
  const [historyRow, setViewingHistory] = useState<StockRow | null>(null);

  const { data: pendingTransfers } = useQuery({
    queryKey: ['stockTransfers', branchId],
    queryFn: () => listStockTransfers({ branchId: branchId!, direction: 'incoming', status: 'PENDING' }),
    enabled: Boolean(branchId),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['stock', branchId, lowOnly],
    queryFn: () => getStock(branchId!, lowOnly),
    enabled: Boolean(branchId),
  });

  // Lignes correspondant à la recherche (avant filtre catégorie) : les cartes
  // reflètent le produit recherché, pas le stock global du système.
  const searched = useMemo(
    () =>
      (data ?? []).filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.sku.toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );

  const categoryStats = useMemo(() => {
    // Dérivé de CATEGORIES : ajouter une famille là-haut suffit désormais.
    const stats: Record<string, { count: number; totalStock: number; lastCreated: string | null }> =
      Object.fromEntries(
        CATEGORIES.map((c) => [c.value, { count: 0, totalStock: 0, lastCreated: null }]),
      );

    searched.forEach((r) => {
      const cat = r.category;
      if (stats[cat]) {
        stats[cat].count++;
        stats[cat].totalStock += r.quantity;
        if (r.createdAt) {
          if (!stats[cat].lastCreated || r.createdAt > stats[cat].lastCreated) {
            stats[cat].lastCreated = r.createdAt;
          }
        }
      }
    });

    return stats;
  }, [searched]);

  const rows = searched.filter((r) => !category || r.category === category);

  // Synthèse de la recherche : nombre de références trouvées + unités en stock
  // (les verres illimités ne comptent pas dans les unités).
  const searchSummary = useMemo(() => {
    if (!search.trim()) return null;
    const qty = rows.reduce((s, r) => s + (r.unlimited ? 0 : r.quantity), 0);
    return { refs: rows.length, qty };
  }, [search, rows]);

  // Retrait d'un article du stock : le produit est désactivé et toutes les vues
  // (stock, caisse, étiquettes, tableau de bord…) sont rafraîchies aussitôt.
  const removeMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: (res) => {
      invalidateProductViews(qc);
      // Un produit déjà vendu ne peut pas être effacé : on explique pourquoi.
      if (!res.deleted) {
        alert(
          tr('ui.StockPage.ceProduitFigureSurSoldlines', { soldLines: res.soldLines }),
        );
      }
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title={t('stock.title')}
        subtitle={t('stock.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                exportProductsExcel(
                  rows.map((r) => ({
                    sku: r.sku,
                    name: r.name,
                    category: catLabel(r.category),
                    brand: r.brand,
                    sellPrice: r.sellPrice,
                    stock: r.unlimited ? null : r.quantity,
                  })),
                  'stock.xlsx',
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            {canAdjust && (
              <Button variant="outline" onClick={() => setOperation('receive')}>
                <PackagePlus className="h-4 w-4" /> {tr('ui.StockPage.reception')}
              </Button>
            )}
            {canTransfer && (
              <Button variant="outline" onClick={() => setOperation('transfer')}>
                <ArrowLeftRight className="h-4 w-4" /> {tr('ui.StockPage.transfert')}
              </Button>
            )}
            {canViewInventoryHistory && (
              <Button variant="outline" onClick={() => setShowInventoryHistory(true)}>
                <History className="h-4 w-4" /> {tr('ui.StockPage.historique')}
              </Button>
            )}
            {canOpenInventory && (
              <Button onClick={() => setShowInventory(true)}>
                <ClipboardCheck className="h-4 w-4" /> {tr('ui.StockPage.inventaire')}
              </Button>
            )}
          </div>
        }
      />

      {/* Alert banner when there are pending stock transfer requests */}
      {pendingTransfers && pendingTransfers.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-warning text-white">
              <ArrowLeftRight className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-content">
                {pendingTransfers.length} {tr('ui.StockPage.transfertSDeStockEn')}
              </p>
              <p className="text-xs text-content-muted">
                {tr('ui.StockPage.unAutreMagasinVousA')}
              </p>
            </div>
          </div>
          <Button variant="accent" className="h-8 px-3 text-xs" onClick={() => setShowPendingTransfers(true)}>
            {tr('ui.StockPage.voirEtConfirmer')}
          </Button>
        </div>
      )}

      {/* Visual Category Dashboard Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-6">
        {CATEGORIES.map((c) => {
          const stats = categoryStats[c.value] || { count: 0, totalStock: 0, lastCreated: null };
          const isActive = category === c.value;
          return (
            <div
              key={c.value}
              onClick={() => setCategory(isActive ? '' : c.value)}
              className={`card cursor-pointer p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-md ${
                isActive ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'hover:border-primary-soft'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{c.label}</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-content">
                  {stats.count} <span className="text-xs font-normal text-content-muted">{tr('ui.StockPage.refS')}</span>
                </span>
                {c.value !== 'VERRE' && c.value !== 'SERVICE' && (
                  <span className="text-xs font-semibold text-content-muted">
                    {stats.totalStock} {tr('ui.StockPage.enStock')}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[10px] text-content-faint">
                {stats.lastCreated ? (
                  <>{tr('ui.StockPage.dernierEnreg')} <span className="font-medium text-content-muted">{formatDate(stats.lastCreated)}</span></>
                ) : (
                  tr('ui.StockPage.aucunProduitEnregistre')
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setLowOnly((v) => !v)}
          className={`btn-outline ${lowOnly ? 'border-danger text-danger' : ''}`}
        >
          <AlertTriangle className="h-4 w-4" /> {tr('ui.StockPage.stockFaible')}
        </button>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory('')}
            className={`badge px-3 py-1.5 ${category === '' ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}
          >
            {tr('ui.StockPage.tous')}
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

      {/* Résultat de la recherche : total de références et d'unités trouvées. */}
      {searchSummary && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-primary" />
          <span className="text-content">
            <b>{searchSummary.refs}</b> {tr('ui.StockPage.referenceSTrouveeS')}
          </span>
          <span className="text-content-faint">·</span>
          <span className="text-content">
            <b>{searchSummary.qty}</b> {tr('ui.StockPage.uniteSEnStockPour')}
          </span>
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState icon={Boxes} title={t('stock.noItem')} hint={t('stock.emptyHint')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">{t('common.product')}</th>
                <th className="table-cell font-semibold">{t('common.category')}</th>
                <th className="table-cell text-right font-semibold">{t('common.price')}</th>
                <th className="table-cell text-center font-semibold">{t('common.quantity')}</th>
                <th className="table-cell text-center font-semibold">{t('common.threshold')}</th>
                <th className="table-cell text-right font-semibold">{tr('ui.StockPage.enregistreLe')}</th>
                <th className="table-cell text-right font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="font-medium text-content">{r.name}</div>
                    <div className="text-xs text-content-faint">{r.sku}</div>
                  </td>
                  <td className="table-cell">
                    <Badge tone="info">{catLabel(r.category)}</Badge>
                  </td>
                  <td className="table-cell text-right text-content-muted">
                    {formatCurrency(r.sellPrice)}
                  </td>
                  <td className="table-cell text-center">
                    {r.unlimited ? (
                      <span className="text-sm font-semibold text-content-muted">{tr('ui.StockPage.illimite')}</span>
                    ) : (
                      <span className="font-display text-lg font-bold text-content">{r.quantity}</span>
                    )}
                  </td>
                  <td className="table-cell text-center text-content-muted">{r.unlimited ? '—' : r.minAlert}</td>
                  <td className="table-cell text-right text-content-muted">
                    {r.createdAt ? formatDateTime(r.createdAt) : '—'}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      {r.low && <Badge tone="danger">{t('stock.lowBadge')}</Badge>}
                      <button
                        type="button"
                        onClick={() => setViewingHistory(r)}
                        className="btn-ghost h-8 rounded-lg px-2 text-xs flex items-center gap-1 text-primary hover:bg-primary-soft/20"
                        title={tr('ui.StockPage.historiqueDesMouvements')}
                      >
                        <History className="h-3.5 w-3.5" /> {tr('ui.StockPage.historique')}
                      </button>
                      {canAdjust && !r.unlimited && (
                        <button onClick={() => setEditing(r)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                          <SlidersHorizontal className="h-3.5 w-3.5" /> {tr('ui.StockPage.ajuster')}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (confirm(tr('ui.StockPage.retirerNameDuStockEt', { name: r.name })))
                              removeMut.mutate(r.productId);
                          }}
                          className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                          title={tr('ui.StockPage.retirerDuStockEtDu')}
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

      {editing && branchId && (
        <AdjustModal
          row={editing}
          branchId={branchId}
          onClose={() => setEditing(null)}
          onSaved={() => invalidateProductViews(qc)}
        />
      )}

      {historyRow && branchId && (
        <StockHistoryModal
          row={historyRow}
          branchId={branchId}
          onClose={() => setViewingHistory(null)}
        />
      )}

      {/* Opérations de stock : réception fournisseur, transfert, inventaire. */}
      {showPendingTransfers && branchId && (
        <PendingTransfersModal branchId={branchId} onClose={() => setShowPendingTransfers(false)} />
      )}
      {operation === 'receive' && branchId && (
        <ReceiveStockModal branchId={branchId} onClose={() => setOperation(null)} />
      )}
      {operation === 'transfer' && branchId && (
        <TransferStockModal branchId={branchId} onClose={() => setOperation(null)} />
      )}
      {showInventory && branchId && (
        <InventoryCountModal branchId={branchId} onClose={() => setShowInventory(false)} />
      )}
      {showInventoryHistory && branchId && (
        <InventoryHistoryModal branchId={branchId} onClose={() => setShowInventoryHistory(false)} />
      )}
    </div>
  );
}

function AdjustModal({
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
  const { t } = useTranslation();
  const [delta, setDelta] = useState(0);
  const [minAlert, setMinAlert] = useState(row.minAlert);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => adjustStock({ productId: row.productId, branchId, delta, minAlert }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={tr('ui.StockPage.ajusterName', { name: row.name })} size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-center">
          <p className="text-xs text-content-muted">{t('stock.currentQty')}</p>
          <p className="font-display text-2xl font-bold text-content">{row.quantity}</p>
          <p className="mt-1 text-xs text-content-faint">
            {tr('ui.StockPage.nouvelleQuantite')} <span className="font-semibold text-content">{row.quantity + delta}</span>
          </p>
        </div>
        <Field label={t('stock.movement')}>
          <div className="flex items-center gap-2">
            <button className="btn-outline h-10 w-10 p-0 text-lg" onClick={() => setDelta((d) => d - 1)}>
              −
            </button>
            <input
              type="number"
              className="input text-center"
              value={delta}
              onChange={(e) => setDelta(parseInt(e.target.value || '0', 10))}
            />
            <button className="btn-outline h-10 w-10 p-0 text-lg" onClick={() => setDelta((d) => d + 1)}>
              +
            </button>
          </div>
        </Field>
        <Field label={t('stock.minAlert')}>
          <input
            type="number"
            className="input"
            value={minAlert}
            onChange={(e) => setMinAlert(parseInt(e.target.value || '0', 10))}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tr('ui.StockPage.annuler')}
          </Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={delta === 0 && minAlert === row.minAlert}>
            {tr('ui.StockPage.enregistrer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function StockHistoryModal({
  row,
  branchId,
  onClose,
}: {
  row: { productId: string; name: string };
  branchId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements', row.productId, branchId],
    queryFn: () => getStockMovements(row.productId, branchId),
    enabled: Boolean(row.productId && branchId),
  });

  const getMovementTypeLabel = (type: string, qty: number) => {
    switch (type) {
      case 'PURCHASE_IN':
        return tr('ui.StockPage.achatEntree');
      case 'SALE_OUT':
        return tr('ui.StockPage.venteSortie');
      case 'RETURN_IN':
        return tr('ui.StockPage.retourClientEntree');
      case 'TRANSFER':
        return qty > 0 ? tr('ui.StockPage.transfertEntree') : tr('ui.StockPage.transfertSortie');
      case 'ADJUSTMENT':
        return qty > 0 ? tr('ui.StockPage.ajustementEntree') : tr('ui.StockPage.ajustementSortie');
      default:
        return type;
    }
  };

  return (
    <Modal open onClose={onClose} title={tr('ui.StockPage.historiqueDesMouvementsName', { name: row.name })} size="md">
      {isLoading ? (
        <PageLoader />
      ) : !movements || movements.length === 0 ? (
        <div className="py-8 text-center text-sm text-content-muted">
          {tr('ui.StockPage.aucunMouvementDeStockEnregistre')}
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-content-faint">
                <th className="py-2 font-semibold">{tr('ui.StockPage.dateHeure')}</th>
                <th className="py-2 font-semibold">{tr('ui.StockPage.type')}</th>
                <th className="py-2 text-right font-semibold">{tr('ui.StockPage.quantite')}</th>
                <th className="py-2 pl-4 font-semibold">{tr('ui.StockPage.motifRef')}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const isEntry = m.quantity > 0;
                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-surface-2/40">
                    <td className="py-2.5 font-medium text-content-muted">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isEntry
                            ? 'bg-[color:var(--success)]/15 text-success'
                            : 'bg-[color:var(--danger)]/15 text-danger'
                        }`}
                      >
                        {getMovementTypeLabel(m.type, m.quantity)}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 text-right font-display font-bold ${
                        isEntry ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {isEntry ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="py-2.5 pl-4 text-xs text-content-muted truncate max-w-[180px]" title={m.reason || '—'}>
                      {m.reason || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
