import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { getCommissions } from '../lib/partnerApi';
import { formatCurrency, formatDate } from '../lib/format';
import { Badge, PageHeader, PageLoader, EmptyState } from '../components/ui';

const STATUS_LABEL: Record<string, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'En attente', tone: 'warning' },
  APPROVED: { label: 'Validée', tone: 'info' },
  PAYABLE: { label: 'À payer', tone: 'info' },
  PAID: { label: 'Payée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
  REVERSED: { label: 'Reversée', tone: 'danger' },
};

export function CommissionsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['partner-commissions'], queryFn: getCommissions });

  const totals = (data ?? []).reduce(
    (acc, c) => {
      const amount = Number(c.amount);
      if (c.status === 'CANCELLED' || c.status === 'REVERSED') return acc;
      acc.total += amount;
      if (c.status === 'PAID') acc.paid += amount;
      else acc.pending += amount;
      return acc;
    },
    { total: 0, pending: 0, paid: 0 },
  );
  const currency = data?.[0]?.currency ?? 'XOF';

  return (
    <div>
      <PageHeader title="Mes commissions" subtitle="Historique des commissions générées par vos clients" />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="text-xs text-content-faint">Total gagné</p>
          <p className="mt-1 font-display text-sm font-bold text-content">{formatCurrency(totals.total, currency)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-content-faint">En attente</p>
          <p className="mt-1 font-display text-sm font-bold text-warning">{formatCurrency(totals.pending, currency)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-content-faint">Payé</p>
          <p className="mt-1 font-display text-sm font-bold text-success">{formatCurrency(totals.paid, currency)}</p>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aucune commission pour l'instant"
          hint="Une commission est générée dès qu'un client apporté paie son premier abonnement."
        />
      ) : (
        <div className="space-y-2">
          {data.map((c) => (
            <div key={c.id} className="card flex items-center justify-between gap-2 p-4">
              <div>
                <p className="font-medium text-content">{c.planCode}</p>
                <p className="text-xs text-content-faint">
                  {formatDate(c.createdAt)} · payé par le client : {formatCurrency(Number(c.customerAmount), c.currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-content">{formatCurrency(Number(c.amount), c.currency)}</p>
                <Badge tone={STATUS_LABEL[c.status]?.tone ?? 'neutral'}>
                  {STATUS_LABEL[c.status]?.label ?? c.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
