import { useMemo, useState } from 'react';
import {
  Glasses,
  Frame,
  Building2,
  CalendarClock,
  AlertTriangle,
  MoreVertical,
  Ban,
} from 'lucide-react';
import {
  LENS_ORDER_BOARD_STATUSES,
  LENS_ORDER_STATUS_LABELS,
  type LensOrderStatus,
} from '@oculo/shared-types';
import type { LensOrder } from '../../features/optique/api';
import { Avatar } from '../../components/Avatar';
import { formatCurrency, formatDate } from '../../lib/format';

const DAY = 24 * 60 * 60 * 1000;
function daysBetween(a: string | number | Date, b: string | number | Date) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY));
}

/** Couleur de tête de colonne : le regard suit la progression de gauche à droite. */
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

/** Indicateur de retard / délai, cohérent avec l'ancienne liste. */
function DelayBadge({ order }: { order: LensOrder }) {
  if (order.deliveredAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-success">
        Livré en {daysBetween(order.createdAt, order.deliveredAt)} j
      </span>
    );
  }
  const late =
    order.expectedAt && Date.now() > new Date(order.expectedAt).getTime()
      ? daysBetween(order.expectedAt, Date.now())
      : 0;
  if (late > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-danger/10 px-1.5 py-0.5 text-[11px] font-semibold text-danger">
        <AlertTriangle className="h-3 w-3" /> Retard de {late} j
      </span>
    );
  }
  return null;
}

function OrderCard({
  order,
  onOpen,
  onMove,
  onCancel,
  draggable,
}: {
  order: LensOrder;
  onOpen: () => void;
  onMove: (status: LensOrderStatus) => void;
  onCancel: () => void;
  draggable: boolean;
}) {
  const clientName = order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Client de passage';

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', order.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
      className="card group cursor-grab space-y-2 p-3 text-left transition hover:border-primary hover:shadow-card-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            firstName={order.customer?.firstName}
            lastName={order.customer?.lastName}
            className="h-7 w-7 shrink-0 rounded-full text-[11px]"
          />
          <span className="truncate text-sm font-semibold text-content">{clientName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-mono text-[11px] text-content-faint">{order.number}</span>
          {draggable && (
            <details className="relative" onClick={(e) => e.stopPropagation()}>
              <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-lg text-content-faint hover:bg-surface-2 hover:text-content">
                <MoreVertical className="h-3.5 w-3.5" />
              </summary>
              <div className="absolute right-0 top-7 z-20 w-44 rounded-xl border bg-surface p-1 shadow-card-lg">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-content-faint">
                  Déplacer vers
                </p>
                {LENS_ORDER_BOARD_STATUSES.filter((s) => s !== order.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => onMove(s)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-content hover:bg-surface-2"
                  >
                    {LENS_ORDER_STATUS_LABELS[s]}
                  </button>
                ))}
                <div className="my-1 border-t" />
                <button
                  onClick={onCancel}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-danger hover:bg-danger/10"
                >
                  <Ban className="h-3.5 w-3.5" /> Annuler la commande
                </button>
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Monture : vignette photo si choisie */}
      {order.frameProduct && (
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-1.5">
          <div className="grid h-9 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-3">
            {order.frameProduct.photoUrl ? (
              <img src={order.frameProduct.photoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <Frame className="h-4 w-4 text-content-faint" />
            )}
          </div>
          <span className="truncate text-xs font-medium text-content">
            {order.frameProduct.brand ? `${order.frameProduct.brand} · ` : ''}
            {order.frameProduct.name}
          </span>
        </div>
      )}

      {/* Verres OD/OG si renseignés, sinon la description libre */}
      {order.odLens || order.ogLens ? (
        <div className="space-y-0.5 text-xs text-content-muted">
          {order.odLens && (
            <div className="truncate">
              <span className="font-semibold text-content-faint">OD</span> {order.odLens}
            </div>
          )}
          {order.ogLens && (
            <div className="truncate">
              <span className="font-semibold text-content-faint">OG</span> {order.ogLens}
            </div>
          )}
        </div>
      ) : (
        <p className="line-clamp-2 flex items-start gap-1 text-xs text-content-muted">
          <Glasses className="mt-0.5 h-3 w-3 shrink-0" /> {order.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-content-faint">
        {order.supplierName && (
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {order.supplierName}
          </span>
        )}
        {order.expectedAt && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> {formatDate(order.expectedAt)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <DelayBadge order={order} />
        {order.cost != null && (
          <span className="ml-auto font-display text-sm font-bold text-content">
            {formatCurrency(Number(order.cost))}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Plateau Kanban des commandes de verres. Colonnes fixes (workflow labo →
 * livraison) ; glisser-déposer natif entre colonnes, avec un menu « Déplacer
 * vers » en repli clavier/tactile. Les commandes annulées quittent le plateau
 * (accessibles via le compteur en tête de page).
 */
export function LensOrderKanban({
  orders,
  onMove,
  onOpen,
  onCancel,
  canManage,
}: {
  orders: LensOrder[];
  onMove: (id: string, status: LensOrderStatus) => void;
  onOpen: (order: LensOrder) => void;
  onCancel: (order: LensOrder) => void;
  canManage: boolean;
}) {
  const [dragOver, setDragOver] = useState<LensOrderStatus | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<LensOrderStatus, LensOrder[]>();
    LENS_ORDER_BOARD_STATUSES.forEach((s) => map.set(s, []));
    orders.forEach((o) => {
      if (o.status === 'CANCELLED') return;
      map.get(o.status as LensOrderStatus)?.push(o);
    });
    return map;
  }, [orders]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {LENS_ORDER_BOARD_STATUSES.map((status) => {
        const items = byColumn.get(status) ?? [];
        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (!canManage) return;
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              if (!canManage) return;
              const id = e.dataTransfer.getData('text/plain');
              if (id) onMove(id, status);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-surface-2/40 ${COLUMN_TONE[status]} ${
              dragOver === status ? 'ring-2 ring-primary/40' : ''
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-content">
                {LENS_ORDER_STATUS_LABELS[status]}
              </h3>
              <span className="badge bg-surface-3 px-2 py-0.5 text-[11px] text-content-muted">
                {items.length}
              </span>
            </div>
            <div className="min-h-[4rem] flex-1 space-y-2 overflow-y-auto px-2 pb-3">
              {items.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  draggable={canManage}
                  onOpen={() => onOpen(o)}
                  onMove={(s) => onMove(o.id, s)}
                  onCancel={() => onCancel(o)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
