import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Banknote, Phone } from 'lucide-react';
import { listReceivables, type Receivable } from '../../features/optique/api';
import { PaymentModal } from '../optique/PosPage';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { invalidateSalesViews } from '../../lib/queryInvalidation';
import { PageHeader, PageLoader, EmptyState, Button } from '../../components/ui';
import { tr } from '../../lib/tr';

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
    if (filterTab === 'INSURANCE') return (r.insuranceRemaining ?? r.insuranceAmount ?? 0) > 0;
    return true;
  });

  const totalClientOutstanding = data?.totalOutstanding ?? 0;
  const totalInsuranceOutstanding = data?.totalInsuranceOutstanding ?? 0;
  const totalCombined = totalClientOutstanding + totalInsuranceOutstanding;

  return (
    <div>
      <PageHeader title={tr('ui.ReceivablesPage.creancesAssurances')} subtitle={tr('ui.ReceivablesPage.suiviDesSoldeClientsRestant')} />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Coins}
          title={tr('ui.ReceivablesPage.aucuneCreanceEnAttente')}
          hint={tr('ui.ReceivablesPage.toutesLesVentesSontSoldees')}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">{tr('ui.ReceivablesPage.creancesClientsSoldeDu')}</p>
              <p className="mt-1 font-display text-3xl font-bold text-danger">
                {formatCurrency(totalClientOutstanding)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">{tr('ui.ReceivablesPage.prisesEnChargeAssurances')}</p>
              <p className="mt-1 font-display text-3xl font-bold text-warning">
                {formatCurrency(totalInsuranceOutstanding)}
              </p>
            </div>
            <div className="card p-5 bg-hero">
              <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">{tr('ui.ReceivablesPage.totalGlobalAttendu')}</p>
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
                {tr('ui.ReceivablesPage.toutes')}{items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('CLIENT')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filterTab === 'CLIENT' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                {tr('ui.ReceivablesPage.soldeClient')}{items.filter((i) => i.balance > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('INSURANCE')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filterTab === 'INSURANCE' ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                {tr('ui.ReceivablesPage.assurances')}{items.filter((i) => (i.insuranceRemaining ?? i.insuranceAmount ?? 0) > 0).length})
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">{tr('ui.ReceivablesPage.nVente')}</th>
                  <th className="table-cell font-semibold">Client</th>
                  <th className="table-cell font-semibold">{tr('ui.ReceivablesPage.assurance')}</th>
                  <th className="table-cell text-right font-semibold">{tr('ui.ReceivablesPage.totalVente')}</th>
                  <th className="table-cell text-right font-semibold">{tr('ui.ReceivablesPage.partAssurance')}</th>
                  <th className="table-cell text-right font-semibold">{tr('ui.ReceivablesPage.resteClient')}</th>
                  <th className="table-cell text-right font-semibold">Date</th>
                  <th className="table-cell text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((r: Receivable) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell font-medium text-content">{r.number}</td>
                    <td className="table-cell text-content-muted">
                      <div>{r.customer ?? tr('ui.ReceivablesPage.clientComptant')}</div>
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
                            {r.insurerPaidAt
                              ? tr('ui.ReceivablesPage.regle')
                              : (r.insurerPaidAmount ?? 0) > 0
                                ? tr('ui.ReceivablesPage.partielValueRecu', { value: formatCurrency(r.insurerPaidAmount ?? 0) })
                                : tr('ui.ReceivablesPage.enAttenteDeRemboursement')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-content-faint">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right text-content">{formatCurrency(r.total)}</td>
                    <td className="table-cell text-right font-semibold text-warning">
                      {(r.insuranceAmount ?? 0) > 0 ? (
                        <span>
                          {formatCurrency(r.insuranceRemaining ?? r.insuranceAmount!)}
                          {(r.insurerPaidAmount ?? 0) > 0 && (
                            <span className="block text-[11px] font-normal text-content-faint">
                              sur {formatCurrency(r.insuranceAmount!)}
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-cell text-right font-semibold text-danger">
                      {r.balance > 0 ? formatCurrency(r.balance) : formatCurrency(0)}
                    </td>
                    <td className="table-cell text-right text-content-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex justify-end">
                        {r.balance > 0 && canPay && (
                          <button
                            onClick={() => setPaySale({ id: r.id, due: r.balance, number: r.number })}
                            className="btn-outline h-8 rounded-lg px-2.5 text-xs text-primary"
                            title={tr('ui.ReceivablesPage.encaisserLeSoldeClient')}
                          >
                            <Banknote className="h-3.5 w-3.5" /> {tr('ui.ReceivablesPage.encaisser')}
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
          onPaidLabel={tr('ui.ReceivablesPage.terminer')}
          onClose={() => setPaySale(null)}
          onPaid={() => {
            setPaySale(null);
            invalidateSalesViews(qc);
          }}
        />
      )}
    </div>
  );
}
