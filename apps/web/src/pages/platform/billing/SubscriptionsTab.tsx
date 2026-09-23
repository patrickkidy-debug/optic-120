import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Repeat, Search } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@oculo/shared-types';
import { Badge, Button, EmptyState, PageLoader } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { listBillingSubscriptions } from '../../../features/billing/invoicing';
import { shortDate } from './shared';

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  ACTIVE: { label: 'Actif', tone: 'success' },
  TRIALING: { label: 'Essai', tone: 'info' },
  PAST_DUE: { label: 'En attente de paiement', tone: 'warning' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

/**
 * Abonnements de la plateforme (§24).
 *
 * « Expiré » n'est pas un statut stocké : un abonnement ACTIVE dont la période
 * est passée est expiré dans les faits, et c'est ce que la ligne doit dire —
 * sinon l'écran affiche « Actif » pour un accès que le garde d'abonnement
 * refuse déjà.
 */
export function BillingSubscriptionsTab({ onOpenTenant }: { onOpenTenant: (tenantId: string) => void }) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['platform-billing-subscriptions'],
    queryFn: listBillingSubscriptions,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter((s) => !s.isDemo);
    if (!q) return list;
    return list.filter(
      (s) =>
        s.tenantName.toLowerCase().includes(q) ||
        s.planName.toLowerCase().includes(q) ||
        (s.whatsapp ?? '').includes(q) ||
        (s.email ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input
          className="input pl-9"
          placeholder="Établissement, offre, WhatsApp, e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Repeat} title="Aucun abonnement" hint="Aucun abonnement ne correspond." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Établissement</th>
                <th className="table-cell font-semibold">Offre</th>
                <th className="table-cell text-right font-semibold">Prix</th>
                <th className="table-cell font-semibold">Début</th>
                <th className="table-cell font-semibold">Renouvellement</th>
                <th className="table-cell font-semibold">Statut</th>
                <th className="table-cell font-semibold">Dernier paiement</th>
                <th className="table-cell text-right font-semibold">Facturation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const expired = new Date(s.currentPeriodEnd).getTime() < Date.now();
                const meta = STATUS_META[s.status] ?? { label: s.status, tone: 'neutral' as const };
                return (
                  <tr key={s.tenantId} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <div className="font-medium text-content">{s.tenantName}</div>
                      <div className="text-xs text-content-faint">{s.whatsapp ?? s.email ?? '—'}</div>
                    </td>
                    <td className="table-cell text-content-muted">{s.planName}</td>
                    <td className="table-cell text-right font-semibold text-content">
                      {formatCurrency(s.priceMonthly)}
                      <span className="text-xs font-normal text-content-faint">/mois</span>
                    </td>
                    <td className="table-cell text-content-muted">{shortDate(s.currentPeriodStart)}</td>
                    <td className="table-cell text-content-muted">
                      {s.nextBillingDate ? (
                        shortDate(s.nextBillingDate)
                      ) : (
                        <span className="text-xs">Pas de renouvellement automatique</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {expired && s.status === 'ACTIVE' ? (
                        <Badge tone="danger">Expiré</Badge>
                      ) : (
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      )}
                    </td>
                    <td className="table-cell text-content-muted">
                      {s.lastPayment ? (
                        <>
                          <div className="text-content">{formatCurrency(s.lastPayment.amount)}</div>
                          <div className="text-xs text-content-faint">
                            {shortDate(s.lastPayment.at)} ·{' '}
                            {PAYMENT_METHOD_LABELS[s.lastPayment.method as PaymentMethod] ??
                              s.lastPayment.method}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs">Aucun paiement enregistré</span>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      <Button
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => onOpenTenant(s.tenantId)}
                      >
                        <Receipt className="h-3.5 w-3.5" /> Facturation
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
