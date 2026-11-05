import { NavLink, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { BookOpen, ClipboardList, FilePlus2, LayoutDashboard, ReceiptText } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { useRx } from './ui';
import { RxDashboardView } from './RxDashboard';
import { RxNewOrder } from './RxNewOrder';
import { RxOrders } from './RxOrders';
import { RxCatalogs } from './RxCatalogs';
import { RxBilling } from './RxBilling';

/**
 * OculoRX : commande de verres auprès des fournisseurs, du catalogue importé
 * jusqu'au relevé mensuel. Menu propre au module à gauche (en haut sur tablette).
 */
export function OculoRxPage() {
  const { tab = '' } = useParams();
  const { manage, order } = useRx();
  const items = [
    { to: '', label: 'Tableau de bord', icon: LayoutDashboard, show: true },
    { to: 'nouvelle', label: 'Nouvelle commande', icon: FilePlus2, show: order },
    { to: 'commandes', label: 'Suivi des commandes', icon: ClipboardList, show: true },
    { to: 'catalogues', label: 'Catalogues fournisseurs', icon: BookOpen, show: true },
    { to: 'facturation', label: 'Facturation mensuelle', icon: ReceiptText, show: manage },
  ].filter((i) => i.show);

  return (
    <div>
      <PageHeader title="OculoRX" subtitle="Commande de verres auprès de vos fournisseurs : prix d'achat, marge et relevés mensuels." />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[220px_1fr]">
        <nav className="card flex gap-1 overflow-x-auto p-1.5 2xl:flex-col 2xl:self-start 2xl:overflow-visible" aria-label="OculoRX">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={`/oculorx${i.to ? `/${i.to}` : ''}`}
              end
              className={({ isActive }) =>
                clsx(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-primary-soft text-content' : 'text-content-muted hover:bg-surface-2 hover:text-content',
                )
              }
            >
              <i.icon className="h-4 w-4 shrink-0 text-primary" />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {tab === '' && <RxDashboardView />}
          {tab === 'nouvelle' && <RxNewOrder />}
          {tab === 'commandes' && <RxOrders />}
          {tab === 'catalogues' && <RxCatalogs />}
          {tab === 'facturation' && <RxBilling />}
        </div>
      </div>
    </div>
  );
}
