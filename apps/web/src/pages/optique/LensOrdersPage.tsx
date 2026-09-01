import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Glasses, LayoutGrid, CalendarDays, AlertTriangle } from 'lucide-react';
import type { LensOrderStatus } from '@oculo/shared-types';
import {
  listLensOrders,
  setLensOrderStatus,
  type LensOrder,
} from '../../features/optique/api';
import { apiErrorMessage } from '../../lib/api';
import { usePermission } from '../../store/auth';
import { PageHeader, Button, PageLoader, EmptyState } from '../../components/ui';
import { LensOrderKanban } from './LensOrderKanban';
import { LensOrderCalendar } from './LensOrderCalendar';
import { LensOrderDetail } from './LensOrderDetail';
import { LensOrderForm } from './LensOrderForm';

type View = 'board' | 'calendar';

export function LensOrdersPage() {
  const qc = useQueryClient();
  const canManage = usePermission('optique.sales.create');
  const [view, setView] = useState<View>('board');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LensOrder | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['lens-orders'], queryFn: () => listLensOrders() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['lens-orders'] });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LensOrderStatus }) => setLensOrderStatus(id, status),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const orders = data ?? [];
  const activeOrders = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  const lateCount = activeOrders.filter(
    (o) => o.expectedAt && new Date(o.expectedAt).getTime() < Date.now(),
  ).length;
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;

  // Garde la fiche ouverte synchronisée avec la liste après une mutation.
  const liveSelected = selected ? orders.find((o) => o.id === selected.id) ?? null : null;

  return (
    <div>
      <PageHeader
        title="Commandes de verres"
        subtitle="Suivi Kanban des commandes au laboratoire, de la commande à la livraison"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border p-0.5">
              <button
                onClick={() => setView('board')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  view === 'board' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  view === 'calendar' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendrier
              </button>
            </div>
            {canManage && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Nouvelle commande
              </Button>
            )}
          </div>
        }
      />

      {orders.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="badge bg-surface-2 px-3 py-1.5 text-content-muted">
            {activeOrders.length} commande(s) en cours
          </span>
          {lateCount > 0 && (
            <span className="badge bg-danger/10 px-3 py-1.5 text-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {lateCount} en retard
            </span>
          )}
          {cancelledCount > 0 && (
            <span className="badge bg-surface-2 px-3 py-1.5 text-content-faint">
              {cancelledCount} annulée(s)
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Glasses}
          title="Aucune commande de verres"
          hint="Créez votre première commande pour démarrer le suivi."
          action={canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle commande</Button>}
        />
      ) : view === 'board' ? (
        <LensOrderKanban
          orders={orders}
          canManage={canManage}
          onOpen={setSelected}
          onMove={(id, status) => statusMut.mutate({ id, status })}
          onCancel={(o) => {
            if (confirm(`Annuler la commande ${o.number} ?`)) statusMut.mutate({ id: o.id, status: 'CANCELLED' });
          }}
        />
      ) : (
        <LensOrderCalendar orders={orders} onOpen={setSelected} />
      )}

      {open && (
        <LensOrderForm
          onClose={() => setOpen(false)}
          onCreated={(order, action) => {
            setOpen(false);
            invalidate();
            if (action === 'view') setSelected(order);
          }}
        />
      )}

      {liveSelected && (
        <LensOrderDetail order={liveSelected} canManage={canManage} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
