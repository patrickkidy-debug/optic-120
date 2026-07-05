import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Banknote, Phone } from 'lucide-react';
import { listReceivables, type Receivable } from '../../features/optique/api';
import { PaymentModal } from '../optique/PosPage';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { PageHeader, PageLoader, EmptyState, Button } from '../../components/ui';

export function ReceivablesPage() {
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canPay = usePermission('optique.sales.create');
  const [paySale, setPaySale] = useState<{ id: string; due: number; number: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['receivables', branchId],
    queryFn: () => listReceivables(branchId ?? undefined),
  });

  return (
    <div>
      <PageHeader title="Créances" subtitle="Ventes non soldées — soldes restant dus" />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="Aucune créance"
          hint="Toutes les ventes sont soldées. Les ventes payées partiellement apparaîtront ici."
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm text-content-muted">Total restant dû</p>
              <p className="mt-1 font-display text-3xl font-bold text-danger">
                {formatCurrency(data.totalOutstanding)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-content-muted">Ventes concernées</p>
              <p className="mt-1 font-display text-3xl font-bold text-content">{data.count}</p>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">N°</th>
                  <th className="table-cell font-semibold">Client</th>
                  <th className="table-cell text-right font-semibold">Total</th>
                  <th className="table-cell text-right font-semibold">Payé</th>
                  <th className="table-cell text-right font-semibold">Reste</th>
                  <th className="table-cell text-right font-semibold">Date</th>
                  <th className="table-cell text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r: Receivable) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell font-medium text-content">{r.number}</td>
                    <td className="table-cell text-content-muted">
                      <div>{r.customer ?? 'Client comptant'}</div>
                      {r.customerPhone && (
                        <div className="flex items-center gap-1 text-xs text-content-faint">
                          <Phone className="h-3 w-3" /> {r.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="table-cell text-right text-content">{formatCurrency(r.total)}</td>
                    <td className="table-cell text-right text-content-muted">{formatCurrency(r.paid)}</td>
                    <td className="table-cell text-right font-semibold text-danger">
                      {formatCurrency(r.balance)}
                    </td>
                    <td className="table-cell text-right text-content-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex justify-end">
                        {canPay && (
                          <button
                            onClick={() => setPaySale({ id: r.id, due: r.balance, number: r.number })}
                            className="btn-outline h-8 rounded-lg px-2.5 text-xs text-primary"
                            title="Encaisser le solde"
                          >
                            <Banknote className="h-3.5 w-3.5" /> Encaisser
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {paySale && (
        <PaymentModal
          sale={paySale}
          onPaidLabel="Terminer"
          onClose={() => setPaySale(null)}
          onPaid={() => {
            setPaySale(null);
            qc.invalidateQueries({ queryKey: ['receivables'] });
            qc.invalidateQueries({ queryKey: ['sales'] });
          }}
        />
      )}
    </div>
  );
}
