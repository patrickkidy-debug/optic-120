import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, MessageCircle, Glasses, Receipt } from 'lucide-react';
import {
  LENS_ORDER_BOARD_STATUSES,
  LENS_ORDER_STATUS_LABELS,
  type LensOrderStatus,
  type SaleWaStage,
} from '@oculo/shared-types';
import {
  getLensOrderTimeline,
  notifyLensOrderClient,
  setLensOrderStatus,
  type LensOrder,
} from '../../features/optique/api';
import { Avatar } from '../../components/Avatar';
import { sendWhatsappForStage } from '../../lib/whatsapp';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { Modal, Badge, Button } from '../../components/ui';

/** Étape WhatsApp la plus pertinente selon l'avancement de la commande. */
function stageForStatus(status: LensOrderStatus): SaleWaStage {
  if (status === 'DELIVERED') return 'lens_delivered';
  if (status === 'READY') return 'lens_ready';
  return 'lens_ordered';
}

/**
 * Fiche détaillée d'une commande : informations complètes, timeline horodatée
 * (statut + utilisateur pour chaque étape franchie) et bouton pour prévenir
 * le client par WhatsApp.
 */
export function LensOrderDetail({
  order,
  onClose,
  canManage,
}: {
  order: LensOrder;
  onClose: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const tenantName = useAuthStore((s) => s.user?.tenantName) ?? 'OculoSaaS';
  const [notified, setNotified] = useState(Boolean(order.notifiedAt));

  const { data: events, isLoading } = useQuery({
    queryKey: ['lens-order-timeline', order.id],
    queryFn: () => getLensOrderTimeline(order.id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['lens-orders'] });
    qc.invalidateQueries({ queryKey: ['lens-order-timeline', order.id] });
  };
  const statusMut = useMutation({
    mutationFn: (status: LensOrderStatus) => setLensOrderStatus(order.id, status),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const notifyMut = useMutation({
    mutationFn: () => notifyLensOrderClient(order.id),
    onSuccess: () => {
      setNotified(true);
      invalidate();
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  function notifyClient() {
    const ok = sendWhatsappForStage(stageForStatus(order.status), order.customer?.phone, {
      client: order.customer?.firstName ?? '',
      etablissement: tenantName,
      numero: order.number,
    });
    if (ok) notifyMut.mutate();
  }

  // Pour chaque colonne du workflow, l'événement d'audit qui l'a atteinte
  // (le plus récent passage « to: CETTE_COLONNE »), s'il existe.
  const reachedAt = useMemo(() => {
    const map = new Map<LensOrderStatus, { at: string; userName: string | null }>();
    (events ?? [])
      .filter((e) => e.action === 'LENS_ORDER_STATUS_CHANGED' && e.metadata?.to)
      .forEach((e) => {
        map.set(e.metadata!.to as LensOrderStatus, { at: e.createdAt, userName: e.userName });
      });
    return map;
  }, [events]);
  const notifiedEvent = (events ?? []).find((e) => e.action === 'LENS_ORDER_CLIENT_NOTIFIED');
  const showNotifiedStep = Boolean(notifiedEvent || order.notifiedAt);
  // order.status couvre aussi CANCELLED (hors plateau) : comparé via une liste
  // non typée pour rester correct même sur une commande annulée.
  const currentIdx = (LENS_ORDER_BOARD_STATUSES as readonly string[]).indexOf(order.status);
  const flowSteps = LENS_ORDER_BOARD_STATUSES.filter((s) => s !== 'TO_ORDER');

  return (
    <Modal open onClose={onClose} title={`Commande ${order.number}`} size="lg">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_16rem]">
        {/* Timeline */}
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-content-faint">
            Suivi de la commande
          </h4>
          {isLoading ? (
            <p className="text-sm text-content-muted">Chargement…</p>
          ) : (
            <ol className="space-y-0">
              {/* Création : toujours la première étape. */}
              <TimelineItem
                label="Commande créée"
                done
                at={order.createdAt}
                userName={null}
              />
              {flowSteps.map((s, i) => {
                const info = reachedAt.get(s);
                const done = Boolean(info) || currentIdx > LENS_ORDER_BOARD_STATUSES.indexOf(s);
                const isLastStep = i === flowSteps.length - 1;
                return (
                  <TimelineItem
                    key={s}
                    label={LENS_ORDER_STATUS_LABELS[s]}
                    done={done || order.status === s}
                    current={order.status === s}
                    at={info?.at}
                    userName={info?.userName ?? null}
                    last={isLastStep && !showNotifiedStep}
                  />
                );
              })}
              {showNotifiedStep && (
                <TimelineItem
                  label="Client informé"
                  done
                  at={notifiedEvent?.createdAt ?? order.notifiedAt ?? undefined}
                  userName={notifiedEvent?.userName ?? null}
                  last
                />
              )}
            </ol>
          )}
        </div>

        {/* Panneau latéral : infos + actions */}
        <div className="space-y-4">
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Avatar
                firstName={order.customer?.firstName}
                lastName={order.customer?.lastName}
                className="h-9 w-9 rounded-full text-xs"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-content">
                  {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Client de passage'}
                </p>
                {order.customer?.phone && (
                  <p className="text-xs text-content-faint">{order.customer.phone}</p>
                )}
              </div>
            </div>
            <div className="mt-2">
              <Badge tone={order.status === 'DELIVERED' ? 'success' : 'info'}>
                {LENS_ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </div>
          </div>

          {order.frameProduct && (
            <div className="flex items-center gap-2 rounded-xl border p-3">
              <div className="grid h-12 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                {order.frameProduct.photoUrl ? (
                  <img src={order.frameProduct.photoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Glasses className="h-5 w-5 text-content-faint" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content">
                  {order.frameProduct.brand ? `${order.frameProduct.brand} · ` : ''}
                  {order.frameProduct.name}
                </p>
                <p className="text-xs text-content-faint">Monture associée</p>
              </div>
            </div>
          )}

          {(order.odLens || order.ogLens || order.lensConfig) && (
            <div className="rounded-xl border p-3 text-sm">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-faint">
                <Glasses className="h-3.5 w-3.5" /> Verres
              </p>
              {order.lensConfig && (
                <p className="mb-1 flex flex-wrap gap-1">
                  <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                    {order.lensConfig.lensType}
                  </span>
                  {order.lensConfig.index && (
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-content-muted">
                      Indice {order.lensConfig.index}
                    </span>
                  )}
                </p>
              )}
              {order.odLens && <p className="text-content">OD — {order.odLens}</p>}
              {order.ogLens && <p className="text-content">OG — {order.ogLens}</p>}
              {order.lensConfig?.priceBreakdown && (
                <p className="mt-1.5 flex items-center gap-1 border-t pt-1.5 text-xs text-content-muted">
                  <Receipt className="h-3 w-3" /> Verres {formatCurrency(order.lensConfig.priceBreakdown.base)} + traitements{' '}
                  {formatCurrency(order.lensConfig.priceBreakdown.treatments)}
                </p>
              )}
            </div>
          )}

          <dl className="space-y-1.5 rounded-xl border p-3 text-sm">
            {order.supplierName && (
              <div className="flex justify-between gap-3">
                <dt className="text-content-muted">Laboratoire</dt>
                <dd className="text-right font-medium text-content">{order.supplierName}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-content-muted">Commandé le</dt>
              <dd className="font-medium text-content">{formatDate(order.createdAt)}</dd>
            </div>
            {order.expectedAt && (
              <div className="flex justify-between gap-3">
                <dt className="text-content-muted">Prévu le</dt>
                <dd className="font-medium text-content">{formatDate(order.expectedAt)}</dd>
              </div>
            )}
            {order.cost != null && (
              <div className="flex justify-between gap-3 border-t pt-1.5">
                <dt className="text-content-muted">Montant</dt>
                <dd className="font-display font-bold text-content">{formatCurrency(Number(order.cost))}</dd>
              </div>
            )}
          </dl>

          {order.notes && (
            <div className="rounded-xl bg-surface-2 p-3 text-xs text-content-muted">{order.notes}</div>
          )}

          {canManage && order.customer?.phone && (
            <Button
              className="w-full"
              variant={notified ? 'outline' : 'accent'}
              loading={notifyMut.isPending}
              onClick={notifyClient}
            >
              <MessageCircle className="h-4 w-4" />
              {notified ? 'Prévenir à nouveau' : 'Notifier le client'}
            </Button>
          )}

          {canManage && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
            <div>
              <label className="label" htmlFor="lo-status">Faire avancer</label>
              <select
                id="lo-status"
                className="input"
                value={order.status}
                onChange={(e) => statusMut.mutate(e.target.value as LensOrderStatus)}
              >
                {LENS_ORDER_BOARD_STATUSES.map((s) => (
                  <option key={s} value={s}>{LENS_ORDER_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TimelineItem({
  label,
  done,
  current,
  at,
  userName,
  last,
}: {
  label: string;
  done: boolean;
  current?: boolean;
  at?: string | null;
  userName?: string | null;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && (
        <span
          className={`absolute left-[9px] top-5 h-full w-px ${done ? 'bg-primary/40' : 'bg-line'}`}
        />
      )}
      {done ? (
        <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-primary" />
      ) : (
        <Circle className={`h-[18px] w-[18px] shrink-0 ${current ? 'text-primary' : 'text-content-faint'}`} />
      )}
      <div className="min-w-0 pb-0.5">
        <p className={`text-sm font-medium ${done || current ? 'text-content' : 'text-content-faint'}`}>
          {label}
        </p>
        {at && (
          <p className="text-xs text-content-faint">
            {formatDateTime(at)}
            {userName ? ` · ${userName}` : ''}
          </p>
        )}
      </div>
    </li>
  );
}
