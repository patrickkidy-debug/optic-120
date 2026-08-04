import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, PackagePlus, ArrowLeftRight, ClipboardCheck } from 'lucide-react';
import {
  getStock,
  receiveStock,
  transferStock,
  applyStockCount,
  listBranches,
  type StockRow,
} from '../../features/optique/api';
import { listSuppliers } from '../../features/management/api';
import { useUIStore } from '../../store/ui';
import { apiErrorMessage } from '../../lib/api';
import { invalidateProductViews } from '../../lib/invalidate';
import { formatCurrency } from '../../lib/format';
import { Modal, Button, Field, PageLoader } from '../../components/ui';

interface Line {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitCost?: number;
}

/** Recherche produit + ajout de lignes, partagée par la réception et le transfert. */
function ProductPicker({
  rows,
  onPick,
  emptyHint,
}: {
  rows: StockRow[];
  onPick: (r: StockRow) => void;
  emptyHint: string;
}) {
  const [search, setSearch] = useState('');
  const found = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return rows
      .filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [rows, search]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input
          className="input pl-9"
          placeholder="Rechercher un article (nom ou référence)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search.trim() && (
        <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
          {found.length === 0 ? (
            <p className="p-2 text-sm text-content-muted">{emptyHint}</p>
          ) : (
            found.map((r) => (
              <button
                key={r.productId}
                onClick={() => {
                  onPick(r);
                  setSearch('');
                }}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-content">{r.name}</span>
                  <span className="font-mono text-[11px] text-content-faint">{r.sku}</span>
                </span>
                <span className="ml-2 shrink-0 text-xs text-content-muted">
                  {r.unlimited ? 'illimité' : `stock ${r.quantity}`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Lignes sélectionnées, avec quantité (et coût pour la réception). */
function LineEditor({
  lines,
  withCost,
  onChange,
}: {
  lines: Line[];
  withCost?: boolean;
  onChange: (lines: Line[]) => void;
}) {
  if (lines.length === 0) {
    return <p className="py-6 text-center text-sm text-content-muted">Aucun article ajouté.</p>;
  }
  const set = (id: string, patch: Partial<Line>) =>
    onChange(lines.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  return (
    <div className="max-h-56 space-y-1.5 overflow-y-auto">
      {lines.map((l) => (
        <div key={l.productId} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-content">{l.name}</p>
            <p className="font-mono text-[11px] text-content-faint">{l.sku}</p>
          </div>
          <input
            type="number"
            min={1}
            value={l.quantity}
            onChange={(e) => set(l.productId, { quantity: Math.max(1, Number(e.target.value) || 1) })}
            className="input h-8 w-16 px-2 text-center"
            title="Quantité"
          />
          {withCost && (
            <input
              type="number"
              min={0}
              value={l.unitCost ?? ''}
              placeholder="Coût"
              onChange={(e) =>
                set(l.productId, {
                  unitCost: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                })
              }
              className="input h-8 w-24 px-2 text-right"
              title="Prix d'achat unitaire"
            />
          )}
          <button
            onClick={() => onChange(lines.filter((x) => x.productId !== l.productId))}
            className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Ajoute (ou incrémente) une ligne à partir d'un article du stock. */
function addLine(lines: Line[], r: StockRow): Line[] {
  const found = lines.find((l) => l.productId === r.productId);
  if (found) {
    return lines.map((l) => (l.productId === r.productId ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [...lines, { productId: r.productId, name: r.name, sku: r.sku, quantity: 1 }];
}

/* ------------------------------ Réception ------------------------------ */

/** Réception d'une commande fournisseur : entrée de stock tracée avec le coût. */
export function ReceiveStockModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');

  const { data: rows } = useQuery({
    queryKey: ['stock', branchId],
    queryFn: () => getStock(branchId, false),
  });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const total = lines.reduce((s, l) => s + (l.unitCost ?? 0) * l.quantity, 0);

  const mut = useMutation({
    mutationFn: () =>
      receiveStock({
        branchId,
        supplierId: supplierId || undefined,
        reference: reference.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      }),
    onSuccess: (r) => {
      invalidateProductViews(qc);
      alert(`Réception enregistrée : ${r.received} article(s) entrés en stock.`);
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Réception fournisseur" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fournisseur">
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Non précisé —</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Référence (bon de livraison)">
            <input
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="BL-2026-014"
            />
          </Field>
        </div>

        <ProductPicker
          rows={rows ?? []}
          onPick={(r) => setLines((prev) => addLine(prev, r))}
          emptyHint="Aucun article trouvé."
        />
        <LineEditor lines={lines} withCost onChange={setLines} />

        {total > 0 && (
          <div className="flex justify-between border-t pt-2 text-sm">
            <span className="text-content-muted">Total d'achat</span>
            <span className="font-display font-bold text-content">{formatCurrency(total)}</span>
          </div>
        )}
        <p className="text-xs text-content-faint">
          Le prix d'achat renseigné met à jour la fiche produit (suivi des marges).
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={lines.length === 0} loading={mut.isPending} onClick={() => mut.mutate()}>
            <PackagePlus className="h-4 w-4" /> Enregistrer la réception
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- Transfert ------------------------------- */

/** Transfert d'articles d'un magasin vers un autre. */
export function TransferStockModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [toBranchId, setToBranchId] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');

  const { data: rows } = useQuery({
    queryKey: ['stock', branchId],
    queryFn: () => getStock(branchId, false),
  });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const targets = (branches ?? []).filter((b) => b.id !== branchId);

  const mut = useMutation({
    mutationFn: () =>
      transferStock({
        fromBranchId: branchId,
        toBranchId,
        reason: reason.trim() || undefined,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      }),
    onSuccess: (r) => {
      invalidateProductViews(qc);
      alert(`Transfert effectué : ${r.moved} article(s) déplacés.`);
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Transfert entre magasins" size="lg">
      <div className="space-y-3">
        {targets.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-content-muted">
            Il faut au moins deux magasins pour effectuer un transfert.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Magasin destinataire">
                <select
                  className="input"
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {targets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motif (optionnel)">
                <input
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Réassort, demande client…"
                />
              </Field>
            </div>

            <ProductPicker
              rows={(rows ?? []).filter((r) => !r.unlimited)}
              onPick={(r) => setLines((prev) => addLine(prev, r))}
              emptyHint="Aucun article en stock dans ce magasin."
            />
            <LineEditor lines={lines} onChange={setLines} />

            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button
                disabled={lines.length === 0 || !toBranchId}
                loading={mut.isPending}
                onClick={() => mut.mutate()}
              >
                <ArrowLeftRight className="h-4 w-4" /> Transférer
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------- Inventaire ------------------------------- */

/**
 * Inventaire physique : on saisit les quantités comptées, l'écart avec le stock
 * théorique est affiché, et la régularisation applique tout d'un coup.
 */
export function StockCountModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const { data: rows, isLoading } = useQuery({
    queryKey: ['stock', branchId],
    queryFn: () => getStock(branchId, false),
  });

  // Les verres en stock illimité ne se comptent pas.
  const countable = (rows ?? []).filter((r) => !r.unlimited);
  const visible = countable.filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q);
  });

  // Seules les lignes saisies ET différentes du théorique sont régularisées.
  const changes = countable
    .filter((r) => counted[r.productId] !== undefined && counted[r.productId] !== '')
    .map((r) => ({ row: r, value: Number(counted[r.productId]) }))
    .filter((c) => Number.isFinite(c.value) && c.value !== c.row.quantity);

  const mut = useMutation({
    mutationFn: () =>
      applyStockCount({
        branchId,
        note: note.trim() || undefined,
        items: changes.map((c) => ({ productId: c.row.productId, countedQuantity: c.value })),
      }),
    onSuccess: (r) => {
      invalidateProductViews(qc);
      alert(`Inventaire appliqué : ${r.adjusted} ligne(s) régularisée(s) (écart net ${r.net > 0 ? '+' : ''}${r.net}).`);
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Inventaire physique" size="lg">
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-content-muted">
            Saisissez la quantité réellement comptée. Seules les lignes avec un écart seront
            régularisées ; les autres restent inchangées.
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <input
              className="input pl-9"
              placeholder="Filtrer les articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Article</th>
                  <th className="table-cell text-center font-semibold">Théorique</th>
                  <th className="table-cell text-center font-semibold">Compté</th>
                  <th className="table-cell text-center font-semibold">Écart</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const raw = counted[r.productId];
                  const n = raw === undefined || raw === '' ? null : Number(raw);
                  const diff = n === null ? null : n - r.quantity;
                  return (
                    <tr key={r.productId} className="border-b last:border-0">
                      <td className="table-cell">
                        <div className="text-content">{r.name}</div>
                        <div className="font-mono text-[11px] text-content-faint">{r.sku}</div>
                      </td>
                      <td className="table-cell text-center text-content-muted">{r.quantity}</td>
                      <td className="table-cell text-center">
                        <input
                          type="number"
                          min={0}
                          value={raw ?? ''}
                          onChange={(e) =>
                            setCounted((prev) => ({ ...prev, [r.productId]: e.target.value }))
                          }
                          className="input h-8 w-20 px-2 text-center"
                          placeholder="—"
                        />
                      </td>
                      <td className="table-cell text-center">
                        {diff === null || diff === 0 ? (
                          <span className="text-content-faint">—</span>
                        ) : (
                          <span className={diff > 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
                            {diff > 0 ? '+' : ''}
                            {diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Field label="Note (optionnel)">
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Inventaire trimestriel, contrôle après casse…"
            />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-sm text-content-muted">
              {changes.length === 0
                ? 'Aucun écart saisi'
                : `${changes.length} ligne(s) à régulariser`}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button
                disabled={changes.length === 0}
                loading={mut.isPending}
                onClick={() => mut.mutate()}
              >
                <ClipboardCheck className="h-4 w-4" /> Régulariser
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
