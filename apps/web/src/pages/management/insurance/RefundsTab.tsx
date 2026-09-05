import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wallet, Plus, Trash2 } from 'lucide-react';
import {
  listRefunds,
  listClaims,
  deleteRefund,
  type Insurer,
  type InsuranceClaim,
} from '../../../features/management/api';
import { apiErrorMessage } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/format';
import { Button, Modal, PageLoader, EmptyState } from '../../../components/ui';
import { RefundModal, useInsuranceRefresh } from './ClaimsTab';
import { num } from './shared';

export function RefundsTab({ insurers, canUpdate }: { insurers: Insurer[]; canUpdate: boolean }) {
  const refresh = useInsuranceRefresh();
  const [insurerId, setInsurerId] = useState('');
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<InsuranceClaim | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-refunds', insurerId],
    queryFn: () => listRefunds({ insurerId: insurerId || undefined }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRefund(id),
    onSuccess: refresh,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filtrer par assureur"
          className="input h-9 w-auto"
          value={insurerId}
          onChange={(e) => setInsurerId(e.target.value)}
        >
          <option value="">Tous les assureurs</option>
          {insurers.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {canUpdate && (
          <Button onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" /> Enregistrer un remboursement
          </Button>
        )}
        {data && data.refunds.length > 0 && (
          <span className="text-sm text-content-muted">
            Total reçu : <span className="font-semibold text-success">{formatCurrency(data.total)}</span>
          </span>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.refunds.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aucun remboursement"
          hint="Enregistrez un versement dès qu'un assureur vous paie."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-surface-2/60 text-left text-xs uppercase tracking-wide text-content-muted">
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell font-semibold">Dossier</th>
                <th className="table-cell font-semibold">Assureur</th>
                <th className="table-cell font-semibold">Référence</th>
                <th className="table-cell text-right font-semibold">Attendu</th>
                <th className="table-cell text-right font-semibold">Reçu</th>
                {canUpdate && <th className="table-cell" />}
              </tr>
            </thead>
            <tbody>
              {data.refunds.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="table-cell text-content-muted">{formatDate(r.receivedAt)}</td>
                  <td className="table-cell font-medium text-content">{r.claim?.number ?? '—'}</td>
                  <td className="table-cell text-content-muted">{r.insurer?.name ?? '—'}</td>
                  <td className="table-cell text-content-muted">{r.reference ?? '—'}</td>
                  <td className="table-cell text-right text-content-muted">
                    {formatCurrency(num(r.expectedAmount))}
                  </td>
                  <td className="table-cell text-right font-semibold text-success">
                    {formatCurrency(num(r.receivedAmount))}
                  </td>
                  {canUpdate && (
                    <td className="table-cell text-right">
                      <button
                        type="button"
                        aria-label="Supprimer le remboursement"
                        onClick={() => {
                          if (confirm('Supprimer ce versement ? Le dossier redeviendra dû.')) {
                            remove.mutate(r.id);
                          }
                        }}
                        className="rounded-md p-1.5 text-content-faint transition hover:bg-surface-2 hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picking && (
        <ClaimPicker
          onPick={(c) => {
            setTarget(c);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {target && (
        <RefundModal
          claim={target}
          onDone={() => {
            setTarget(null);
            refresh();
          }}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

/** Un versement se rattache toujours à un dossier : on choisit lequel. */
function ClaimPicker({
  onPick,
  onClose,
}: {
  onPick: (claim: InsuranceClaim) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['insurance-claims', '', ''], queryFn: () => listClaims() });
  const open = (data ?? []).filter((c) => c.remainingAmount > 0);
  const s = q.trim().toLowerCase();
  const filtered = s
    ? open.filter(
        (c) =>
          c.number.toLowerCase().includes(s) ||
          (c.insurer?.name ?? '').toLowerCase().includes(s) ||
          (c.sale?.number ?? '').toLowerCase().includes(s) ||
          `${c.customer?.firstName ?? ''} ${c.customer?.lastName ?? ''}`.toLowerCase().includes(s),
      )
    : open;

  return (
    <Modal open onClose={onClose} title="Choisir le dossier remboursé">
      <input
        className="input mb-3"
        autoFocus
        placeholder="Dossier, vente, client ou assureur…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-content-faint">
          Aucun dossier en attente de règlement.
        </p>
      ) : (
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {filtered.slice(0, 50).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content">
                  {c.number} · {c.insurer?.name}
                </p>
                <p className="truncate text-xs text-content-faint">
                  {c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : 'Sans client'}
                  {c.sale ? ` · ${c.sale.number}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-warning">{formatCurrency(c.remainingAmount)}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
