import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, FlaskConical, Hourglass, Plus, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { rx } from '../../features/oculorx/api';
import { Button, PageLoader, StatCard } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { rxDiopter } from '@oculo/shared-types';
import { Delta, Money, Panel, StatusBadge, monthLabel, td, th, useRx } from './ui';

export function RxDashboardView() {
  const qc = useQueryClient();
  const { manage, order } = useRx();
  const { data, isLoading } = useQuery({ queryKey: ['rx', 'dashboard'], queryFn: rx.dashboard });
  const { data: suppliers } = useQuery({ queryKey: ['rx', 'suppliers'], queryFn: rx.suppliers });
  const refresh = () => qc.invalidateQueries({ queryKey: ['rx'] });
  const seed = useMutation({ mutationFn: rx.seedDemo, onSuccess: refresh, onError: (e) => alert(apiErrorMessage(e)) });
  const clear = useMutation({ mutationFn: rx.clearDemo, onSuccess: refresh, onError: (e) => alert(apiErrorMessage(e)) });

  if (isLoading || !data) return <PageLoader />;
  const { current: c, previous: p, canSeeMargins: m } = data;
  const hasDemo = suppliers?.some((s) => s.rxDemo);
  const empty = !suppliers?.some((s) => s._count.rxLenses > 0);
  const max = Math.max(1, ...data.bySupplier.map((s) => (m ? s.purchases ?? 0 : s.orders)));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-content-muted">{monthLabel(data.month)}</p>
        <div className="flex flex-wrap gap-2">
          {manage && hasDemo && (
            <Button variant="ghost" loading={clear.isPending} onClick={() => confirm('Retirer les fournisseurs, verres et commandes de démonstration ?') && clear.mutate()}>
              Retirer la démo
            </Button>
          )}
          {order && (
            <Link to="/oculorx/nouvelle" className="btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm">
              <Plus className="h-4 w-4" /> Nouvelle commande
            </Link>
          )}
        </div>
      </div>

      {manage && empty && !hasDemo && (
        <div className="card flex flex-wrap items-center gap-4 border-primary/40 p-4">
          <FlaskConical className="h-6 w-6 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-sm text-content-muted">
            Aucun catalogue pour l'instant. Importez celui de votre fournisseur dans « Catalogues fournisseurs », ou chargez des données fictives
            (2 verriers, 15 verres, 15 commandes) pour découvrir OculoRX.
          </p>
          <Button variant="outline" loading={seed.isPending} onClick={() => seed.mutate()}>Charger la démo</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard icon={ClipboardList} label="Commandes du mois" value={c.orders} hint={<Delta cur={c.orders} prev={p.orders} />} />
        {m && <StatCard icon={Wallet} tone="accent" label="Achats verres (HT, dû)" value={formatCurrency(c.purchases ?? 0)} hint={<Delta cur={c.purchases ?? 0} prev={p.purchases ?? 0} />} />}
        <StatCard icon={ShoppingBag} tone="pink" label="Ventes verres (patients)" value={formatCurrency(c.sales)} hint={<Delta cur={c.sales} prev={p.sales} />} />
        {m && (
          <StatCard
            icon={TrendingUp}
            tone={(c.margin ?? 0) >= 0 ? 'success' : 'danger'}
            label="Marge brute"
            value={`${formatCurrency(c.margin ?? 0)}`}
            hint={<span className="text-xs text-content-muted">{String(c.marginPct ?? 0).replace('.', ',')} % des ventes · <Delta cur={c.margin ?? 0} prev={p.margin ?? 0} /></span>}
          />
        )}
        <StatCard icon={Hourglass} tone="primary" label="En cours chez les fournisseurs" value={data.open} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel title={m ? 'Achats par fournisseur (mois)' : 'Commandes par fournisseur (mois)'}>
          {!data.bySupplier.length ? (
            <p className="text-sm text-content-muted">Aucune commande ce mois-ci.</p>
          ) : (
            <ul className="space-y-3">
              {data.bySupplier.map((s) => {
                const v = m ? s.purchases ?? 0 : s.orders;
                return (
                  <li key={s.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-content">{s.name}</span>
                      <span className="text-right">
                        {m ? <Money value={v} className="font-semibold" /> : <span className="font-mono">{v}</span>}
                        <span className="ml-2 text-xs text-content-faint">{s.orders} cde(s)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((v / max) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Dernières commandes" actions={<Link to="/oculorx/commandes" className="text-xs font-semibold text-primary">Tout voir</Link>}>
          {!data.recent.length ? (
            <p className="text-sm text-content-muted">Aucune commande.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className={th}>N°</th>
                    <th className={th}>Patient</th>
                    <th className={th}>Verre</th>
                    {m && <th className={`${th} text-right`}>Marge</th>}
                    <th className={th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className={td}>
                        <span className="whitespace-nowrap font-mono text-xs font-bold text-content">{o.number}</span>
                        <span className="block text-[11px] text-content-faint">{formatDate(o.createdAt)}</span>
                      </td>
                      <td className={td}>{o.patientName}</td>
                      <td className={`${td} text-xs text-content-muted`}>
                        {o.lens.designation}
                        <span className="block font-mono text-[11px]">OD {rxDiopter(o.od.sph)} · OG {rxDiopter(o.og.sph)}</span>
                      </td>
                      {m && <td className={`${td} text-right`}><Money value={o.margin} /></td>}
                      <td className={td}><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
