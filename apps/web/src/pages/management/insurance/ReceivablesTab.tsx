import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import {
  getInsuranceReceivables,
  type Insurer,
  type InsuranceClaim,
} from '../../../features/management/api';
import { formatCurrency, formatDate } from '../../../lib/format';
import { PageLoader, EmptyState, Badge } from '../../../components/ui';
import { CLAIM_STATUSES, ClaimStatusBadge, num } from './shared';
import { tr } from '../../../lib/tr';

/** Créances assurance : ce que les assureurs doivent encore, et depuis quand. */
export function ReceivablesTab({
  insurers,
  onOpenClaim,
}: {
  insurers: Insurer[];
  onOpenClaim: (claim: InsuranceClaim) => void;
}) {
  const [insurerId, setInsurerId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minAmount, setMinAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['insurance-receivables', insurerId, status, from, to, minAmount],
    queryFn: () =>
      getInsuranceReceivables({
        insurerId: insurerId || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        minAmount: minAmount ? Number(minAmount) : undefined,
      }),
  });

  return (
    <div>
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile label={tr('ui.ReceivablesTab.totalDu')} value={data.totals.due} tone="text-primary" />
          <Tile label={tr('ui.ReceivablesTab.enAttente')} value={data.totals.pending} tone="text-warning" />
          <Tile label={tr('ui.ReceivablesTab.enRetard')} value={data.totals.late} tone="text-danger" />
          <Tile label={tr('ui.ReceivablesTab.partiellementPaye')} value={data.totals.partiallyPaid} tone="text-accent" />
          <Tile label={tr('ui.ReceivablesTab.recu')} value={data.totals.paid} tone="text-success" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label={tr('ui.ReceivablesTab.filtrerParAssureur')}
          className="input h-9 w-auto"
          value={insurerId}
          onChange={(e) => setInsurerId(e.target.value)}
        >
          <option value="">{tr('ui.ReceivablesTab.tousLesAssureurs')}</option>
          {insurers.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          aria-label={tr('ui.ReceivablesTab.filtrerParStatut')}
          className="input h-9 w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{tr('ui.ReceivablesTab.tousLesStatuts')}</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          aria-label={tr('ui.ReceivablesTab.depuis')}
          className="input h-9 w-auto"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          aria-label={tr('ui.ReceivablesTab.jusquAu')}
          className="input h-9 w-auto"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <input
          aria-label={tr('ui.ReceivablesTab.montantMinimum')}
          className="input h-9 w-28"
          type="number"
          min="0"
          placeholder={tr('ui.ReceivablesTab.montantMin')}
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
        />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Coins} title={tr('ui.ReceivablesTab.aucuneCreance')} hint={tr('ui.ReceivablesTab.tousLesDossiersFiltresSont')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-surface-2/60 text-left text-xs uppercase tracking-wide text-content-muted">
                <th className="table-cell font-semibold">{tr('ui.ReceivablesTab.dossier')}</th>
                <th className="table-cell font-semibold">{tr('ui.ReceivablesTab.assureur')}</th>
                <th className="table-cell font-semibold">Client</th>
                <th className="table-cell text-right font-semibold">{tr('ui.ReceivablesTab.attendu')}</th>
                <th className="table-cell text-right font-semibold">{tr('ui.ReceivablesTab.recu')}</th>
                <th className="table-cell text-right font-semibold">{tr('ui.ReceivablesTab.restant')}</th>
                <th className="table-cell font-semibold">{tr('ui.ReceivablesTab.echeance')}</th>
                <th className="table-cell font-semibold">{tr('ui.ReceivablesTab.statut')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onOpenClaim(c)}
                  className="cursor-pointer border-b last:border-0 transition hover:bg-surface-2"
                >
                  <td className="table-cell font-medium text-content">{c.number}</td>
                  <td className="table-cell text-content-muted">{c.insurer?.name ?? '—'}</td>
                  <td className="table-cell text-content-muted">
                    {c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : '—'}
                  </td>
                  <td className="table-cell text-right text-content">{formatCurrency(c.expectedAmount)}</td>
                  <td className="table-cell text-right text-success">{formatCurrency(num(c.paidAmount))}</td>
                  <td className="table-cell text-right font-semibold text-warning">
                    {formatCurrency(c.remainingAmount)}
                  </td>
                  <td className="table-cell">
                    {c.dueAt ? (
                      c.late ? (
                        <Badge tone="danger">{formatDate(c.dueAt)}</Badge>
                      ) : (
                        <span className="text-content-muted">{formatDate(c.dueAt)}</span>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="table-cell">
                    <ClaimStatusBadge status={c.status} />
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

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{formatCurrency(value)}</p>
    </div>
  );
}
