import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Receipt, FileText, XCircle, ArrowRightLeft } from 'lucide-react';
import { listSales, cancelSale, convertQuote, type SaleListItem } from '../../features/optique/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { PageHeader, Badge, PageLoader, EmptyState } from '../../components/ui';

function statusTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'PARTIALLY_PAID' || status === 'CONFIRMED') return 'warning' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'neutral' as const;
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
  PARTIALLY_PAID: 'Partiel',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

export function SalesPage({ kind }: { kind: 'SALE' | 'QUOTE' }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canCancel = usePermission('optique.sales.cancel');
  const canConvert = usePermission('optique.quotes.convert');

  const { data, isLoading } = useQuery({
    queryKey: ['sales', kind],
    queryFn: () => listSales({ type: kind }),
  });

  const cancelMut = useMutation({
    mutationFn: cancelSale,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const convertMut = useMutation({
    mutationFn: convertQuote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      alert('Devis converti en vente.');
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const isQuote = kind === 'QUOTE';

  return (
    <div>
      <PageHeader
        title={isQuote ? 'Devis' : 'Historique des ventes'}
        subtitle={isQuote ? 'Devis en attente de conversion' : 'Toutes les ventes du magasin'}
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={isQuote ? FileText : Receipt}
          title={isQuote ? 'Aucun devis' : 'Aucune vente'}
          hint="Les transactions créées en caisse apparaîtront ici."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">{t('sales.number')}</th>
                <th className="table-cell font-semibold">{t('sales.customer')}</th>
                <th className="table-cell font-semibold">{t('common.status')}</th>
                <th className="table-cell text-right font-semibold">{t('sales.amount')}</th>
                {!isQuote && <th className="table-cell text-right font-semibold">{t('sales.paid')}</th>}
                <th className="table-cell text-right font-semibold">{t('sales.date')}</th>
                <th className="table-cell text-right font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s: SaleListItem) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{s.number}</td>
                  <td className="table-cell text-content-muted">
                    {s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : '—'}
                  </td>
                  <td className="table-cell">
                    <Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  </td>
                  <td className="table-cell text-right font-semibold text-content">
                    {formatCurrency(Number(s.totalAmount))}
                  </td>
                  {!isQuote && (
                    <td className="table-cell text-right text-content-muted">
                      {formatCurrency(Number(s.paidAmount))}
                    </td>
                  )}
                  <td className="table-cell text-right text-content-muted">
                    {formatDateTime(s.createdAt)}
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      {isQuote && canConvert && (
                        <button
                          onClick={() => convertMut.mutate(s.id)}
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs"
                          title="Convertir en vente"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" /> Convertir
                        </button>
                      )}
                      {!isQuote && canCancel && s.status !== 'CANCELLED' && (
                        <button
                          onClick={() => {
                            if (confirm(`Annuler la vente ${s.number} ?`)) cancelMut.mutate(s.id);
                          }}
                          className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                          title="Annuler"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
