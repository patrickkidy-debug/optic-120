import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LENS_ORDER_BOARD_STATUSES, LENS_ORDER_STATUS_LABELS, type LensOrderStatus } from '@oculo/shared-types';
import { listLensOrders, type LensOrder } from '../../features/optique/api';
import { Modal } from '../ui';
import { formatDate } from '../../lib/format';

/** Couleur de tête de colonne, cohérente avec le plateau Kanban complet. */
const COLUMN_TONE: Record<LensOrderStatus, string> = {
  TO_ORDER: 'border-t-content-faint',
  ORDERED: 'border-t-primary',
  LAB_CONFIRMED: 'border-t-primary',
  IN_PRODUCTION: 'border-t-warning',
  SHIPPED: 'border-t-warning',
  RECEIVED: 'border-t-accent',
  CONTROL: 'border-t-accent',
  MOUNTING: 'border-t-accent',
  READY: 'border-t-success',
  DELIVERED: 'border-t-success',
  CANCELLED: 'border-t-danger',
};

/**
 * Mini-Kanban en lecture seule pour le tableau de bord : un compteur par
 * colonne du workflow, cliquable pour voir la liste des commandes
 * correspondantes. Réutilise la clé de cache `['lens-orders']` de la page
 * Commandes de verres pour éviter une requête redondante.
 */
export function WorkflowKanbanWidget({ enabled }: { enabled: boolean }) {
  const { data } = useQuery({
    queryKey: ['lens-orders'],
    queryFn: () => listLensOrders(),
    enabled,
  });
  const orders = data ?? [];
  const [openStatus, setOpenStatus] = useState<LensOrderStatus | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<LensOrderStatus, LensOrder[]>();
    LENS_ORDER_BOARD_STATUSES.forEach((s) => map.set(s, []));
    orders.forEach((o) => {
      if (o.status !== 'CANCELLED') map.get(o.status as LensOrderStatus)?.push(o);
    });
    return map;
  }, [orders]);

  if (!enabled || orders.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-content">Commandes de verres — workflow</h3>
        <Link to="/optique/commandes-verres" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          Voir toutes les commandes
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {LENS_ORDER_BOARD_STATUSES.map((status) => {
          const items = byColumn.get(status) ?? [];
          return (
            <button
              key={status}
              type="button"
              onClick={() => items.length > 0 && setOpenStatus(status)}
              className={`flex w-32 shrink-0 flex-col items-start gap-1 rounded-xl border-t-4 bg-surface-2/40 px-3 py-2.5 text-left transition hover:bg-surface-2 ${COLUMN_TONE[status]}`}
            >
              <span className="font-display text-xl font-bold text-content">{items.length}</span>
              <span className="line-clamp-2 text-[11px] font-medium text-content-muted">
                {LENS_ORDER_STATUS_LABELS[status]}
              </span>
            </button>
          );
        })}
      </div>

      {openStatus && (
        <Modal open onClose={() => setOpenStatus(null)} title={LENS_ORDER_STATUS_LABELS[openStatus]} size="md">
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {(byColumn.get(openStatus) ?? []).map((o) => (
              <div key={o.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <p className="truncate font-medium text-content">
                  {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : 'Client de passage'}
                </p>
                <p className="text-xs text-content-faint">
                  {o.number}
                  {o.expectedAt ? ` · prévu ${formatDate(o.expectedAt)}` : ''}
                </p>
              </div>
            ))}
          </div>
          <Link
            to="/optique/commandes-verres"
            onClick={() => setOpenStatus(null)}
            className="btn-outline mt-4 w-full justify-center"
          >
            Voir toutes les commandes
          </Link>
        </Modal>
      )}
    </div>
  );
}
