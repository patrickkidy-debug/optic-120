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
  const [filterTab, setFilterTab] = useState<'ALL' | 'CLIENT' | 'INSURANCE'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['receivables', branchId],
    queryFn: () => listReceivables(branchId ?? undefined),
  });

  const items = data?.items ?? [];

  const filteredItems = items.filter((r) => {
    if (filterTab === 'CLIENT') return r.balance > 0;
    if (filterTab === 'INSURANCE') return (r.insuranceAmount ?? 0) > 0 && !r.insurerPaidAt;
    return true;
  });

  const totalClientOutstanding = data?.totalOutstanding ?? 0;
  const totalInsuranceOutstanding = data?.totalInsuranceOutstanding ?? 0;
  const totalCombined = totalClientOutstanding + totalInsuranceOutstanding;

  return (
    <div>
      <PageHeader title="Créances & Assurances" subtitle="Suivi des solde clients restant dus et des prises en charge assurances" />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="Aucune créance en attente"
          hint="Toutes les ventes sont soldeés et toutes les prises en charge assurances ont été réglées."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">Créances Clients (Solde dû)</p>
              <p className="mt-1 font-display text-3xl font-bold text-danger">
                {formatCurrency(totalClientOutstanding)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">Prises en charge Assurances</p>
              <p className="mt-1 font-display text-3xl font-bold text-warning">
                {formatCurrency(totalInsuranceOutstanding)}
              </p>
            </div>
            <div className="card p-5 bg-hero">
              <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">Total Global Attendu</p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">
                {formatCurrency(totalCombined)}
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border bg-surface p-1">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filterTab === 'ALL' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                Toutes ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('CLIENT')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filterTab === 'CLIENT' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                Solde Client ({items.filter((i) => i.balance > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('INSURANCE')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filterTab === 'INSURANCE' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                Assurances ({items.filter((i) => (i.insuranceAmount ?? 0) > 0 && !i.insurerPaidAt).length})
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">N° Vente</th>
                  <th className="table-cell font-semibold">Client</th>
                  <th className="table-cell font-semibold">Assurance</th>
                  <th className="table-cell text-right font-semibold">Total Vente</th>
                  <th className="table-cell text-right font-semibold">Part Assurance</th>
                  <th className="table-cell text-right font-semibold">Reste Client</th>
                  <th className="table-cell text-right font-semibold">Date</th>
                  <th className="table-cell text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((r: Receivable) => (
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
                    <td className="table-cell text-content">
                      {r.insurerName ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-content">{r.insurerName}</span>
                          <span className={`text-[11px] font-medium ${r.insurerPaidAt ? 'text-success' : 'text-warning'}`}>
                            {r.insurerPaidAt ? '✓ Réglé' : 'En attente de remboursement'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-content-faint">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right text-content">{formatCurrency(r.total)}</td>
                    <td className="table-cell text-right font-semibold text-warning">
                      {(r.insuranceAmount ?? 0) > 0 ? formatCurrency(r.insuranceAmount!) : '—'}
                    </td>
                    <td className="table-cell text-right font-semibold text-danger">
                      {r.balance > 0 ? formatCurrency(r.balance) : '0 FCFA'}
                    </td>
                    <td className="table-cell text-right text-content-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex justify-end">
                        {r.balance > 0 && canPay && (
                          <button
                            onClick={() => setPaySale({ id: r.id, due: r.balance, number: r.number })}
                            className="btn-outline h-8 rounded-lg px-2.5 text-xs text-primary"
                            title="Encaisser le solde client"
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
